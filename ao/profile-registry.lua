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
    )
]])


function GetProfile(id)
    local profile = SQLRead("SELECT * FROM profiles WHERE id = ?", id)
    if profile then
        return profile[1]
    end
    return nil
end

function UpdateProfile(id, username, pfp)
    SQLWrite("INSERT OR REPLACE INTO profiles (id, username, pfp) VALUES (?, ?, ?)", id, username, pfp)
end

function UpdateServers(id, servers)
    SQLWrite("INSERT OR REPLACE INTO profiles (id, servers_joined) VALUES (?, ?)", id, json.encode(servers))
end

app.get("/profile", function(req, res)
    local id = req.body.id or req.msg.From
    local profile = GetProfile(id)
    if profile then
        res:json({
            success = true,
            profile = profile
        })
    else
        -- create profile if it doesn't exist
        UpdateProfile(id, nil, DEFAULT_PFP)
        profile = GetProfile(id)
        res:json({
            success = true,
            profile = profile
        })
        -- res:status(404):json({
        --     success = false,
        --     error = "Profile not found"
        -- })
    end
end)

app.post("/update-profile", function(req, res)
    local id = req.msg.From
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
    local server_id = req.body.server_id

    local profile = GetProfile(id)
    if not profile then
        -- Create profile if it doesn't exist
        UpdateProfile(id, nil, DEFAULT_PFP)
        profile = { servers_joined = "{}" }
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

    UpdateServers(id, servers_joined)

    ao.send({
        Target = server_id,
        Action = "Add-Member",
        Tags = { User = id }
    })

    res:json({
        success = true
    })
end)

app.post("/leave-server", function(req, res)
    local id = req.msg.From
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


app.listen()
print(ao.id)
