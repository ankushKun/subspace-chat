app = require("aoxpress")
sqlite3 = require("lsqlite3")

db = db or sqlite3.open_memory()

PROFILES = "J-GI_SARbZ8O0km4JiE2lu2KJdZIWMo53X3HrqusXjY"

server_name = server_name or Name or (Owner:sub(1, 4) .. "..." .. Owner:sub(-4) .. "'s Server")
server_icon = server_icon or "W11lwYHNY5Ag2GsNXvn_PF9qEnqZ8c_Qgp7RqulbyE4"

version = "0.0.1"

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
        name TEXT NOT NULL,
        order_id INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
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

-- create default category and text channel in that category
local categories = SQLRead("SELECT COUNT(*) as count FROM categories")[1].count
local channels = SQLRead("SELECT COUNT(*) as count FROM channels")[1].count

if categories == 0 and channels == 0 then
    SQLWrite("INSERT INTO categories (name) VALUES ('Text Channels')")
    SQLWrite("INSERT INTO channels (name, category_id) VALUES ('General', 1)")
end

function isOwner(id)
    return id == Owner
end

function GetProfile(id)
    local profile = SQLRead("SELECT * FROM members WHERE id = ?", id)
    if #profile == 1 then
        return profile[1]
    end
    return nil
end

app.get("/", function(req, res)
    local categories = SQLRead("SELECT * FROM categories ORDER BY order_id ASC")
    local channels = SQLRead("SELECT * FROM channels ORDER BY category_id, order_id ASC")
    local member_count = SQLRead("SELECT COUNT(*) FROM members")[1]["COUNT(*)"]

    res:json({
        name = server_name,
        icon = server_icon,
        owner = Owner,
        categories = categories,
        channels = channels,
        member_count = member_count
    })
end)

app.get("/get-version", function(req, res)
    res:json({
        success = true,
        version = version
    })
end)

app.get("/single-member", function(req, res)
    local id = req.query.id
    local member = SQLRead("SELECT * FROM members WHERE id = ?", id)
    res:json({
        success = true,
        member = member
    })
end)

app.get("/get-members", function(req, res)
    local members = SQLRead("SELECT * FROM members")
    res:json({
        success = true,
        members = members
    })
end)

app.post("/update-server", function(req, res)
    local id = req.msg.From
    id = TranslateDelegation(id)
    assert(isOwner(id), "You are not the owner of this server")
    local name = req.body.name or nil
    local icon = req.body.icon or nil

    if name then
        server_name = name
    end

    if icon then
        server_icon = icon
    end

    res:json({
        success = true
    })
end)

app.post("/create-category", function(req, res)
    local id = req.msg.From
    id = TranslateDelegation(id)
    assert(isOwner(id), "You are not the owner of this server")
    local name = req.body.name
    local order = req.body.order_id or req.body.order or 0

    db:exec("BEGIN TRANSACTION")
    local success = true

    if order > 0 then
        -- Make room for the new category
        SQLWrite([[
            UPDATE categories SET order_id = order_id + 1
            WHERE order_id >= ?
        ]], order)
    else
        -- Place at the end
        local max_order = SQLRead("SELECT MAX(order_id) as max_order FROM categories")
        order = 1
        if max_order and #max_order > 0 and max_order[1].max_order then
            order = max_order[1].max_order + 1
        end
    end

    local rows_updated = SQLWrite(
        "INSERT INTO categories (name, order_id) VALUES (?, ?)",
        name, order
    )

    if rows_updated ~= 1 then
        success = false
    end

    local category_id = db:last_insert_rowid()

    -- Resequence to clean up any gaps
    if success then
        resequence_categories()
    end

    if success then
        db:exec("COMMIT")
        res:json({
            category_id = category_id,
            success = true
        })
    else
        db:exec("ROLLBACK")
        res:status(500):json({
            error = "Failed to create category",
            success = false
        })
    end
end)

