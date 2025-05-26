app = require("aoxpress")
sqlite3 = require("lsqlite3")
json = require("json")

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
    -- Migrate categories table
    if table_exists("categories") then
        if column_exists("categories", "id") and not column_exists("categories", "categoryId") then
            print("Migrating categories table...")
            db:exec([[
                ALTER TABLE categories RENAME COLUMN id TO categoryId;
                ALTER TABLE categories RENAME COLUMN order_id TO orderId;
            ]])
        end
    end

    -- Migrate channels table
    if table_exists("channels") then
        if column_exists("channels", "id") and not column_exists("channels", "channelId") then
            print("Migrating channels table...")
            db:exec([[
                ALTER TABLE channels RENAME COLUMN id TO channelId;
                ALTER TABLE channels RENAME COLUMN order_id TO orderId;
                ALTER TABLE channels RENAME COLUMN category_id TO categoryId;
            ]])
        end
    end

    -- Migrate members table
    if table_exists("members") then
        if column_exists("members", "id") and not column_exists("members", "userId") then
            print("Migrating members table...")
            db:exec([[
                ALTER TABLE members RENAME COLUMN id TO userId;
            ]])
        end
    end

    -- Migrate messages table (more complex due to foreign keys)
    if table_exists("messages") then
        if column_exists("messages", "id") and not column_exists("messages", "messageId") then
            print("Migrating messages table...")

            -- Create new messages table with correct schema
            db:exec([[
                CREATE TABLE messages_new (
                    messageId INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL,
                    channelId INTEGER,
                    authorId TEXT,
                    messageTxId TEXT UNIQUE,
                    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                    edited INTEGER NOT NULL DEFAULT 0,
                    attachments TEXT DEFAULT "[]",
                    replyTo INTEGER,
                    FOREIGN KEY (channelId) REFERENCES channels(channelId) ON DELETE CASCADE,
                    FOREIGN KEY (authorId) REFERENCES members(userId) ON DELETE SET NULL,
                    FOREIGN KEY (replyTo) REFERENCES messages_new(messageId) ON DELETE SET NULL
                );
            ]])

            -- Copy data from old table to new table
            db:exec([[
                INSERT INTO messages_new (messageId, content, channelId, authorId, messageTxId, timestamp, edited, attachments)
                SELECT id, content, channel_id, author_id,
                       COALESCE(msg_id, 'msg_' || id),
                       timestamp, edited, '[]'
                FROM messages;
            ]])

            -- Drop old table and rename new one
            db:exec("DROP TABLE messages")
            db:exec("ALTER TABLE messages_new RENAME TO messages")
        else
            -- Add new columns if they don't exist in already migrated table
            if not column_exists("messages", "attachments") then
                db:exec("ALTER TABLE messages ADD COLUMN attachments TEXT DEFAULT '[]'")
            end
            if not column_exists("messages", "replyTo") then
                db:exec(
                    "ALTER TABLE messages ADD COLUMN replyTo INTEGER REFERENCES messages(messageId) ON DELETE SET NULL")
            end
        end
    end
end

-- Run migration before creating tables
migrate_tables()

