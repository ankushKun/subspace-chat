app = require("aoxpress")
sqlite3 = require("lsqlite3")
json = require("json")

db = db or sqlite3.open_memory()

-- easily read from the database
function SQLRead(query, ...)
    local m = {}
    local _ = 1
    local stmt = db:prepare(query)
    if stmt then
        local bind_res = stmt:bind_values(...)
        assert(bind_res, "❌[bind error] " .. db:errmsg())
        for row in stmt:nrows() do
            -- table.insert(m, row)
            m[_] = row
            _ = _ + 1
        end
        stmt:finalize()
    end
    return m
end

-- easily write to the database
function SQLWrite(query, ...)
    local stmt = db:prepare(query)
    if stmt then
        local bind_res = stmt:bind_values(...)
        assert(bind_res, "❌[bind error] " .. db:errmsg())
        local step = stmt:step()
        assert(step == sqlite3.DONE, "❌[write error] " .. db:errmsg())
        stmt:finalize()
    end
    return db:changes()
end

DEFAULT_PFP = "4mDPmblDGphIFa3r4tfE_o26m0PtfLftlzqscnx-ASo"

-- Migration helper function to check if a column exists
function column_exists(table_name, column_name)
    local result = SQLRead("PRAGMA table_info(" .. table_name .. ")")
    for _, column in ipairs(result) do
        if column.name == column_name then
            return true
        end
    end
    return false
end

