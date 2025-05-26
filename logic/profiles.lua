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
                ALTER TABLE profiles RENAME COLUMN servers_joined TO serversJoined;
            ]])
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

db:exec([[
    CREATE TABLE IF NOT EXISTS profiles (
        userId TEXT PRIMARY KEY,
        username TEXT DEFAULT "",
        pfp TEXT DEFAULT "4mDPmblDGphIFa3r4tfE_o26m0PtfLftlzqscnx-ASo",
        serversJoined TEXT DEFAULT "{}"
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

function UpdateProfile(userId, username, pfp)
    local profile = GetProfile(userId)
    local serversJoined = "{}"

    -- Preserve serversJoined from existing profile
    if profile and profile.serversJoined then
        serversJoined = profile.serversJoined
    end

    SQLWrite("INSERT OR REPLACE INTO profiles (userId, username, pfp, serversJoined) VALUES (?, ?, ?, ?)",
        userId, username, pfp, serversJoined)
end

function UpdateServers(userId, servers)
    local profile = GetProfile(userId)
    local username = nil
    local pfp = DEFAULT_PFP

    -- Preserve existing profile data
    if profile then
        username = profile.username
        pfp = profile.pfp
    end

    SQLWrite("INSERT OR REPLACE INTO profiles (userId, username, pfp, serversJoined) VALUES (?, ?, ?, ?)",
        userId, username, pfp, json.encode(servers))
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

    local serversJoined = json.decode(profile.serversJoined or "{}") or {}
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

    local serversJoined = json.decode(profile.serversJoined or "{}") or {}
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
        return res:json({
            isDelegatee = true,
            originalId = Delegations[userId],
            delegatedId = userId
        })
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
        return res:json({
            isDelegatee = false,
            originalId = convertedId,
            delegatedId = delegatedId
        })
    end

    -- No delegation found
    return res:json({
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

    local serversJoined = json.decode(profile.serversJoined or "{}") or {}

    -- Convert to array if it's not already
    if type(serversJoined) ~= "table" then
        serversJoined = {}
    end

    -- Check if already joined
    for _, server in ipairs(serversJoined) do
        if server == serverId then
            res:status(400):json({
                error = "Already joined server"
            })
            return
        end
    end

    -- Add server to the list
    table.insert(serversJoined, serverId)

    -- Update the servers list while preserving other profile data
    UpdateServers(userId, serversJoined)

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

    local serversJoined = json.decode(profile.serversJoined or "{}") or {}

    -- Convert to array if it's not already
    if type(serversJoined) ~= "table" then
        serversJoined = {}
    end

    local found = false
    local newServers = {}

    -- Create new array without the server to leave
    for _, server in ipairs(serversJoined) do
        if server == serverId then
            found = true
        else
            table.insert(newServers, server)
        end
    end

    if not found then
        res:status(400):json({
            error = "Not joined server"
        })
        return
    end

    -- Update the servers list while preserving other profile data (username and pfp)
    UpdateServers(userId, newServers)

    ao.send({
        Target = serverId,
        Action = "Remove-Member",
        Tags = { User = userId }
    })

    res:json({})
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
    local serverId = req.body.serverId
    local channelId = req.body.channelId

    if not serverId or not channelId then
        res:status(400):json({
            error = "Missing serverId or channelId"
        })
        return
    end

    -- Delete all notifications for this user, server, and channel
    local rowsUpdated = SQLWrite([[
        DELETE FROM notifications
        WHERE userId = ? AND serverId = ? AND channelId = ?
    ]], userId, serverId, channelId)

    res:json({
        notificationsDeleted = rowsUpdated
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