app.post("/update-category", function(req, res)
    local from = req.msg.From
    from = TranslateDelegation(from)
    assert(isOwner(from), "You are not the owner of this server")
    local id = req.body.id
    local name = req.body.name
    local order = req.body.order_id or req.body.order

    db:exec("BEGIN TRANSACTION")
    local success = true

    -- Get current category
    local current = SQLRead("SELECT * FROM categories WHERE id = ?", id)
    if #current == 0 then
        db:exec("ROLLBACK")
        return res:status(404):json({
            error = "Category not found",
            success = false
        })
    end

    local current_order = current[1].order_id

    -- If just updating name (simpler case)
    if name and not order then
        local rows = SQLWrite("UPDATE categories SET name = ? WHERE id = ?", name, id)
        if rows ~= 1 then
            success = false
        end
    else
        -- Handle ordering changes
        if order and order ~= current_order then
            if order < current_order then
                -- Moving up
                SQLWrite([[
                    UPDATE categories
                    SET order_id = order_id + 1
                    WHERE order_id >= ? AND order_id < ? AND id != ?
                ]], order, current_order, id)
            else
                -- Moving down
                SQLWrite([[
                    UPDATE categories
                    SET order_id = order_id - 1
                    WHERE order_id > ? AND order_id <= ? AND id != ?
                ]], current_order, order, id)

                -- Adjust for shift
                order = order - 1
            end
        end

        -- Update the category
        local query = "UPDATE categories SET "
        local params = {}

        if name then
            query = query .. "name = ?, "
            table.insert(params, name)
        end

        if order then
            query = query .. "order_id = ?, "
            table.insert(params, order)
        end

        query = query:gsub(", $", "") .. " WHERE id = ?"
        table.insert(params, id)

        local rows = SQLWrite(query, table.unpack(params))
        if rows ~= 1 then
            success = false
        end

        -- Resequence to clean up any gaps
        if success then
            resequence_categories()
        end
    end

    if success then
        db:exec("COMMIT")
        res:json({ success = true })
    else
        db:exec("ROLLBACK")
        res:status(500):json({
            error = "Failed to update category",
            success = false
        })
    end
end)

app.post("/delete-category", function(req, res)
    local from = req.msg.From
    from = TranslateDelegation(from)
    assert(isOwner(from), "You are not the owner of this server")
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
    local from = req.msg.From
    from = TranslateDelegation(from)
    assert(isOwner(from), "You are not the owner of this server")
    local name = req.body.name
    local category_id = req.body.category_id
    local order = req.body.order_id or req.body.order

    db:exec("BEGIN TRANSACTION")
    local success = true

    -- Determine the order for the new channel
    local new_order

    if order then
        new_order = order

        -- Make room for the new channel
        if category_id then
            SQLWrite([[
                UPDATE channels SET order_id = order_id + 1
                WHERE category_id = ? AND order_id >= ?
            ]], category_id, new_order)
        else
            SQLWrite([[
                UPDATE channels SET order_id = order_id + 1
                WHERE category_id IS NULL AND order_id >= ?
            ]], new_order)
        end
    else
        -- Always determine the next available order_id regardless of whether order was specified
        if category_id then
            local max_order = SQLRead([[
                SELECT MAX(order_id) as max_order FROM channels
                WHERE category_id = ?
            ]], category_id)

            new_order = 1 -- Default if no channels in target category
            if max_order and #max_order > 0 and max_order[1].max_order then
                new_order = max_order[1].max_order + 1
            end
        else
            local max_order = SQLRead([[
                SELECT MAX(order_id) as max_order FROM channels
                WHERE category_id IS NULL
            ]])

            new_order = 1 -- Default if no uncategorized channels
            if max_order and #max_order > 0 and max_order[1].max_order then
                new_order = max_order[1].max_order + 1
            end
        end
    end

    print("Creating channel with order_id: " .. new_order)

    -- Insert the new channel
    local rows_updated
    if category_id then
        rows_updated = SQLWrite(
            "INSERT INTO channels (name, category_id, order_id) VALUES (?, ?, ?)",
            name, category_id, new_order
        )
    else
        rows_updated = SQLWrite(
            "INSERT INTO channels (name, order_id) VALUES (?, ?)",
            name, new_order
        )
    end

    if rows_updated ~= 1 then
        success = false
    end

    local channel_id = db:last_insert_rowid()

    -- Resequence to clean up any gaps
    if success and category_id then
        resequence_channels(category_id)
    elseif success then
        resequence_channels(nil)
    end

    if success then
        db:exec("COMMIT")
        res:json({
            channel_id = channel_id,
            order_id = new_order,
            success = true
        })
    else
        db:exec("ROLLBACK")
        res:status(500):json({
            error = "Failed to create channel",
            success = false
        })
    end
end)