db:exec([[
    CREATE TABLE IF NOT EXISTS categories (
        categoryId INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        orderId INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS channels (
        channelId INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        orderId INTEGER NOT NULL DEFAULT 1,
        categoryId INTEGER,
        FOREIGN KEY (categoryId) REFERENCES categories(categoryId) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS members (
        userId TEXT PRIMARY KEY,
        nickname TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
        messageId INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        channelId INTEGER,
        authorId TEXT,
        messageTxId TEXT UNIQUE,
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        edited INTEGER NOT NULL DEFAULT 0,
        attachments TEXT DEFAULT "[]",
        replyTo INTEGER,
        FOREIGN KEY (channelId) REFERENCES channels(channelId) ON DELETE CASCADE,
        FOREIGN KEY (authorId) REFERENCES members(userId) ON DELETE SET NULL,
        FOREIGN KEY (replyTo) REFERENCES messages(messageId) ON DELETE SET NULL
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
local c_cat = SQLRead("SELECT COUNT(*) as count FROM categories")[1].count
local c_chn = SQLRead("SELECT COUNT(*) as count FROM channels")[1].count

if c_cat == 0 and c_chn == 0 then
    SQLWrite("INSERT INTO categories (name) VALUES ('Text Channels')")
    SQLWrite("INSERT INTO channels (name, categoryId) VALUES ('General', 1)")
end

function isOwner(id)
    return id == Owner
end

function VarOrNil(var)
    return var ~= "" and var or nil
end

function GetProfile(id)
    local profile = SQLRead("SELECT * FROM members WHERE userId = ?", id)
    if #profile == 1 then
        return profile[1]
    end
    return nil
end

app.get("/", function(req, res)
    local categories = SQLRead("SELECT * FROM categories ORDER BY orderId ASC")
    local channels = SQLRead("SELECT * FROM channels ORDER BY categoryId, orderId ASC")
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
        version = version
    })
end)

app.get("/single-member", function(req, res)
    local userId = req.body.userId

    local member = GetProfile(userId)
    if member then
        res:json(member)
    else
        res:status(404):json({ error = "Member not found" })
    end
end)

app.get("/get-members", function(req, res)
    local members = SQLRead("SELECT * FROM members")
    res:json(members)
end)

app.post("/update-server", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    assert(isOwner(userId), "You are not the owner of this server")
    local name = VarOrNil(req.body.name)
    local icon = VarOrNil(req.body.icon)

    server_name = name or server_name
    server_icon = icon or server_icon

    res:json({})
end)

app.post("/create-category", function(req, res)
    local id = req.msg.From
    id = TranslateDelegation(id)
    assert(isOwner(id), "You are not the owner of this server")
    local name = req.body.name
    local orderId = req.body.orderId or 0

    db:exec("BEGIN TRANSACTION")
    local success = true

    if orderId > 0 then
        -- Make room for the new category
        SQLWrite([[
            UPDATE categories SET orderId = orderId + 1
            WHERE orderId >= ?
        ]], orderId)
    else
        -- Place at the end
        local max_order = SQLRead("SELECT MAX(orderId) as maxOrder FROM categories")
        orderId = 1
        if max_order and #max_order > 0 and max_order[1].maxOrder then
            orderId = max_order[1].maxOrder + 1
        end
    end

    local rows_updated = SQLWrite(
        "INSERT INTO categories (name, orderId) VALUES (?, ?)",
        name, orderId
    )

    if rows_updated ~= 1 then
        success = false
    end

    local categoryId = db:last_insert_rowid()

    -- Resequence to clean up any gaps
    if success then
        resequence_categories()
    end

    if success then
        db:exec("COMMIT")
        res:json({
            categoryId = categoryId
        })
    else
        db:exec("ROLLBACK")
        res:status(500):json({
            error = "Failed to create category " .. db:errmsg()
        })
    end
end)

app.post("/update-category", function(req, res)
    local from = req.msg.From
    from = TranslateDelegation(from)
    assert(isOwner(from), "You are not the owner of this server")
    local categoryId = req.body.categoryId
    local name = VarOrNil(req.body.name)
    local orderId = VarOrNil(req.body.orderId)

    db:exec("BEGIN TRANSACTION")
    local success = true

    -- Get current category
    local current = SQLRead("SELECT * FROM categories WHERE categoryId = ?", categoryId)
    if #current == 0 then
        db:exec("ROLLBACK")
        return res:status(404):json({
            error = "Category not found"
        })
    end

    local current_order = current[1].orderId

    -- If just updating name (simpler case)
    if name and not orderId then
        local rows = SQLWrite("UPDATE categories SET name = ? WHERE categoryId = ?", name, categoryId)
        if rows ~= 1 then
            success = false
        end
    else
        -- Handle ordering changes
        if orderId and orderId ~= current_order then
            if orderId < current_order then
                -- Moving up
                SQLWrite([[
                    UPDATE categories
                    SET orderId = orderId + 1
                    WHERE orderId >= ? AND orderId < ? AND categoryId != ?
                ]], orderId, current_order, categoryId)
            else
                -- Moving down
                SQLWrite([[
                    UPDATE categories
                    SET orderId = orderId - 1
                    WHERE orderId > ? AND orderId <= ? AND categoryId != ?
                ]], current_order, orderId, categoryId)

                -- Adjust for shift
                orderId = orderId - 1
            end
        end

        -- Update the category
        local query = "UPDATE categories SET "
        local params = {}

        if name then
            query = query .. "name = ?, "
            table.insert(params, name)
        end

        if orderId then
            query = query .. "orderId = ?, "
            table.insert(params, orderId)
        end

        query = query:gsub(", $", "") .. " WHERE categoryId = ?"
        table.insert(params, categoryId)

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
        res:json({})
    else
        db:exec("ROLLBACK")
        res:status(500):json({
            error = "Failed to update category " .. db:errmsg()
        })
    end
end)

app.post("/delete-category", function(req, res)
    local from = req.msg.From
    from = TranslateDelegation(from)
    assert(isOwner(from), "You are not the owner of this server")
    local categoryId = req.body.categoryId
    local rows_updated = SQLWrite("DELETE FROM categories WHERE categoryId = ?", categoryId)
    if rows_updated == 1 then
        local channels_updated = SQLWrite("UPDATE channels SET categoryId = NULL WHERE categoryId = ?", categoryId)
        res:json({
            channelsUpdated = channels_updated
        })
    else
        res:status(500):json({
            error = "Failed to delete category " .. db:errmsg()
        })
    end
end)

------------------------------------------------------------------------

app.post("/create-channel", function(req, res)
    local from = req.msg.From
    from = TranslateDelegation(from)
    assert(isOwner(from), "You are not the owner of this server")
    local name = req.body.name
    local categoryId = VarOrNil(req.body.parentCategoryId)
    local orderId = tonumber(req.body.orderId) or 0

    db:exec("BEGIN TRANSACTION")
    local success = true

    -- Determine the order for the new channel
    local new_order

    if orderId then
        new_order = orderId

        -- Make room for the new channel
        if categoryId then
            SQLWrite([[
                UPDATE channels SET orderId = orderId + 1
                WHERE categoryId = ? AND orderId >= ?
            ]], categoryId, new_order)
        else
            SQLWrite([[
                UPDATE channels SET orderId = orderId + 1
                WHERE categoryId IS NULL AND orderId >= ?
            ]], new_order)
        end
    else
        -- Always determine the next available orderId regardless of whether order was specified
        if categoryId then
            local max_order = SQLRead([[
                SELECT MAX(orderId) as maxOrder FROM channels
                WHERE categoryId = ?
            ]], categoryId)

            new_order = 1 -- Default if no channels in target category
            if max_order and #max_order > 0 and max_order[1].maxOrder then
                new_order = max_order[1].maxOrder + 1
            end
        else
            local max_order = SQLRead([[
                SELECT MAX(orderId) as maxOrder FROM channels
                WHERE categoryId IS NULL
            ]])

            new_order = 1 -- Default if no uncategorized channels
            if max_order and #max_order > 0 and max_order[1].maxOrder then
                new_order = max_order[1].maxOrder + 1
            end
        end
    end

    print("Creating channel with orderId: " .. new_order)

    -- Insert the new channel
    local rows_updated
    if categoryId then
        rows_updated = SQLWrite(
            "INSERT INTO channels (name, categoryId, orderId) VALUES (?, ?, ?)",
            name, categoryId, new_order
        )
    else
        rows_updated = SQLWrite(
            "INSERT INTO channels (name, orderId) VALUES (?, ?)",
            name, new_order
        )
    end

    if rows_updated ~= 1 then
        success = false
    end

    local channelId = db:last_insert_rowid()

    -- Resequence to clean up any gaps
    if success and categoryId then
        resequence_channels(categoryId)
    elseif success then
        resequence_channels(nil)
    end

    if success then
        db:exec("COMMIT")
        res:json({
            channelId = channelId,
            orderId = new_order
        })
    else
        db:exec("ROLLBACK")
        res:status(500):json({
            error = "Failed to create channel " .. db:errmsg()
        })
    end
end)

app.post("/update-channel", function(req, res)
    local from = req.msg.From
    from = TranslateDelegation(from)
    assert(isOwner(from), "You are not the owner of this server")
    local channelId = req.body.channelId
    local name = VarOrNil(req.body.name)
    local categoryId = VarOrNil(req.body.parentCategoryId)
    local orderId = VarOrNil(req.body.orderId)

    db:exec("BEGIN TRANSACTION")
    local success = true

    -- First, get the current channel details
    local current = SQLRead("SELECT * FROM channels WHERE channelId = ?", channelId)
    if #current == 0 then
        db:exec("ROLLBACK")
        return res:status(404):json({
            error = "Channel not found"
        })
    end

    -- Keep track of what fields we're updating
    local updating_name = name ~= nil
    local updating_category = categoryId ~= nil
    local updating_order = orderId ~= nil

    -- Get current values
    local current_name = current[1].name
    local current_categoryId = current[1].categoryId
    local current_order = current[1].orderId

    -- Target category (what we're moving to)
    local target_categoryId = current_categoryId
    if updating_category then
        if categoryId == "" then
            target_categoryId = nil -- Set to NULL
        else
            target_categoryId = categoryId
        end
    end

    -- Check if we're changing category
    local changing_category = updating_category and (
        (target_categoryId == nil and current_categoryId ~= nil) or
        (target_categoryId ~= nil and current_categoryId == nil) or
        (target_categoryId ~= nil and current_categoryId ~= nil and
            tostring(target_categoryId) ~= tostring(current_categoryId))
    )

    -- If only updating name, that's a simple update
    if updating_name and not updating_category and not updating_order then
        local rows = SQLWrite("UPDATE channels SET name = ? WHERE channelId = ?", name, channelId)
        if rows ~= 1 then success = false end
    else
        -- Handle the more complex updates with ordering

        -- STEP 1: If we're changing category, fix the old category's order
        if changing_category then
            print("Changing category from " .. (current_categoryId or "NULL") ..
                " to " .. (target_categoryId or "NULL"))

            -- Update all channels with higher order in old category to fill the gap
            if current_categoryId ~= nil then
                SQLWrite([[
                    UPDATE channels
                    SET orderId = orderId - 1
                    WHERE categoryId = ? AND orderId > ?
                ]], current_categoryId, current_order)
            else
                -- For channels with NULL categoryId
                SQLWrite([[
                    UPDATE channels
                    SET orderId = orderId - 1
                    WHERE categoryId IS NULL AND orderId > ?
                ]], current_order)
            end
        end

        -- STEP 2: Determine the new order for this channel
        local new_order = current_order
        if updating_order then
            new_order = orderId
        else
            -- If not explicitly changing order but changing category,
            -- place at the end of the new category
            if changing_category then
                if target_categoryId ~= nil then
                    local max_order = SQLRead([[
                        SELECT MAX(orderId) as maxOrder FROM channels
                        WHERE categoryId = ?
                    ]], target_categoryId)

                    new_order = 1 -- Default if no channels in target category
                    if max_order and #max_order > 0 and max_order[1].maxOrder then
                        new_order = max_order[1].maxOrder + 1
                    end
                else
                    -- Moving to uncategorized
                    local max_order = SQLRead([[
                        SELECT MAX(orderId) as maxOrder FROM channels
                        WHERE categoryId IS NULL
                    ]])

                    new_order = 1 -- Default if no uncategorized channels
                    if max_order and #max_order > 0 and max_order[1].maxOrder then
                        new_order = max_order[1].maxOrder + 1
                    end
                end
            end
        end

        -- STEP 3: Make room at the new position in the target category
        if target_categoryId ~= nil then
            -- Only shift if we're staying in the same category and new_order <= current_order,
            -- or if we're changing category
            if (not changing_category and new_order < current_order) or changing_category then
                -- Shift up all channels at or after the target position
                SQLWrite([[
                    UPDATE channels
                    SET orderId = orderId + 1
                    WHERE categoryId = ? AND orderId >= ? AND channelId != ?
                ]], target_categoryId, new_order, channelId)
            elseif not changing_category and new_order > current_order then
                -- Moving down in same category - adjust for the shift that will happen
                new_order = new_order - 1
            end
        else
            -- Target is NULL category
            if (not changing_category and new_order < current_order) or changing_category then
                SQLWrite([[
                    UPDATE channels
                    SET orderId = orderId + 1
                    WHERE categoryId IS NULL AND orderId >= ? AND channelId != ?
                ]], new_order, channelId)
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

        -- Always update orderId
        update_query = update_query .. "orderId = ?, "
        table.insert(params, new_order)

        if updating_category then
            if target_categoryId == nil then
                update_query = update_query .. "categoryId = NULL, "
            else
                update_query = update_query .. "categoryId = ?, "
                table.insert(params, target_categoryId)
            end
        end

        -- Remove trailing comma and add WHERE clause
        update_query = update_query:gsub(", $", "") .. " WHERE channelId = ?"
        table.insert(params, channelId)

        local rows = SQLWrite(update_query, table.unpack(params))
        if rows ~= 1 then success = false end

        -- STEP 5: Remove any gaps in orderId sequence
        -- Resequence the category we moved from (if changing)
        if changing_category and current_categoryId ~= nil then
            resequence_channels(current_categoryId)
        elseif changing_category and current_categoryId == nil then
            resequence_channels(nil) -- Resequence NULL category
        end

        -- Resequence the category we moved to (if different)
        if changing_category and target_categoryId ~= nil then
            resequence_channels(target_categoryId)
        elseif changing_category and target_categoryId == nil then
            resequence_channels(nil) -- Resequence NULL category
        elseif not changing_category then
            -- Also resequence current category if just changing order
            resequence_channels(current_categoryId)
        end
    end

    if success then
        db:exec("COMMIT")
        res:json({})
    else
        db:exec("ROLLBACK")
        res:status(500):json({
            error = "Failed to update channel " .. db:errmsg()
        })
    end
end)

app.post("/delete-channel", function(req, res)
    local from = req.msg.From
    from = TranslateDelegation(from)
    assert(isOwner(from), "You are not the owner of this server")
    local channelId = req.body.channelId
    local rows_updated = SQLWrite("DELETE FROM channels WHERE channelId = ?", channelId)
    if rows_updated == 1 then
        local messages_deleted = SQLWrite("DELETE FROM messages WHERE channelId = ?", channelId)
        res:json({
            messagesDeleted = messages_deleted
        })
    else
        res:status(500):json({
            error = "Failed to delete channel " .. db:errmsg()
        })
    end
end)

------------------------------------------------------------------------

app.get("/get-messages", function(req, res)
    local channelId = req.body.channelId
    local limit = VarOrNil(req.body.limit) or 100
    local before = VarOrNil(req.body.before)
    local after = VarOrNil(req.body.after)

    if before and after then
        before = nil
    end

    if before then
        if before > 0 then
            before = tonumber(before)
        else
            before = nil
        end
    end

    if after then
        if after > 0 then
            after = tonumber(after)
        else
            after = nil
        end
    end

    local query = "SELECT * FROM messages WHERE channelId = ?"
    local params = { channelId }

    if before then
        before = tonumber(before)
        query = query .. " AND messageId < ?"
        table.insert(params, before)
    end

    if after then
        after = tonumber(after)
        query = query .. " AND messageId > ?"
        table.insert(params, after)
    end

    query = query .. " ORDER BY messageId DESC LIMIT ?"
    table.insert(params, limit)

    local messages = SQLRead(query, table.unpack(params))
    res:json(messages)
end)

app.post("/send-message", function(req, res)
    local authorId = req.msg.From
    authorId = TranslateDelegation(authorId)
    local timestamp = req.msg.Timestamp
    local messageTxId = req.msg.Id
    local content = req.body.content
    local channelId = tonumber(req.body.channelId)
    local attachments = VarOrNil(req.body.attachments) or "[]"
    local replyTo = VarOrNil(req.body.replyTo)

    print(attachments)

    -- check if author is a member of the server
    local profile = GetProfile(authorId)
    if not profile then
        res:status(403):json({
            error = "You are not a member of this server"
        })
        return
    end

    -- Extract mentions from content
    -- mention format <@userID>
    local mentions = {}
    for name, address in content:gmatch("@%[([^%]]+)%]%(([^%)]+)%)") do
        mentions[name] = address
    end

    -- check if channel exists
    local channel = SQLRead("SELECT * FROM channels WHERE channelId = ?", channelId)
    if not channel or #channel == 0 then
        res:status(404):json({
            error = "Channel not found"
        })
        return
    end

    local rows_updated = SQLWrite(
        "INSERT INTO messages (content, channelId, authorId, timestamp, messageTxId, attachments, replyTo) VALUES (?, ?, ?, ?, ?, ?, ?)",
        content, channelId, authorId, timestamp, messageTxId, json.encode(attachments), replyTo)
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
                    Channel_ID = tostring(channelId),
                    Message_ID = messageTxId,
                    Author_ID = authorId,
                    Author_Name = tostring(profile.nickname or authorId),
                    Content = content,
                    Channel_Name = channel[1].name,
                    Server_Name = server_name,
                    Timestamp = tostring(timestamp)
                }
            })
        end

        res:json({})
    else
        res:status(500):json({
            error = "Failed to send message " .. db:errmsg()
        })
    end
end)

app.post("/edit-message", function(req, res)
    local messageId = req.body.messageId
    local content = VarOrNil(req.body.content)
    local editor = req.msg.From
    editor = TranslateDelegation(editor)

    if not content then
        res:status(400):json({
            error = "Content is required"
        })
        return
    end

    local profile = GetProfile(editor)
    if not profile then
        res:status(403):json({
            error = "You are not a member of this server"
        })
        return
    end

    local original_message = SQLRead("SELECT * FROM messages WHERE messageId = ?", messageId)
    if #original_message == 1 then
        original_message = original_message[1]
        if original_message.authorId == editor then
            local rows_updated = SQLWrite("UPDATE messages SET content = ?, edited = 1 WHERE messageId = ?", content,
                messageId)
            if rows_updated == 1 then
                res:json({})
            else
                res:status(500):json({
                    error = "Failed to edit message " .. db:errmsg()
                })
            end
        else
            res:status(403):json({
                error = "You are not the author of this message"
            })
        end
    else
        res:status(404):json({
            error = "Message not found"
        })
    end
end)

-- This would be update-member later
app.post("/update-nickname", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local nickname = VarOrNil(req.body.nickname)

    if not nickname then
        res:status(400):json({
            error = "Nickname is required"
        })
        return
    end

    local profile = GetProfile(userId)
    if not profile then
        res:status(403):json({
            error = "You are not a member of this server"
        })
        return
    end

    -- Check if member exists
    local member = SQLRead("SELECT * FROM members WHERE userId = ?", userId)
    if not member or #member == 0 then
        -- Auto-register the member if they don't exist
        SQLWrite("INSERT INTO members (userId, nickname) VALUES (?, ?)", userId, nickname)
        res:json({})
        return
    end

    -- Update the nickname
    local rows_updated = SQLWrite("UPDATE members SET nickname = ? WHERE userId = ?", nickname, userId)
    if rows_updated == 1 then
        res:json({})
    else
        res:status(500):json({
            error = "Failed to update nickname " .. db:errmsg()
        })
    end
end)

app.post("/delete-message", function(req, res)
    local messageId = req.body.messageId
    local deleter = req.msg.From
    deleter = TranslateDelegation(deleter)
    local force_delete = isOwner(deleter)

    local profile = GetProfile(deleter)
    if not force_delete and not profile then
        res:status(403):json({
            error = "You are not a member of this server"
        })
        return
    end

    local original_message = SQLRead("SELECT * FROM messages WHERE messageId = ?", messageId)
    if #original_message == 1 then
        original_message = original_message[1]
        if force_delete or (original_message.authorId == deleter) then
            local rows_updated = SQLWrite("DELETE FROM messages WHERE messageId = ?", messageId)
            if rows_updated == 1 then
                res:json({})
            else
                res:status(500):json({
                    error = "Failed to delete message " .. db:errmsg()
                })
            end
        else
            res:status(403):json({
                error = "You are not the author of this message"
            })
        end
    else
        res:status(404):json({
            error = "Message not found"
        })
    end
end)

------------------------------------------------------------

Handlers.add("Add-Member", function(msg)
    assert(msg.From == PROFILES, "You are not authorized to add members to this server")
    local userId = msg.Tags.User
    local delegated_id = msg.Tags.delegated_id
    local original_id = msg.Tags.original_id

    -- Verify that the user is either the delegated_id or original_id
    if delegated_id and original_id then
        if userId ~= delegated_id and userId ~= original_id then
            return ao.send({
                Target = msg.From,
                Action = "Error",
                Data = "You are not authorized to add this member to this server",
                Tags = { User = userId }
            })
        end
        Delegations[delegated_id] = original_id
    end

    local rows_updated = SQLWrite("INSERT INTO members (userId) VALUES (?)", userId)
    if rows_updated == 1 then
        print("Added member " .. userId)
    else
        ao.send({
            Target = msg.From,
            Action = "Error",
            Data = db:errmsg(),
            Tags = {
                User = userId
            }
        })
    end
end)

Handlers.add("Remove-Member", function(msg)
    assert(msg.From == PROFILES, "You are not authorized to remove members from this server")
    local userId = msg.Tags.User
    local rows_updated = SQLWrite("DELETE FROM members WHERE userId = ?", userId)
    if rows_updated == 1 then
        print("Removed member " .. userId)
    else
        ao.send({
            Target = msg.From,
            Action = "Error",
            Data = db:errmsg(),
            Tags = {
                User = userId
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
function resequence_channels(categoryId)
    local channels

    if categoryId ~= nil then
        channels = SQLRead([[
            SELECT channelId FROM channels
            WHERE categoryId = ?
            ORDER BY orderId ASC
        ]], categoryId)
    else
        channels = SQLRead([[
            SELECT channelId FROM channels
            WHERE categoryId IS NULL
            ORDER BY orderId ASC
        ]])
    end

    -- Resequence starting from 1
    for i, channel in ipairs(channels) do
        if categoryId ~= nil then
            SQLWrite([[
                UPDATE channels SET orderId = ?
                WHERE channelId = ? AND categoryId = ?
            ]], i, channel.channelId, categoryId)
        else
            SQLWrite([[
                UPDATE channels SET orderId = ?
                WHERE channelId = ? AND categoryId IS NULL
            ]], i, channel.channelId)
        end
    end

    return #channels
end

-- Helper function to resequence all categories
function resequence_categories()
    local categories = SQLRead("SELECT categoryId FROM categories ORDER BY orderId ASC")

    -- Resequence starting from 1
    for i, category in ipairs(categories) do
        SQLWrite("UPDATE categories SET orderId = ? WHERE categoryId = ?", i, category.categoryId)
    end

    return #categories
end

app.listen()
