export default `
app = require("aoxpress")
sqlite3 = require("lsqlite3")

db = db or sqlite3.open_memory()

PROFILES = "bKKJjeOXr3ViedwUB6hz_Me3VFRxMXS0yTkZBkJEL3s"

server_name = Name or (Owner:sub(1, 4) .. "..." .. Owner:sub(-4) .. "'s Server")
server_icon = ""

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

r = db:exec([[
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        order_id INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        order_id INTEGER NOT NULL DEFAULT 1,
        category_id INTEGER,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        nickname TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        channel_id INTEGER,
        author_id TEXT,
        msg_id TEXT UNIQUE,
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        edited INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES members(id) ON DELETE SET NULL
    );
]])

function isOwner(id)
    return id == Owner
end

app.get("/", function(req, res)
    local categories = SQLRead("SELECT * FROM categories")
    local channels = SQLRead("SELECT * FROM channels")

    res:json({
        name = server_name,
        icon = server_icon,
        owner = Owner,
        categories = categories,
        channels = channels
    })
end)

app.post("/update-server", function(req, res)
    assert(isOwner(req.msg.From), "You are not the owner of this server")
    local name = req.body.name
    local icon = req.body.icon

    server_name = name or server_name
    server_icon = icon or server_icon

    res:json({
        success = true
    })
end)

app.post("/create-category", function(req, res)
    assert(isOwner(req.msg.From), "You are not the owner of this server")
    local name = req.body.name
    local order = req.body.order or 1
    local rows_updated = SQLWrite("INSERT INTO categories (name, order) VALUES (?, ?)", name, order)
    if rows_updated == 1 then
        res:json({
            category_id = db:last_insert_rowid(),
            success = true
        })
    else
        res:status(500):json({
            error = "Failed to create category",
            success = false
        })
    end
end)

app.post("/update-category", function(req, res)
    assert(isOwner(req.msg.From), "You are not the owner of this server")
    local id = req.body.id
    local name = req.body.name
    local order = req.body.order or 1
    local rows_updated = SQLWrite("UPDATE categories SET name = ?, order = ? WHERE id = ?", name, order, id)
    if rows_updated == 1 then
        res:json({
            success = true
        })
    else
        res:status(500):json({
            error = "Failed to update category",
            success = false
        })
    end
end)

app.post("/delete-category", function(req, res)
    assert(isOwner(req.msg.From), "You are not the owner of this server")
    local id = req.body.id
    local rows_updated = SQLWrite("DELETE FROM categories WHERE id = ?", id)
    if rows_updated == 1 then
        local channels_updated = SQLWrite("UPDATE channels SET category_id = NULL WHERE category_id = ?", id)
        res:json({
            success = true,
            channels_updated = channels_updated
        })
    else
        res:status(500):json({
            error = "Failed to delete category",
            success = false
        })
    end
end)

------------------------------------------------------------------------

app.post("/create-channel", function(req, res)
    assert(isOwner(req.msg.From), "You are not the owner of this server")
    local name = req.body.name
    local category_id = req.body.category_id
    local order = req.body.order or 1
    local rows_updated = SQLWrite("INSERT INTO channels (name, category_id, order) VALUES (?, ?, ?)", name, category_id,
        order)
    if rows_updated == 1 then
        res:json({
            channel_id = db:last_insert_rowid(),
            success = true
        })
    else
        res:status(500):json({
            error = "Failed to create channel",
            success = false
        })
    end
end)

app.post("/update-channel", function(req, res)
    assert(isOwner(req.msg.From), "You are not the owner of this server")
    local id = req.body.id
    -- can update any of these fields, values may be missing too
    local name = req.body.name
    local category_id = req.body.category_id
    local order = req.body.order or nil

    -- Start a transaction since we may need to update multiple rows
    db:exec("BEGIN TRANSACTION")

    local query = "UPDATE channels SET "
    local params = {}
    if name then
        query = query .. "name = ?, "
        table.insert(params, name)
    end
    if category_id then
        query = query .. "category_id = ?, "
        table.insert(params, category_id)
    end
    if order then
        query = query .. "order = ?, "
        table.insert(params, order)

        -- Update order of other channels in the same category
        local cat_id = category_id or SQLRead("SELECT category_id FROM channels WHERE id = ?", id)[1].category_id
        local shift_query = [[
            UPDATE channels
            SET "order" = "order" + 1
            WHERE category_id = ?
            AND "order" >= ?
            AND id != ?
        ]]
        SQLWrite(shift_query, cat_id, order, id)
    end

    query = query:gsub(", $", "") -- Remove trailing comma
    query = query .. " WHERE id = ?"
    table.insert(params, id)

    local success = true
    local rows_updated = SQLWrite(query, table.unpack(params))
    if rows_updated ~= 1 then
        success = false
        db:exec("ROLLBACK")
    else
        db:exec("COMMIT")
    end

    if success then
        res:json({
            success = true
        })
    else
        res:status(500):json({
            error = "Failed to update channel",
            success = false
        })
    end
end)

app.post("/delete-channel", function(req, res)
    assert(isOwner(req.msg.From), "You are not the owner of this server")
    local id = req.body.id
    local rows_updated = SQLWrite("DELETE FROM channels WHERE id = ?", id)
    if rows_updated == 1 then
        local messages_deleted = SQLWrite("DELETE FROM messages WHERE channel_id = ?", id)
        res:json({
            success = true,
            messages_deleted = messages_deleted
        })
    else
        res:status(500):json({
            error = "Failed to delete channel",
            success = false
        })
    end
end)

------------------------------------------------------------------------

app.get("/get-messages", function(req, res)
    local channel_id = req.body.channel_id
    -- TODO: pagination
    -- TODO: sort by timestamp
    -- TODO: filter by author
    local messages = SQLRead("SELECT * FROM messages WHERE channel_id = ? ORDER BY timestamp DESC LIMIT 100", channel_id)
    res:json({
        messages = messages,
        success = true
    })
end)

app.post("/send-message", function(req, res)
    local author_id = req.msg.From
    local timestamp = req.msg.Timestamp
    local msg_id = req.msg.Id
    local content = req.body.content
    local channel_id = req.body.channel_id

    -- check if channel exists
    local channel = SQLRead("SELECT * FROM channels WHERE id = ?", channel_id)
    if not channel or #channel == 0 then
        res:status(404):json({
            error = "Channel not found",
            success = false
        })
        return
    end

    -- check if author is a member of the server
    local member = SQLRead("SELECT * FROM members WHERE id = ?", author_id)
    if not member or #member == 0 then
        -- Auto-register the member if they don't exist
        SQLWrite("INSERT INTO members (id) VALUES (?)", author_id)
    end

    local rows_updated = SQLWrite(
        "INSERT INTO messages (content, channel_id, author_id, timestamp, msg_id) VALUES (?, ?, ?, ?, ?)",
        content, channel_id, author_id, timestamp, msg_id)
    if rows_updated == 1 then
        res:json({
            success = true
        })
    else
        res:status(500):json({
            error = "Failed to send message",
            success = false
        })
    end
end)

app.post("/edit-message", function(req, res)
    local msg_id = req.body.msg_id
    local content = req.body.content
    local editor = req.msg.From

    local original_message = SQLRead("SELECT * FROM messages WHERE msg_id = ?", msg_id)
    if #original_message == 1 then
        original_message = original_message[1]
        if original_message.author_id == editor then
            local rows_updated = SQLWrite("UPDATE messages SET content = ? WHERE msg_id = ?", content, msg_id)
            if rows_updated == 1 then
                res:json({
                    success = true
                })
            else
                res:status(500):json({
                    error = "Failed to edit message",
                    success = false
                })
            end
        else
            res:status(403):json({
                error = "You are not the author of this message",
                success = false
            })
        end
    else
        res:status(404):json({
            error = "Message not found",
            success = false
        })
    end
end)

app.post("/delete-message", function(req, res)
    local msg_id = req.body.msg_id
    local deleter = req.msg.From
    local force_delete = isOwner(deleter)

    local original_message = SQLRead("SELECT * FROM messages WHERE msg_id = ?", msg_id)
    if #original_message == 1 then
        original_message = original_message[1]
        if force_delete or (original_message.author_id == deleter) then
            local rows_updated = SQLWrite("DELETE FROM messages WHERE msg_id = ?", msg_id)
            if rows_updated == 1 then
                res:json({
                    success = true
                })
            else
                res:status(500):json({
                    error = "Failed to delete message",
                    success = false
                })
            end
        else
            res:status(403):json({
                error = "You are not the author of this message",
                success = false
            })
        end
    else
        res:status(404):json({
            error = "Message not found",
            success = false
        })
    end
end)

------------------------------------------------------------

Handlers.add("Add-Member", function(msg)
    assert(msg.From == PROFILES, "You are not authorized to add members to this server")
    local id = msg.Tags.User
    local rows_updated = SQLWrite("INSERT INTO members (id) VALUES (?)", id)
    if rows_updated == 1 then
        print("Added member " .. id)
    else
        ao.send({
            Target = msg.From,
            Action = "Error",
            Data = db:errmsg(),
            Tags = {
                User = id
            }
        })
    end
end)

app.listen()

`