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

db:exec([[
    CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        username TEXT DEFAULT "",
        pfp TEXT DEFAULT "4mDPmblDGphIFa3r4tfE_o26m0PtfLftlzqscnx-ASo",
        servers_joined TEXT DEFAULT "{}"
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        channel_id INTEGER NOT NULL,
        message_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT,
        content TEXT NOT NULL,
        channel_name TEXT,
        server_name TEXT,
        timestamp INTEGER NOT NULL,
        read INTEGER DEFAULT 0,
        UNIQUE(user_id, message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_server_channel ON notifications(user_id, server_id, channel_id);
]])

-- Record for original id and delegated id (addresses)
-- whenever a request is received, if it is a delegated id, use the original id in place of the delegated id
-- [delegated_id] = original_id
Delegations = Delegations or {}

function TranslateDelegation(id)
    assert(type(id) == "string", "❌[delegation error] id is not a string")
    if Delegations[id] then
        return Delegations[id]
    end
    return id
end

function GetProfile(id)
    local profile = SQLRead("SELECT * FROM profiles WHERE id = ?", id)
    if profile then
        return profile[1]
    end
    return nil
end

function UpdateProfile(id, username, pfp)
    local profile = GetProfile(id)
    local servers_joined = "{}"

    -- Preserve servers_joined from existing profile
    if profile and profile.servers_joined then
        servers_joined = profile.servers_joined
    end

    SQLWrite("INSERT OR REPLACE INTO profiles (id, username, pfp, servers_joined) VALUES (?, ?, ?, ?)",
        id, username, pfp, servers_joined)
end

function UpdateServers(id, servers)
    local profile = GetProfile(id)
    local username = nil
    local pfp = DEFAULT_PFP

    -- Preserve existing profile data
    if profile then
        username = profile.username
        pfp = profile.pfp
    end

    SQLWrite("INSERT OR REPLACE INTO profiles (id, username, pfp, servers_joined) VALUES (?, ?, ?, ?)",
        id, username, pfp, json.encode(servers))
end

-- Add notification for a user
function AddNotification(user_id, server_id, channel_id, message_id, author_id, author_name, content, channel_name,
                         server_name, timestamp)
    -- Try to insert the notification, ignore if there's a unique constraint violation
    SQLWrite([[
        INSERT OR IGNORE INTO notifications
        (user_id, server_id, channel_id, message_id, author_id, author_name, content, channel_name, server_name, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], user_id, server_id, channel_id, message_id, author_id, author_name, content, channel_name, server_name, timestamp)
end

app.get("/profile", function(req, res)
    local id = req.body.id or req.msg.From
    local original_id = TranslateDelegation(id)
    local profile = GetProfile(original_id)

    if not profile then
        -- create profile if it doesn't exist
        UpdateProfile(original_id, nil, DEFAULT_PFP)
        profile = GetProfile(original_id)
    end

    local response = {
        success = true,
        profile = profile
    }
    -- If this is a delegated address, include the original_id
    if id ~= original_id then
        response.profile.original_id = original_id
    end
    res:json(response)
end)

app.post("/delegate", function(req, res)
    local id = req.msg.From
    local delegated_id = tostring(req.body.delegated_id)

    print("Attempting delegation:")
    print("From ID:", id)
    print("To delegated_id:", delegated_id)
    print("Current delegations:", json.encode(Delegations))

    -- Prevent self-delegation
    if delegated_id == id then
        return res:status(400):json({
            success = false,
            error = "Cannot delegate to self"
        })
    end

    -- Check if delegated_id is already delegated by someone else
    if Delegations[delegated_id] and Delegations[delegated_id] ~= id then
        print("Delegation blocked: Address already delegated by someone else")
        return res:status(400):json({
            success = false,
            error = "Address is already delegated by someone else"
        })
    end

    -- Check if id is already a delegatee (someone has delegated to this address)
    for d_id, o_id in pairs(Delegations) do
        if d_id == id then
            print("Delegation blocked: ID is already a delegatee")
            print("Found delegation:", d_id, "->", o_id)
            return res:status(400):json({
                success = false,
                error = "Cannot delegate as you are already delegated"
            })
        end
    end

    -- Remove any existing delegation where this address is the original_id
    for d_id, o_id in pairs(Delegations) do
        if o_id == id then
            print("Removing existing delegation:", d_id, "->", o_id)
            Delegations[d_id] = nil
        end
    end

    -- Create the new delegation
    Delegations[delegated_id] = id

    local profile = GetProfile(id)
    if not profile then
        res:status(404):json({
            success = false,
            error = "Profile not found"
        })
        return
    end

    local servers_joined = json.decode(profile.servers_joined or "{}") or {}
    for _, server in ipairs(servers_joined) do
        ao.send({
            Target = server,
            Action = "Add-Delegation",
            Tags = { delegated_id = delegated_id, original_id = id }
        })
    end
    res:json({
        success = true
    })
end)

app.post("/undelegate", function(req, res)
    local id = req.msg.From
    local converted_id = TranslateDelegation(id)

    -- Find the delegation to remove
    local delegation_to_remove = nil
    for d_id, o_id in pairs(Delegations) do
        if o_id == converted_id then
            delegation_to_remove = d_id
            break
        end
    end

    if not delegation_to_remove then
        return res:status(404):json({
            success = false,
            error = "No delegation found"
        })
    end

    -- Remove the delegation
    Delegations[delegation_to_remove] = nil
    local profile = GetProfile(converted_id)
    local servers_joined = json.decode(profile.servers_joined or "{}") or {}
    for _, server in ipairs(servers_joined) do
        ao.send({
            Target = server,
            Action = "Remove-Delegation",
            Tags = { delegated_id = delegation_to_remove, original_id = converted_id }
        })
    end
    res:json({
        success = true
    })
end)

app.get("/bulk-profile", function(req, res)
    local ids = req.body.ids
    local profiles = {}
    for _, id in ipairs(ids) do
        id = TranslateDelegation(id)
        local profile = GetProfile(id)
        if profile then
            table.insert(profiles, profile)
        end
    end
    res:json({
        success = true,
        profiles = profiles
    })
end)

app.post("/update-profile", function(req, res)
    local id = req.msg.From
    id = TranslateDelegation(id)
    local username = req.body.username
    local pfp = req.body.pfp

    local profile = GetProfile(id)
    if profile then
        username = username or profile.username
        pfp = pfp or profile.pfp
    end
    UpdateProfile(id, username, pfp)

    -- TODO: add check to see if 'Owner' owns the ArNS name for username
    res:json({
        success = true
    })
end)

app.post("/join-server", function(req, res)
    local id = req.msg.From
    id = TranslateDelegation(id)
    local server_id = req.body.server_id

    local profile = GetProfile(id)
    if not profile then
        -- Create profile if it doesn't exist
        UpdateProfile(id, nil, DEFAULT_PFP)
        profile = GetProfile(id)
    end

    local servers_joined = json.decode(profile.servers_joined or "{}") or {}

    -- Convert to array if it's not already
    if type(servers_joined) ~= "table" then
        servers_joined = {}
    end

    -- Check if already joined
    for _, server in ipairs(servers_joined) do
        if server == server_id then
            res:json({
                success = false,
                error = "Already joined server"
            })
            return
        end
    end

    -- Add server to the list
    table.insert(servers_joined, server_id)

    -- Update the servers list while preserving other profile data
    UpdateServers(id, servers_joined)

    -- Prepare tags for Add-Member message
    local tags = { User = id }

    -- Find any delegations for this user
    for d_id, o_id in pairs(Delegations) do
        if o_id == id then
            -- This user is a delegator
            tags.delegated_id = d_id
            tags.original_id = id
        elseif d_id == id then
            -- This user is a delegatee
            tags.delegated_id = id
            tags.original_id = o_id
        end
    end

    -- Send Add-Member message with delegation info
    ao.send({
        Target = server_id,
        Action = "Add-Member",
        Tags = tags
    })

    res:json({
        success = true
    })
end)

app.post("/leave-server", function(req, res)
    local id = req.msg.From
    id = TranslateDelegation(id)
    local server_id = req.body.server_id

    local profile = GetProfile(id)
    if not profile then
        res:json({
            success = false,
            error = "Profile not found"
        })
        return
    end

    local servers_joined = json.decode(profile.servers_joined or "{}") or {}

    -- Convert to array if it's not already
    if type(servers_joined) ~= "table" then
        servers_joined = {}
    end

    local found = false
    local new_servers = {}

    -- Create new array without the server to leave
    for _, server in ipairs(servers_joined) do
        if server == server_id then
            found = true
        else
            table.insert(new_servers, server)
        end
    end

    if not found then
        res:json({
            success = false,
            error = "Not joined server"
        })
        return
    end

    -- Update the servers list while preserving other profile data (username and pfp)
    UpdateServers(id, new_servers)

    ao.send({
        Target = server_id,
        Action = "Remove-Member",
        Tags = { User = id }
    })

    res:json({
        success = true
    })
end)

-- Get all unread notifications for a user
app.get("/get-notifications", function(req, res)
    local id = req.body.id or req.msg.From
    id = TranslateDelegation(id)
    -- Get all notifications for this user (since we're now deleting them instead of marking as read)
    local notifications = SQLRead([[
        SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY timestamp DESC
    ]], id)

    res:json({
        success = true,
        notifications = notifications
    })
end)

-- Mark notifications as read for a specific server and channel
app.post("/mark-read", function(req, res)
    local id = req.msg.From
    id = TranslateDelegation(id)
    local server_id = req.body.server_id
    local channel_id = req.body.channel_id

    if not server_id or not channel_id then
        res:status(400):json({
            success = false,
            error = "Missing server_id or channel_id"
        })
        return
    end

    -- Delete all notifications for this user, server, and channel
    local rows_updated = SQLWrite([[
        DELETE FROM notifications
        WHERE user_id = ? AND server_id = ? AND channel_id = ?
    ]], id, server_id, channel_id)

    res:json({
        success = true,
        notifications_deleted = rows_updated
    })
end)

-- Add a handler for receiving notification data from servers
Handlers.add("Add-Notification", function(msg)
    local user_id = msg.Tags.User_ID
    local server_id = msg.Tags.Server_ID
    local channel_id = tonumber(msg.Tags.Channel_ID)
    local message_id = msg.Tags.Message_ID
    local author_id = msg.Tags.Author_ID
    author_id = TranslateDelegation(author_id)
    local author_name = msg.Tags.Author_Name
    local content = msg.Tags.Content
    local channel_name = msg.Tags.Channel_Name
    local server_name = msg.Tags.Server_Name
    local timestamp = tonumber(msg.Tags.Timestamp)

    -- Security check: ensure the notification is coming from the claimed server
    if msg.From ~= server_id then
        print("Security violation: message sender (" .. msg.From .. ") doesn't match server_id (" .. server_id .. ")")
        return
    end

    if not user_id or not server_id or not channel_id or not message_id then
        print("Invalid notification data")
        return
    end

    -- Add the notification to the database
    AddNotification(
        user_id, server_id, channel_id, message_id, author_id,
        author_name, content, channel_name, server_name, timestamp
    )
    print("Added notification for user: " .. user_id)
end)

app.listen()
print(ao.id)