app.post("/update-channel", function(req, res)
    local from = req.msg.From
    from = TranslateDelegation(from)
    assert(isOwner(from), "You are not the owner of this server")
    local id = req.body.id
    local name = req.body.name
    local category_id = req.body.category_id
    local order = req.body.order_id or req.body.order

    db:exec("BEGIN TRANSACTION")
    local success = true

    -- First, get the current channel details
    local current = SQLRead("SELECT * FROM channels WHERE id = ?", id)
    if #current == 0 then
        db:exec("ROLLBACK")
        return res:status(404):json({
            error = "Channel not found",
            success = false
        })
    end

    -- Keep track of what fields we're updating
    local updating_name = name ~= nil
    local updating_category = category_id ~= nil
    local updating_order = order ~= nil

    -- Get current values
    local current_name = current[1].name
    local current_category_id = current[1].category_id
    local current_order = current[1].order_id

    -- Target category (what we're moving to)
    local target_category_id = current_category_id
    if updating_category then
        if category_id == "" then
            target_category_id = nil -- Set to NULL
        else
            target_category_id = category_id
        end
    end

    -- Check if we're changing category
    local changing_category = updating_category and (
        (target_category_id == nil and current_category_id ~= nil) or
        (target_category_id ~= nil and current_category_id == nil) or
        (target_category_id ~= nil and current_category_id ~= nil and
            tostring(target_category_id) ~= tostring(current_category_id))
    )

    -- If only updating name, that's a simple update
    if updating_name and not updating_category and not updating_order then
        local rows = SQLWrite("UPDATE channels SET name = ? WHERE id = ?", name, id)
        if rows ~= 1 then success = false end
    else
        -- Handle the more complex updates with ordering

        -- STEP 1: If we're changing category, fix the old category's order
        if changing_category then
            print("Changing category from " .. (current_category_id or "NULL") ..
                " to " .. (target_category_id or "NULL"))

            -- Update all channels with higher order in old category to fill the gap
            if current_category_id ~= nil then
                SQLWrite([[
                    UPDATE channels
                    SET order_id = order_id - 1
                    WHERE category_id = ? AND order_id > ?
                ]], current_category_id, current_order)
            else
                -- For channels with NULL category_id
                SQLWrite([[
                    UPDATE channels
                    SET order_id = order_id - 1
                    WHERE category_id IS NULL AND order_id > ?
                ]], current_order)
            end
        end

        -- STEP 2: Determine the new order for this channel
        local new_order = current_order
        if updating_order then
            new_order = order
        else
            -- If not explicitly changing order but changing category,
            -- place at the end of the new category
            if changing_category then
                if target_category_id ~= nil then
                    local max_order = SQLRead([[
                        SELECT MAX(order_id) as max_order FROM channels
                        WHERE category_id = ?
                    ]], target_category_id)

                    new_order = 1 -- Default if no channels in target category
                    if max_order and #max_order > 0 and max_order[1].max_order then
                        new_order = max_order[1].max_order + 1
                    end
                else
                    -- Moving to uncategorized
                    local max_order = SQLRead([[
                        SELECT MAX(order_id) as max_order FROM channels
                        WHERE category_id IS NULL
                    ]])

                    new_order = 1 -- Default if no uncategorized channels
                    if max_order and #max_order > 0 and max_order[1].max_order then
                        new_order = max_order[1].max_order + 1
                    end
                end
            end
        end

        -- STEP 3: Make room at the new position in the target category
        if target_category_id ~= nil then
            -- Only shift if we're staying in the same category and new_order <= current_order,
            -- or if we're changing category
            if (not changing_category and new_order < current_order) or changing_category then
                -- Shift up all channels at or after the target position
                SQLWrite([[
                    UPDATE channels
                    SET order_id = order_id + 1
                    WHERE category_id = ? AND order_id >= ? AND id != ?
                ]], target_category_id, new_order, id)
            elseif not changing_category and new_order > current_order then
                -- Moving down in same category - adjust for the shift that will happen
                new_order = new_order - 1
            end
        else
            -- Target is NULL category
            if (not changing_category and new_order < current_order) or changing_category then
                SQLWrite([[
                    UPDATE channels
                    SET order_id = order_id + 1
                    WHERE category_id IS NULL AND order_id >= ? AND id != ?
                ]], new_order, id)
            elseif not changing_category and new_order > current_order then
                -- Moving down in same category - adjust for the shift that will happen
                new_order = new_order - 1
            end
        end

        -- STEP 4: Update the channel with its new position and category
        local update_query = "UPDATE channels SET "
        local params = {}

        if updating_name then
            update_query = update_query .. "name = ?, "
            table.insert(params, name)
        end

        -- Always update order_id
        update_query = update_query .. "order_id = ?, "
        table.insert(params, new_order)

        if updating_category then
            if target_category_id == nil then
                update_query = update_query .. "category_id = NULL, "
            else
                update_query = update_query .. "category_id = ?, "
                table.insert(params, target_category_id)
            end
        end

        -- Remove trailing comma and add WHERE clause
        update_query = update_query:gsub(", $", "") .. " WHERE id = ?"
        table.insert(params, id)

        local rows = SQLWrite(update_query, table.unpack(params))
        if rows ~= 1 then success = false end

        -- STEP 5: Remove any gaps in order_id sequence
        -- Resequence the category we moved from (if changing)
        if changing_category and current_category_id ~= nil then
            resequence_channels(current_category_id)
        elseif changing_category and current_category_id == nil then
            resequence_channels(nil) -- Resequence NULL category
        end

        -- Resequence the category we moved to (if different)
        if changing_category and target_category_id ~= nil then
            resequence_channels(target_category_id)
        elseif changing_category and target_category_id == nil then
            resequence_channels(nil) -- Resequence NULL category
        elseif not changing_category then
            -- Also resequence current category if just changing order
            resequence_channels(current_category_id)
        end
    end

    if success then
        db:exec("COMMIT")
        res:json({ success = true })
    else
        db:exec("ROLLBACK")
        res:status(500):json({
            error = "Failed to update channel",
            success = false
        })
    end
end)

app.post("/delete-channel", function(req, res)
    local from = req.msg.From
    from = TranslateDelegation(from)
    assert(isOwner(from), "You are not the owner of this server")
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
    author_id = TranslateDelegation(author_id)
    local timestamp = req.msg.Timestamp
    local msg_id = req.msg.Id
    local content = req.body.content
    local channel_id = req.body.channel_id

    -- check if author is a member of the server
    local profile = GetProfile(author_id)
    if not profile then
        ---------------------------------------------------------------------
        -- -- Auto-register the member if they don't exist
        -- SQLWrite("INSERT INTO members (id) VALUES (?)", author_id)
        -- -- Re-fetch member data after insert
        -- member = SQLRead("SELECT * FROM members WHERE id = ?", author_id)
        ---------------------------------------------------------------------
        res:status(403):json({
            error = "You are not a member of this server",
            success = false
        })
        return
    end

    -- Extract mentions from content
    local mentions = {}
    for name, address in content:gmatch("@%[([^%]]+)%]%(([^%)]+)%)") do
        mentions[name] = address
    end

    -- check if channel exists
    local channel = SQLRead("SELECT * FROM channels WHERE id = ?", channel_id)
    if not channel or #channel == 0 then
        res:status(404):json({
            error = "Channel not found",
            success = false
        })
        return
    end


    local rows_updated = SQLWrite(
        "INSERT INTO messages (content, channel_id, author_id, timestamp, msg_id) VALUES (?, ?, ?, ?, ?)",
        content, channel_id, author_id, timestamp, msg_id)
    if rows_updated == 1 then
        -- Send notifications to mentioned users through the profile registry
        for name, address in pairs(mentions) do
            print("Sending notification to user:", name, address)
            ao.send({
                Target = PROFILES,
                Action = "Add-Notification",
                Tags = {
                    User_ID = address,
                    Server_ID = ao.id,
                    Channel_ID = tostring(channel_id),
                    Message_ID = msg_id,
                    Author_ID = author_id,
                    Author_Name = tostring(profile.nickname or author_id),
                    Content = content,
                    Channel_Name = channel[1].name,
                    Server_Name = server_name,
                    Timestamp = tostring(timestamp)
                }
            })
        end

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
    editor = TranslateDelegation(editor)

    local profile = GetProfile(editor)
    if not profile then
        res:status(403):json({
            error = "You are not a member of this server",
            success = false
        })
        return
    end

    local original_message = SQLRead("SELECT * FROM messages WHERE msg_id = ?", msg_id)
    if #original_message == 1 then
        original_message = original_message[1]
        if original_message.author_id == editor then
            local rows_updated = SQLWrite("UPDATE messages SET content = ?, edited = 1 WHERE msg_id = ?", content, msg_id)
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

app.post("/update-nickname", function(req, res)
    local member_id = req.msg.From
    member_id = TranslateDelegation(member_id)
    local nickname = req.body.nickname

    local profile = GetProfile(member_id)
    if not profile then
        res:status(403):json({
            error = "You are not a member of this server",
            success = false
        })
        return
    end

    -- Check if member exists
    local member = SQLRead("SELECT * FROM members WHERE id = ?", member_id)
    if not member or #member == 0 then
        -- Auto-register the member if they don't exist
        SQLWrite("INSERT INTO members (id, nickname) VALUES (?, ?)", member_id, nickname)
        res:json({
            success = true
        })
        return
    end

    -- Update the nickname
    local rows_updated = SQLWrite("UPDATE members SET nickname = ? WHERE id = ?", nickname, member_id)
    if rows_updated == 1 then
        res:json({
            success = true
        })
    else
        res:status(500):json({
            error = "Failed to update nickname",
            success = false
        })
    end
end)

app.post("/delete-message", function(req, res)
    local msg_id = req.body.msg_id
    local deleter = req.msg.From
    deleter = TranslateDelegation(deleter)
    local force_delete = isOwner(deleter)

    local profile = GetProfile(deleter)
    if not force_delete and not profile then
        res:status(403):json({
            error = "You are not a member of this server",
            success = false
        })
        return
    end

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
    local delegated_id = msg.Tags.delegated_id
    local original_id = msg.Tags.original_id

    -- Verify that the user is either the delegated_id or original_id
    if delegated_id and original_id then
        if id ~= delegated_id and id ~= original_id then
            return ao.send({
                Target = msg.From,
                Action = "Error",
                Data = "You are not authorized to add this member to this server",
                Tags = { User = id }
            })
        end
        Delegations[delegated_id] = original_id
    end

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

Handlers.add("Remove-Member", function(msg)
    assert(msg.From == PROFILES, "You are not authorized to remove members from this server")
    local id = msg.Tags.User
    local rows_updated = SQLWrite("DELETE FROM members WHERE id = ?", id)
    if rows_updated == 1 then
        print("Removed member " .. id)
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

Handlers.add("Add-Delegation", function(msg)
    assert(msg.From == PROFILES, "You are not authorized to add delegations to this server")
    local delegated_id = msg.Tags.delegated_id
    local original_id = msg.Tags.original_id

    -- Validate inputs
    if not delegated_id or not original_id then
        return ao.send({
            Target = msg.From,
            Action = "Error",
            Data = "Invalid delegation data",
            Tags = { delegated_id = delegated_id, original_id = original_id }
        })
    end

    -- Check if delegated_id is already delegated by someone else
    if Delegations[delegated_id] and Delegations[delegated_id] ~= original_id then
        return ao.send({
            Target = msg.From,
            Action = "Error",
            Data = "Address is already delegated by someone else",
            Tags = { delegated_id = delegated_id, original_id = original_id }
        })
    end

    -- Check if original_id is already a delegatee (someone has delegated to this address)
    for d_id, o_id in pairs(Delegations) do
        if d_id == original_id then
            return ao.send({
                Target = msg.From,
                Action = "Error",
                Data = "Cannot delegate as you are already delegated",
                Tags = { delegated_id = delegated_id, original_id = original_id }
            })
        end
    end

    -- Remove any existing delegation where original_id is the delegator
    for d_id, o_id in pairs(Delegations) do
        if o_id == original_id then
            print("Removing existing delegation:", d_id, "->", o_id)
            Delegations[d_id] = nil
        end
    end

    -- Create the new delegation
    Delegations[delegated_id] = original_id
end)

Handlers.add("Remove-Delegation", function(msg)
    assert(msg.From == PROFILES, "You are not authorized to remove delegations from this server")
    local delegated_id = msg.Tags.delegated_id
    local original_id = msg.Tags.original_id

    -- Validate inputs
    if not delegated_id or not original_id then
        return ao.send({
            Target = msg.From,
            Action = "Error",
            Data = "Invalid delegation data",
            Tags = { delegated_id = delegated_id, original_id = original_id }
        })
    end

    -- Verify the delegation exists and matches
    if not Delegations[delegated_id] or Delegations[delegated_id] ~= original_id then
        return ao.send({
            Target = msg.From,
            Action = "Error",
            Data = "Delegation not found or mismatch",
            Tags = { delegated_id = delegated_id, original_id = original_id }
        })
    end

    Delegations[delegated_id] = nil
end)

-- Helper function to resequence a category's channels
function resequence_channels(category_id)
    local channels

    if category_id ~= nil then
        channels = SQLRead([[
            SELECT id FROM channels
            WHERE category_id = ?
            ORDER BY order_id ASC
        ]], category_id)
    else
        channels = SQLRead([[
            SELECT id FROM channels
            WHERE category_id IS NULL
            ORDER BY order_id ASC
        ]])
    end

    -- Resequence starting from 1
    for i, channel in ipairs(channels) do
        if category_id ~= nil then
            SQLWrite([[
                UPDATE channels SET order_id = ?
                WHERE id = ? AND category_id = ?
            ]], i, channel.id, category_id)
        else
            SQLWrite([[
                UPDATE channels SET order_id = ?
                WHERE id = ? AND category_id IS NULL
            ]], i, channel.id)
        end
    end

    return #channels
end

-- Helper function to resequence all categories
function resequence_categories()
    local categories = SQLRead("SELECT id FROM categories ORDER BY order_id ASC")

    -- Resequence starting from 1
    for i, category in ipairs(categories) do
        SQLWrite("UPDATE categories SET order_id = ? WHERE id = ?", i, category.id)
    end

    return #categories
end

app.listen()