-- Migration helper function to check if a table exists
function table_exists(table_name)
    local result = SQLRead("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table_name)
    return #result > 0
end

-- Migrate existing tables to new schema
function migrate_tables()
    -- Migrate profiles table
    if table_exists("profiles") then
        if column_exists("profiles", "id") and not column_exists("profiles", "userId") then
            print("Migrating profiles table...")
            db:exec([[
                ALTER TABLE profiles RENAME COLUMN id TO userId;
            ]])
        end

        -- Migrate serversJoined from JSON column to separate table
        if column_exists("profiles", "serversJoined") then
            print("Migrating serversJoined data to new table structure...")

            -- Get all profiles with serversJoined data
            local profiles_with_servers = SQLRead(
                "SELECT userId, serversJoined FROM profiles WHERE serversJoined IS NOT NULL AND serversJoined != '' AND serversJoined != '{}'")

            for _, profile in ipairs(profiles_with_servers) do
                if profile.serversJoined and profile.serversJoined ~= "" and profile.serversJoined ~= "{}" and profile.serversJoined ~= "[]" then
                    -- Try to decode the JSON array/object
                    local success, servers = pcall(json.decode, profile.serversJoined)
                    if success then
                        if type(servers) == "table" then
                            -- Handle both array format [] and object format {}
                            if servers[1] then
                                -- Array format
                                for i, serverId in ipairs(servers) do
                                    if serverId and serverId ~= "" then
                                        SQLWrite(
                                            "INSERT OR IGNORE INTO serversJoined (userId, serverId, orderId) VALUES (?, ?, ?)",
                                            profile.userId, serverId, i)
                                    end
                                end
                            else
                                -- Object format - iterate over keys/values
                                local i = 1
                                for serverId, _ in pairs(servers) do
                                    if serverId and serverId ~= "" then
                                        SQLWrite(
                                            "INSERT OR IGNORE INTO serversJoined (userId, serverId, orderId) VALUES (?, ?, ?)",
                                            profile.userId, serverId, i)
                                        i = i + 1
                                    end
                                end
                            end
                        end
                    else
                        print("Failed to decode serversJoined JSON for user: " .. tostring(profile.userId))
                    end
                end
            end

            -- Recreate the profiles table with new structure (remove serversJoined, add dmProcess)
            print("Updating profiles table structure...")

            local success, error_msg = pcall(function()
                db:exec(string.format([[
                    CREATE TABLE profiles_new (
                        userId TEXT PRIMARY KEY,
                        username TEXT DEFAULT "",
                        pfp TEXT DEFAULT "%s",
                        dmProcess TEXT DEFAULT ""
                    );
                ]], DEFAULT_PFP))

                db:exec(string.format([[
                    INSERT INTO profiles_new (userId, username, pfp, dmProcess)
                    SELECT userId,
                           COALESCE(username, '') as username,
                           COALESCE(pfp, '%s') as pfp,
                           '' as dmProcess
                    FROM profiles;
                ]], DEFAULT_PFP))

                db:exec("DROP TABLE profiles;")
                db:exec("ALTER TABLE profiles_new RENAME TO profiles;")
            end)

            if success then
                print("Successfully updated profiles table structure")
            else
                print("Error updating profiles table structure: " .. tostring(error_msg))
            end

            print("Completed migration of serversJoined data and updated profiles table structure")
        end
    end

    -- Additional check: if profiles table still has serversJoined column after migration, force structure update
    if table_exists("profiles") and column_exists("profiles", "serversJoined") then
        print("Profiles table still has serversJoined column, forcing structure update...")

        local success, error_msg = pcall(function()
            db:exec(string.format([[
                CREATE TABLE profiles_temp (
                    userId TEXT PRIMARY KEY,
                    username TEXT DEFAULT "",
                    pfp TEXT DEFAULT "%s",
                    dmProcess TEXT DEFAULT ""
                );
            ]], DEFAULT_PFP))

            db:exec(string.format([[
                INSERT INTO profiles_temp (userId, username, pfp, dmProcess)
                SELECT userId,
                       COALESCE(username, '') as username,
                       COALESCE(pfp, '%s') as pfp,
                       '' as dmProcess
                FROM profiles;
            ]], DEFAULT_PFP))

            db:exec("DROP TABLE profiles;")
            db:exec("ALTER TABLE profiles_temp RENAME TO profiles;")
        end)

        if success then
            print("Successfully forced profiles table structure update")
        else
            print("Error in forced profiles table structure update: " .. tostring(error_msg))
        end
    end

    -- Migrate serversJoined table to add orderId column
    if table_exists("serversJoined") and not column_exists("serversJoined", "orderId") then
        print("Adding orderId column to serversJoined table...")

        local success, error_msg = pcall(function()
            -- Add orderId column with default value 0
            db:exec("ALTER TABLE serversJoined ADD COLUMN orderId INTEGER DEFAULT 0")

            -- Update existing records to have sequential orderIds per user
            local users = SQLRead("SELECT DISTINCT userId FROM serversJoined")
            for _, user in ipairs(users) do
                local servers = SQLRead("SELECT serverId FROM serversJoined WHERE userId = ? ORDER BY serverId",
                    user.userId)
                for i, server in ipairs(servers) do
                    SQLWrite("UPDATE serversJoined SET orderId = ? WHERE userId = ? AND serverId = ?",
                        i, user.userId, server.serverId)
                end
            end
        end)

        if success then
            print("Successfully added orderId column to serversJoined table")
        else
            print("Error adding orderId column: " .. tostring(error_msg))
        end
    end

    -- Migrate notifications table
    if table_exists("notifications") then
        if column_exists("notifications", "id") and not column_exists("notifications", "notificationId") then
            print("Migrating notifications table...")
            db:exec([[
                ALTER TABLE notifications RENAME COLUMN id TO notificationId;
                ALTER TABLE notifications RENAME COLUMN user_id TO userId;
                ALTER TABLE notifications RENAME COLUMN server_id TO serverId;
                ALTER TABLE notifications RENAME COLUMN channel_id TO channelId;
                ALTER TABLE notifications RENAME COLUMN message_id TO messageId;
                ALTER TABLE notifications RENAME COLUMN author_id TO authorId;
                ALTER TABLE notifications RENAME COLUMN author_name TO authorName;
                ALTER TABLE notifications RENAME COLUMN channel_name TO channelName;
                ALTER TABLE notifications RENAME COLUMN server_name TO serverName;
            ]])

            -- Drop old indexes and create new ones
            db:exec("DROP INDEX IF EXISTS idx_notifications_user_id")
            db:exec("DROP INDEX IF EXISTS idx_notifications_server_channel")
        end
    end
end

-- Run migration before creating tables
migrate_tables()

function VarOrNil(var)
    return var ~= "" and var or nil
end

-- Helper function to get servers joined by a user
function GetServersJoined(userId)
    local servers = SQLRead("SELECT serverId FROM serversJoined WHERE userId = ? ORDER BY orderId", userId)
    local serverIds = {}
    for _, server in ipairs(servers) do
        table.insert(serverIds, server.serverId)
    end
    return serverIds
end

-- Helper function to add a user to a server
function AddUserToServer(userId, serverId, orderId)
    -- If orderId is not provided, use the next available order
    if not orderId then
        local maxOrder = SQLRead("SELECT MAX(orderId) as maxOrder FROM serversJoined WHERE userId = ?", userId)
        orderId = (maxOrder[1] and maxOrder[1].maxOrder or 0) + 1
    end
    SQLWrite("INSERT OR IGNORE INTO serversJoined (userId, serverId, orderId) VALUES (?, ?, ?)", userId, serverId,
        orderId)
end

-- Helper function to remove a user from a server
function RemoveUserFromServer(userId, serverId)
    return SQLWrite("DELETE FROM serversJoined WHERE userId = ? AND serverId = ?", userId, serverId)
end

-- Helper function to check if user is in a server
function IsUserInServer(userId, serverId)
    local result = SQLRead("SELECT COUNT(*) as count FROM serversJoined WHERE userId = ? AND serverId = ?", userId,
        serverId)
    return result[1] and result[1].count > 0
end

-- Helper function to update server order for a user
function UpdateServerOrder(userId, serverId, newOrderId)
    return SQLWrite("UPDATE serversJoined SET orderId = ? WHERE userId = ? AND serverId = ?", newOrderId, userId,
        serverId)
end

-- Helper function to reorder all servers for a user
function ReorderServers(userId, serverIds)
    -- serverIds should be an array of serverIds in the desired order
    for i, serverId in ipairs(serverIds) do
        UpdateServerOrder(userId, serverId, i)
    end
end

-- Helper function to get servers with their order info
function GetServersWithOrder(userId)
    local servers = SQLRead("SELECT serverId, orderId FROM serversJoined WHERE userId = ? ORDER BY orderId", userId)
    return servers
end

db:exec([[
    CREATE TABLE IF NOT EXISTS profiles (
        userId TEXT PRIMARY KEY,
        username TEXT DEFAULT "",
        pfp TEXT DEFAULT "4mDPmblDGphIFa3r4tfE_o26m0PtfLftlzqscnx-ASo",
        dmProcess TEXT DEFAULT ""
    );

    CREATE TABLE IF NOT EXISTS serversJoined (
        userId TEXT NOT NULL,
        serverId TEXT NOT NULL,
        orderId INTEGER DEFAULT 0,
        PRIMARY KEY (userId, serverId)
    );

    CREATE TABLE IF NOT EXISTS friends (
        userId1 TEXT NOT NULL,
        userId2 TEXT NOT NULL,
        user1Accepted INTEGER DEFAULT 1,
        user2Accepted INTEGER DEFAULT 0,
        PRIMARY KEY (userId1, userId2)
    );

    CREATE TABLE IF NOT EXISTS notifications (
        notificationId INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        serverId TEXT NOT NULL,
        channelId INTEGER NOT NULL,
        messageId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        authorName TEXT,
        content TEXT NOT NULL,
        channelName TEXT,
        serverName TEXT,
        timestamp INTEGER NOT NULL,
        read INTEGER DEFAULT 0,
        UNIQUE(userId, messageId)
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId);
    CREATE INDEX IF NOT EXISTS idx_notifications_server_channel ON notifications(userId, serverId, channelId);
]])

-- Record for original id and delegated id (addresses)
-- whenever a request is received, if it is a delegated id, use the original id in place of the delegated id
-- [delegated_id] = original_id
Delegations = Delegations or {}

function TranslateDelegation(userId)
    assert(type(userId) == "string", "❌[delegation error] userId is not a string")
    if Delegations[userId] then
        return Delegations[userId]
    end
    return userId
end

function GetProfile(userId)
    local profile = SQLRead("SELECT * FROM profiles WHERE userId = ?", userId)
    if profile then
        return profile[1]
    end
    return nil
end

function UpdateProfile(userId, username, pfp, dmProcess)
    SQLWrite("INSERT OR REPLACE INTO profiles (userId, username, pfp, dmProcess) VALUES (?, ?, ?, ?)",
        userId, username, pfp, dmProcess)
end

function UpdateServers(userId, servers)
    -- First, remove all existing server associations for this user
    SQLWrite("DELETE FROM serversJoined WHERE userId = ?", userId)

    -- Then add the new server associations
    for _, serverId in ipairs(servers) do
        AddUserToServer(userId, serverId)
    end
end

-- Add notification for a user
function AddNotification(userId, serverId, channelId, messageId, authorId, authorName, content, channelName,
                         serverName, timestamp)
    -- Try to insert the notification, ignore if there's a unique constraint violation
    SQLWrite([[
        INSERT OR IGNORE INTO notifications
        (userId, serverId, channelId, messageId, authorId, authorName, content, channelName, serverName, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], userId, serverId, channelId, messageId, authorId, authorName, content, channelName, serverName, timestamp)
end

app.get("/profile", function(req, res)
    local userId = req.body.userId or req.msg.From
    local originalId = TranslateDelegation(userId)
    local profile = GetProfile(originalId)

    if not profile then
        -- create profile if it doesn't exist
        UpdateProfile(originalId, nil, DEFAULT_PFP)
        profile = GetProfile(originalId)
    end

    -- Add serversJoined data from the new table
    profile.serversJoined = json.encode(GetServersJoined(originalId))
    profile.friends = json.encode(GetFriends(originalId))

    -- If this is a delegated address, include the originalId
    if userId ~= originalId then
        profile.originalId = originalId
    end
    res:json(profile)
end)

app.post("/delegate", function(req, res)
    local userId = req.msg.From
    local delegatedId = tostring(req.body.userId)

    -- Prevent self-delegation
    if delegatedId == userId then
        return res:status(400):json({
            error = "Cannot delegate to self"
        })
    end

    -- Check if delegatedId is already delegated by someone else
    if Delegations[delegatedId] and Delegations[delegatedId] ~= userId then
        return res:status(400):json({
            error = "Address is already delegated by someone else"
        })
    end

    -- Check if userId is already a delegatee (someone has delegated to this address)
    for dId, oId in pairs(Delegations) do
        if dId == userId then
            return res:status(400):json({
                error = "Cannot delegate as you are already delegated"
            })
        end
    end

    -- Remove any existing delegation where this address is the originalId
    for dId, oId in pairs(Delegations) do
        if oId == userId then
            Delegations[dId] = nil
        end
    end

    -- Create the new delegation
    Delegations[delegatedId] = userId

    local profile = GetProfile(userId)
    if not profile then
        res:status(404):json({
            error = "Profile not found"
        })
        return
    end

    local serversJoined = GetServersJoined(userId)
    for _, server in ipairs(serversJoined) do
        ao.send({
            Target = server,
            Action = "Add-Delegation",
            Tags = { delegated_id = delegatedId, original_id = userId }
        })
    end
    res:json({})
end)

app.post("/undelegate", function(req, res)
    local userId = req.msg.From
    local convertedId = TranslateDelegation(userId)

    -- Find the delegation to remove
    local delegationToRemove = nil
    local isDelegatee = false

    -- Check if the requester is the delegatee
    if Delegations[userId] then
        delegationToRemove = userId
        isDelegatee = true
    else
        -- Check if the requester is the original delegator
        for dId, oId in pairs(Delegations) do
            if oId == convertedId then
                delegationToRemove = dId
                break
            end
        end
    end

    if not delegationToRemove then
        return res:status(404):json({
            error = "No delegation found"
        })
    end

    -- Remove the delegation
    Delegations[delegationToRemove] = nil
    local profile = GetProfile(convertedId)

    if not profile then
        res:status(404):json({
            error = "Profile not found"
        })
        return
    end

    local serversJoined = GetServersJoined(convertedId)
    for _, server in ipairs(serversJoined) do
        ao.send({
            Target = server,
            Action = "Remove-Delegation",
            Tags = {
                delegated_id = delegationToRemove,
                original_id = isDelegatee and Delegations[delegationToRemove] or convertedId
            }
        })
    end
    res:json({})
end)

app.get("/check-delegation", function(req, res)
    local userId = req.body.userId or req.msg.From
    local convertedId = TranslateDelegation(userId)

    -- Check if this ID is a delegatee
    if Delegations[userId] then
        res:json({
            isDelegatee = true,
            originalId = Delegations[userId],
            delegatedId = userId
        })
        return
    end

    -- Check if this ID is a delegator
    local delegatedId = nil
    for dId, oId in pairs(Delegations) do
        if oId == convertedId then
            delegatedId = dId
            break
        end
    end

    if delegatedId then
        res:json({
            isDelegatee = false,
            originalId = convertedId,
            delegatedId = delegatedId
        })
        return
    end

    -- No delegation found
    res:json({
        isDelegatee = false,
        originalId = convertedId,
        delegatedId = nil
    })
end)

app.get("/bulk-profile", function(req, res)
    local userIds = req.body.userIds
    local profiles = {}
    for _, userId in ipairs(userIds) do
        userId = TranslateDelegation(userId)
        local profile = GetProfile(userId)
        if profile then
            table.insert(profiles, profile)
        end
    end
    res:json(profiles)
end)

app.post("/update-profile", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local username = VarOrNil(req.body.username)
    local pfp = VarOrNil(req.body.pfp)

    local profile = GetProfile(userId)
    if profile then
        username = username or profile.username
        pfp = pfp or profile.pfp
    end
    UpdateProfile(userId, username, pfp)

    -- TODO: add check to see if 'Owner' owns the ArNS name for username
    res:json({})
end)

app.post("/join-server", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local serverId = req.body.serverId

    local profile = GetProfile(userId)
    if not profile then
        -- Create profile if it doesn't exist
        UpdateProfile(userId, nil, DEFAULT_PFP)
        profile = GetProfile(userId)
    end

    if not profile then
        res:status(404):json({
            error = "Profile not found"
        })
        return
    end

    -- Check if already joined using the new helper function
    if IsUserInServer(userId, serverId) then
        res:status(400):json({
            error = "Already joined server"
        })
        return
    end

    -- Add user to server
    AddUserToServer(userId, serverId)

    -- Prepare tags for Add-Member message
    local tags = { User = userId }

    -- Find any delegations for this user
    for dId, oId in pairs(Delegations) do
        if oId == userId then
            -- This user is a delegator
            tags.delegated_id = dId
            tags.original_id = userId
        elseif dId == userId then
            -- This user is a delegatee
            tags.delegated_id = userId
            tags.original_id = oId
        end
    end

    -- Send Add-Member message with delegation info
    ao.send({
        Target = serverId,
        Action = "Add-Member",
        Tags = tags
    })

    res:json({})
end)

app.post("/leave-server", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local serverId = req.body.serverId

    local profile = GetProfile(userId)
    if not profile then
        res:status(404):json({
            error = "Profile not found"
        })
        return
    end

    -- Check if user is in the server
    if not IsUserInServer(userId, serverId) then
        res:status(400):json({
            error = "Not joined server"
        })
        return
    end

    -- Remove user from server
    RemoveUserFromServer(userId, serverId)

    ao.send({
        Target = serverId,
        Action = "Remove-Member",
        Tags = { User = userId }
    })

    res:json({})
end)

app.post("/reorder-servers", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local serverIds = req.body.serverIds

    local profile = GetProfile(userId)
    if not profile then
        res:status(404):json({
            error = "Profile not found"
        })
        return
    end

    -- Parse serverIds if it's a JSON string
    if type(serverIds) == "string" then
        local success, parsed = pcall(json.decode, serverIds)
        if success and type(parsed) == "table" then
            serverIds = parsed
        else
            res:status(400):json({
                error = "Invalid serverIds format - must be a valid JSON array"
            })
            return
        end
    end

    -- Validate that serverIds is an array
    if not serverIds or type(serverIds) ~= "table" then
        res:status(400):json({
            error = "serverIds must be an array"
        })
        return
    end

    -- Validate that all servers in the list belong to the user
    for _, serverId in ipairs(serverIds) do
        if not IsUserInServer(userId, serverId) then
            res:status(400):json({
                error = "Server " .. serverId .. " not found in user's server list"
            })
            return
        end
    end

    -- Reorder the servers
    ReorderServers(userId, serverIds)

    res:json({
        message = "Servers reordered successfully"
    })
end)

app.get("/get-servers-with-order", function(req, res)
    local userId = req.body.userId or req.msg.From
    userId = TranslateDelegation(userId)

    local profile = GetProfile(userId)
    if not profile then
        res:status(404):json({
            error = "Profile not found"
        })
        return
    end

    local servers = GetServersWithOrder(userId)
    res:json(servers)
end)

-- Get all unread notifications for a user
app.get("/get-notifications", function(req, res)
    local userId = req.body.userId or req.msg.From
    userId = TranslateDelegation(userId)
    -- Get all notifications for this user (since we're now deleting them instead of marking as read)
    local notifications = SQLRead([[
        SELECT * FROM notifications
        WHERE userId = ?
        ORDER BY timestamp DESC
    ]], userId)

    res:json(notifications)
end)

-- Mark notifications as read for a specific server and channel
app.post("/mark-read", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local serverId = VarOrNil(req.body.serverId)
    local channelId = VarOrNil(req.body.channelId)

    local rowsUpdated

    if serverId and channelId then
        -- Delete notifications for specific server and channel
        rowsUpdated = SQLWrite([[
            DELETE FROM notifications
            WHERE userId = ? AND serverId = ? AND channelId = ?
        ]], userId, serverId, channelId)
    elseif serverId then
        -- Delete notifications for entire server (any channel)
        rowsUpdated = SQLWrite([[
            DELETE FROM notifications
            WHERE userId = ? AND serverId = ?
        ]], userId, serverId)
    else
        -- Delete all notifications for user
        rowsUpdated = SQLWrite([[
            DELETE FROM notifications
            WHERE userId = ?
        ]], userId)
    end

    res:json({
        notificationsDeleted = rowsUpdated
    })
end)

---------------------------------------------------------------
-- FRIENDS

-- LOGIC:
-- userId1 - Alice, userId2 - Bob, user1Accepted - 1, user2Accepted - 0 : means Alice has sent a friend request to Bob and Bob has not accepted it yet
-- when bob accepts the request, user2Accepted is set to 1
-- or if Bob had sent the request, he would have been the userId1 and Alice would have been the userId2

-- userId1 and userId2 are the addresses of the users
-- to check for a users friends, you need to check for both userId1 and userId2

function IsFriend(userId1, userId2)
    local result = SQLRead(
        "SELECT * FROM friends WHERE (userId1 = ? AND userId2 = ?) OR (userId1 = ? AND userId2 = ?) AND user1Accepted = 1 AND user2Accepted = 1",
        userId1, userId2, userId2, userId1)
    return result[1] and result[1].user1Accepted == 1 and result[1].user2Accepted == 1
end

function SendFriendRequest(userId1, userId2)
    SQLWrite("INSERT OR IGNORE INTO friends (userId1, userId2, user1Accepted, user2Accepted) VALUES (?, ?, 1, 0)",
        userId1,
        userId2)
end

function AcceptFriendRequest(userId1, userId2)
    SQLWrite("UPDATE friends SET user2Accepted = 1 WHERE userId1 = ? AND userId2 = ?", userId1, userId2)
end

function RejectFriendRequest(userId1, userId2)
    SQLWrite("DELETE FROM friends WHERE userId1 = ? AND userId2 = ?", userId1, userId2)
end

function RemoveFriend(userId1, userId2)
    SQLWrite("DELETE FROM friends WHERE (userId1 = ? AND userId2 = ?) OR (userId1 = ? AND userId2 = ?)", userId1, userId2,
        userId2, userId1)
end

function GetFriends(userId)
    local result = SQLRead("SELECT * FROM friends WHERE userId1 = ? OR userId2 = ?", userId, userId)
    return result
end

function GetFriendRequestsReceived(userId)
    local result = SQLRead("SELECT * FROM friends WHERE userId2 = ? AND user2Accepted = 0", userId)
    return result
end

function GetFriendRequestsSent(userId)
    local result = SQLRead("SELECT * FROM friends WHERE userId1 = ? AND user1Accepted = 0", userId)
    return result
end

-- example:
-- A - friends are B,C,D
-- X - friends are W,C,Y,D
-- common friends are C,D

function GetCommonFriends(firstUserId, secondUserId)
    -- do this in a single query
    local result = SQLRead(
        "SELECT * FROM friends WHERE (userId1 = ? AND userId2 = ?) OR (userId1 = ? AND userId2 = ?) AND user1Accepted = 1 AND user2Accepted = 1",
        firstUserId, secondUserId, secondUserId, firstUserId)
    return result
end

app.post("/send-friend-request", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local friendId = req.body.friendId
    friendId = TranslateDelegation(friendId)

    local profile = GetProfile(userId)
    if not profile then
        res:status(404):json({
            error = "Profile not found"
        })
        return
    end

    local friendProfile = GetProfile(friendId)
    if not friendProfile then
        res:status(404):json({
            error = "Friend profile not found"
        })
        return
    end

    -- Check if friendId is already a friend
    if IsFriend(userId, friendId) then
        res:status(400):json({
            error = "Already friends"
        })
        return
    end

    SendFriendRequest(userId, friendId)
    res:json({})
end)

app.post("/accept-friend-request", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local friendId = req.body.friendId
    friendId = TranslateDelegation(friendId)

    local profile = GetProfile(userId)
    if not profile then
        res:status(404):json({
            error = "Profile not found"
        })
        return
    end

    local friendProfile = GetProfile(friendId)
    if not friendProfile then
        res:status(404):json({
            error = "Friend profile not found"
        })
        return
    end

    -- Find the friend request where current user is userId2 (recipient) and friendId is userId1 (sender)
    local friendRequest = SQLRead("SELECT * FROM friends WHERE userId1 = ? AND userId2 = ? AND user2Accepted = 0",
        friendId, userId)
    if not friendRequest or #friendRequest == 0 then
        res:status(400):json({
            error = "No pending friend request found"
        })
        return
    end

    -- Accept the friend request (friendId sent request to userId, so friendId is userId1)
    AcceptFriendRequest(friendId, userId)

    res:json({})
end)

app.post("/reject-friend-request", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local friendId = req.body.friendId
    friendId = TranslateDelegation(friendId)

    local profile = GetProfile(userId)
    if not profile then
        res:status(404):json({
            error = "Profile not found"
        })
        return
    end

    local friendProfile = GetProfile(friendId)
    if not friendProfile then
        res:status(404):json({
            error = "Friend profile not found"
        })
        return
    end

    -- Find the friend request where current user is userId2 (recipient) and friendId is userId1 (sender)
    local friendRequest = SQLRead("SELECT * FROM friends WHERE userId1 = ? AND userId2 = ? AND user2Accepted = 0",
        friendId, userId)
    if not friendRequest or #friendRequest == 0 then
        res:status(400):json({
            error = "No pending friend request found"
        })
        return
    end

    -- Reject the friend request (friendId sent request to userId, so friendId is userId1)
    RejectFriendRequest(friendId, userId)

    res:json({})
end)

app.post("/remove-friend", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local friendId = req.body.friendId
    friendId = TranslateDelegation(friendId)

    local profile = GetProfile(userId)
    if not profile then
        res:status(404):json({
            error = "Profile not found"
        })
        return
    end

    local friendProfile = GetProfile(friendId)
    if not friendProfile then
        res:status(404):json({
            error = "Friend profile not found"
        })
        return
    end

    if not IsFriend(userId, friendId) then
        res:status(400):json({
            error = "Not friends"
        })
        return
    end

    RemoveFriend(userId, friendId)
    res:json({})
end)

---------------------------------------------------------
--- DMs

--- Retrieving DM messages should be done from the dmProcess

app.post("/initiate-dm", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local friendId = req.body.friendId
    friendId = TranslateDelegation(friendId)

    local profile = GetProfile(userId)
    if not profile then
        res:status(404):json({
            error = "Profile not found"
        })
        return
    end

    local friendProfile = GetProfile(friendId)
    if not friendProfile then
        res:status(404):json({
            error = "Friend profile not found"
        })
        return
    end

    if not IsFriend(userId, friendId) then
        res:status(400):json({
            error = "Not friends"
        })
        return
    end

    -- check if both user have a dmProcess
    if profile.dmProcess == "" then
        -- spawn and set a dmProcess
        ao.spawn(ao.env.Module.Id, {
            -- Data = [[boot_ran = true]],
            Tags = {
                Authority = "fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY",
                ["On-Boot"] = "uwajf5JfJhGjFKe7ZdLmUPY2-bRkqnAhfO3fvdr2Uj0"
            }
        })

        local spawnRes = Receive({ Action = "Spawned" })
        if not spawnRes or not spawnRes['Process'] then
            res:status(500):json({
                error = "Failed to spawn DM process for user"
            })
            return
        end
        local dmProcess = spawnRes['Process']
        print("Spawned dmProcess for " .. userId .. ": " .. dmProcess)
        profile.dmProcess = dmProcess
        UpdateProfile(userId, profile.username, profile.pfp, dmProcess)

        ao.send({
            Target = dmProcess,
            Action = "Set-Owner",
            Data = userId
        })
    end

    if friendProfile.dmProcess == "" then
        -- spawn and set a dmProcess
        ao.spawn(ao.env.Module.Id, {
            -- Data = [[boot_ran = true]],
            Tags = {
                Authority = "fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY",
                ["On-Boot"] = "uwajf5JfJhGjFKe7ZdLmUPY2-bRkqnAhfO3fvdr2Uj0"
            }
        })

        local spawnRes = Receive({ Action = "Spawned" })
        if not spawnRes or not spawnRes['Process'] then
            res:status(500):json({
                error = "Failed to spawn DM process for friend"
            })
            return
        end
        local dmProcess = spawnRes['Process']
        print("Spawned dmProcess for " .. friendId .. ": " .. dmProcess)
        friendProfile.dmProcess = dmProcess
        UpdateProfile(friendId, friendProfile.username, friendProfile.pfp, dmProcess)

        ao.send({
            Target = dmProcess,
            Action = "Set-Owner",
            Data = friendId
        })
    end

    res:json({
        dmProcess = profile.dmProcess,
        friendDmProcess = friendProfile.dmProcess
    })
end)

app.post("/send-dm", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local friendId = req.body.friendId
    friendId = TranslateDelegation(friendId)

    local profile = GetProfile(userId)
    if not profile then
        res:status(404):json({
            error = "Profile not found"
        })
        return
    end

    local friendProfile = GetProfile(friendId)
    if not friendProfile then
        res:status(404):json({
            error = "Friend profile not found"
        })
        return
    end

    -- check if friendId is a friend
    if not IsFriend(userId, friendId) then
        res:status(400):json({
            error = "Not friends"
        })
        return
    end

    local senderDmProcess = profile.dmProcess
    local receiverDmProcess = friendProfile.dmProcess

    if senderDmProcess == "" then
        res:status(400):json({
            error = "Sender dmProcess not found, initiate dm first"
        })
        return
    end

    if receiverDmProcess == "" then
        res:status(400):json({
            error = "Receiver dmProcess not found, initiate dm first"
        })
        return
    end

    local replyTo = VarOrNil(req.body.replyTo)
    local timestamp = req.msg.Timestamp
    local content = tostring(req.body.content)
    local attachments = tostring(req.body.attachments)

    ao.send({
        Target = senderDmProcess,
        Action = "Add-DM-Message",
        Data = json.encode({
            -- dm message data
            withUser = friendId,
            author = userId,
            content = content,
            attachments = attachments,
            replyTo = tostring(replyTo),
            timestamp = timestamp
        })
    })

    ao.send({
        Target = receiverDmProcess,
        Action = "Add-DM-Message",
        Data = json.encode({
            -- dm message data
            withUser = userId,
            author = userId, -- FIX: Author should always be the sender
            content = content,
            attachments = attachments,
            replyTo = tostring(replyTo),
            timestamp = timestamp
        })
    })

    local senderRes = Receive({ Action = "Add-DM-Response-" .. userId })
    local receiverRes = Receive({ Action = "Add-DM-Response-" .. friendId })

    if not senderRes or not senderRes['Data'] or senderRes['Data'] ~= "OK" then
        res:status(500):json({
            status = "Error sender process",
            error  = senderRes['Tags'].Error
        })
        return
    end

    if not receiverRes or not receiverRes['Data'] or receiverRes['Data'] ~= "OK" then
        res:status(500):json({
            status = "Error receiver process",
            error = receiverRes['Tags'].Error
        })
        return
    end

    res:json({
        senderMessageId = senderRes.Tags.MessageId,
        receiverMessageId = receiverRes.Tags.MessageId,
    })
end)

-- Add a handler for receiving notification data from servers
Handlers.add("Add-Notification", function(msg)
    local userId = msg.Tags.User_ID
    local serverId = msg.Tags.Server_ID
    local channelId = tonumber(msg.Tags.Channel_ID)
    local messageId = msg.Tags.Message_ID
    local authorId = msg.Tags.Author_ID
    authorId = TranslateDelegation(authorId)
    local authorName = msg.Tags.Author_Name
    local content = msg.Tags.Content
    local channelName = msg.Tags.Channel_Name
    local serverName = msg.Tags.Server_Name
    local timestamp = tonumber(msg.Tags.Timestamp)

    -- Security check: ensure the notification is coming from the claimed server
    if msg.From ~= serverId then
        print("Security violation: message sender (" .. msg.From .. ") doesn't match serverId (" .. serverId .. ")")
        return
    end

    if not userId or not serverId or not channelId or not messageId then
        print("Invalid notification data")
        return
    end

    -- Add the notification to the database
    AddNotification(
        userId, serverId, channelId, messageId, authorId,
        authorName, content, channelName, serverName, timestamp
    )
    print("Added notification for user: " .. userId)
end)

app.listen()
print(ao.id)
