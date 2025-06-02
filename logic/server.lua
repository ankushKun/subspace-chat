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
    -- First, create any missing tables with basic structure
    if not table_exists("categories") then
        print("Creating categories table...")
        db:exec([[
            CREATE TABLE categories (
                categoryId INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                orderId INTEGER NOT NULL DEFAULT 1
            );
        ]])
    end

    if not table_exists("channels") then
        print("Creating channels table...")
        db:exec([[
            CREATE TABLE channels (
                channelId INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                orderId INTEGER NOT NULL DEFAULT 1,
                categoryId INTEGER,
                FOREIGN KEY (categoryId) REFERENCES categories(categoryId) ON DELETE SET NULL
            );
        ]])
    end

    if not table_exists("members") then
        print("Creating members table...")
        db:exec([[
            CREATE TABLE members (
                userId TEXT PRIMARY KEY,
                nickname TEXT,
                roles TEXT DEFAULT "[]"
            );
        ]])
    end

    if not table_exists("messages") then
        print("Creating messages table...")
        db:exec([[
            CREATE TABLE messages (
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
    end

    if not table_exists("roles") then
        print("Creating roles table...")
        db:exec([[
            CREATE TABLE roles (
                roleId INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                orderId INTEGER NOT NULL DEFAULT 1,
                color TEXT NOT NULL,
                permissions INTEGER NOT NULL DEFAULT 0
            );
        ]])
    end

    -- Now handle existing tables and add missing columns

    -- Migrate categories table
    if table_exists("categories") then
        -- Add missing columns
        if not column_exists("categories", "orderId") then
            print("Adding orderId column to categories table...")
            db:exec("ALTER TABLE categories ADD COLUMN orderId INTEGER NOT NULL DEFAULT 1")
        end

        -- Handle column renames
        if column_exists("categories", "id") and not column_exists("categories", "categoryId") then
            print("Migrating categories table column names...")
            db:exec([[
                ALTER TABLE categories RENAME COLUMN id TO categoryId;
            ]])
        end
        if column_exists("categories", "order_id") and not column_exists("categories", "orderId") then
            db:exec([[
                ALTER TABLE categories RENAME COLUMN order_id TO orderId;
            ]])
        end
    end

    -- Migrate channels table
    if table_exists("channels") then
        -- Add missing columns
        if not column_exists("channels", "orderId") then
            print("Adding orderId column to channels table...")
            db:exec("ALTER TABLE channels ADD COLUMN orderId INTEGER NOT NULL DEFAULT 1")
        end
        if not column_exists("channels", "categoryId") then
            print("Adding categoryId column to channels table...")
            db:exec(
                "ALTER TABLE channels ADD COLUMN categoryId INTEGER REFERENCES categories(categoryId) ON DELETE SET NULL")
        end

        -- Handle column renames
        if column_exists("channels", "id") and not column_exists("channels", "channelId") then
            print("Migrating channels table column names...")
            db:exec([[
                ALTER TABLE channels RENAME COLUMN id TO channelId;
            ]])
        end
        if column_exists("channels", "order_id") and not column_exists("channels", "orderId") then
            db:exec([[
                ALTER TABLE channels RENAME COLUMN order_id TO orderId;
            ]])
        end
        if column_exists("channels", "category_id") and not column_exists("channels", "categoryId") then
            db:exec([[
                ALTER TABLE channels RENAME COLUMN category_id TO categoryId;
            ]])
        end
    end

    -- Migrate members table
    if table_exists("members") then
        -- Add missing columns
        if not column_exists("members", "nickname") then
            print("Adding nickname column to members table...")
            db:exec("ALTER TABLE members ADD COLUMN nickname TEXT")
        end
        if not column_exists("members", "roles") then
            print("Adding roles column to members table...")
            db:exec("ALTER TABLE members ADD COLUMN roles TEXT DEFAULT '[]'")
        end

        -- Handle column renames
        if column_exists("members", "id") and not column_exists("members", "userId") then
            print("Migrating members table column names...")
            db:exec([[
                ALTER TABLE members RENAME COLUMN id TO userId;
            ]])
        end

        -- Migrate roles field from full role objects to role IDs
        local members_with_roles = SQLRead("SELECT userId, roles FROM members WHERE roles IS NOT NULL AND roles != '[]'")
        if #members_with_roles > 0 then
            print("Migrating member roles from objects to IDs...")
            for _, member in ipairs(members_with_roles) do
                local roles = json.decode(member.roles or "[]") or {}
                local roleIds = {}
                local needsMigration = false

                -- Check if roles are stored as objects (old format) or IDs (new format)
                for _, role in ipairs(roles) do
                    if type(role) == "table" and role.roleId then
                        -- Old format: role is an object with roleId field
                        table.insert(roleIds, role.roleId)
                        needsMigration = true
                    elseif type(role) == "number" then
                        -- New format: role is just an ID
                        table.insert(roleIds, role)
                    end
                end

                -- Only update if migration is needed
                if needsMigration then
                    local newRolesString = json.encode(roleIds)
                    SQLWrite("UPDATE members SET roles = ? WHERE userId = ?", newRolesString, member.userId)
                    print("Migrated roles for member: " .. member.userId)
                end
            end
        end
    end

    -- Migrate messages table (more complex due to foreign keys)
    if table_exists("messages") then
        -- Add missing columns to existing messages table
        if not column_exists("messages", "attachments") then
            print("Adding attachments column to messages table...")
            db:exec("ALTER TABLE messages ADD COLUMN attachments TEXT DEFAULT '[]'")
        end
        if not column_exists("messages", "replyTo") then
            print("Adding replyTo column to messages table...")
            db:exec("ALTER TABLE messages ADD COLUMN replyTo INTEGER REFERENCES messages(messageId) ON DELETE SET NULL")
        end
        if not column_exists("messages", "messageTxId") then
            print("Adding messageTxId column to messages table...")
            db:exec("ALTER TABLE messages ADD COLUMN messageTxId TEXT UNIQUE")
        end
        if not column_exists("messages", "edited") then
            print("Adding edited column to messages table...")
            db:exec("ALTER TABLE messages ADD COLUMN edited INTEGER NOT NULL DEFAULT 0")
        end

        -- Handle complex column renames (requires table recreation)
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
                SELECT id, content,
                       COALESCE(channel_id, channelId),
                       COALESCE(author_id, authorId),
                       COALESCE(msg_id, messageTxId, 'msg_' || id),
                       timestamp,
                       COALESCE(edited, 0),
                       COALESCE(attachments, '[]')
                FROM messages;
            ]])

            -- Drop old table and rename new one
            db:exec("DROP TABLE messages")
            db:exec("ALTER TABLE messages_new RENAME TO messages")
        end
    end

    -- Migrate roles table
    if table_exists("roles") then
        -- Add missing columns
        if not column_exists("roles", "orderId") then
            print("Adding orderId column to roles table...")
            db:exec("ALTER TABLE roles ADD COLUMN orderId INTEGER NOT NULL DEFAULT 1")
        end
        if not column_exists("roles", "color") then
            print("Adding color column to roles table...")
            db:exec("ALTER TABLE roles ADD COLUMN color TEXT NOT NULL DEFAULT '#696969'")
        end
        if not column_exists("roles", "permissions") then
            print("Adding permissions column to roles table...")
            db:exec("ALTER TABLE roles ADD COLUMN permissions INTEGER NOT NULL DEFAULT 0")
        end

        -- Handle column renames
        if column_exists("roles", "id") and not column_exists("roles", "roleId") then
            print("Migrating roles table column names...")
            db:exec("ALTER TABLE roles RENAME COLUMN id TO roleId")
        end
        if column_exists("roles", "order_id") and not column_exists("roles", "orderId") then
            db:exec("ALTER TABLE roles RENAME COLUMN order_id TO orderId")
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
        nickname TEXT,
        roles TEXT DEFAULT "[]"
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

    CREATE TABLE IF NOT EXISTS roles (
        roleId INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        orderId INTEGER NOT NULL DEFAULT 1,
        color TEXT NOT NULL,
        permissions INTEGER NOT NULL DEFAULT 0
    );
]])

Permissions = {
    SEND_MESSAGES = 1 << 0,    -- 1
    MANAGE_NICKNAMES = 1 << 1, -- 2
    DELETE_MESSAGES = 1 << 2,  -- 4
    KICK_MEMBERS = 1 << 3,     -- 8
    BAN_MEMBERS = 1 << 4,      -- 16
    MANAGE_CHANNELS = 1 << 5,  -- 32
    MANAGE_SERVER = 1 << 6,    -- 64
    MANAGE_ROLES = 1 << 7,     -- 128
    MANAGE_MEMBERS = 1 << 8,   -- 256
    MENTION_EVERYONE = 1 << 9, -- 512
    ADMINISTRATOR = 1 << 10,   -- 1024
}

function GetPermissions(sum_perms)
    local perms = {}
    for perm, value in pairs(Permissions) do
        if sum_perms & value ~= 0 then
            table.insert(perms, perm)
        end
    end
    return perms
end

function HasPermission(sum_perms, perm)
    return sum_perms & perm == perm
end

function GetRole(roleId)
    local role = SQLRead("SELECT * FROM roles WHERE roleId = ?", roleId)
    if #role == 1 then
        return role[1]
    end
    return nil
end

function MemberHasPermission(member, perm)
    if isOwner(member.userId) then
        return true
    end

    local roles = json.decode(member.roles or "[]") or {}
    if #roles == 0 then
        return HasPermission(0, perm)
    end
    for _, roleId in ipairs(roles) do
        local role = GetRole(roleId)
        if role and HasPermission(role.permissions, perm) then
            return true
        end
    end
    return false
end

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
    local roles = SQLRead("SELECT * FROM roles ORDER BY orderId ASC")

    res:json({
        name = server_name,
        icon = server_icon,
        owner = Owner,
        categories = categories,
        channels = channels,
        member_count = member_count,
        roles = roles
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

app.get("/get-single-message", function(req, res)
    local messageId = VarOrNil(req.body.messageId)
    local messageTxId = VarOrNil(req.body.messageTxId)

    if not messageId and not messageTxId then
        res:status(400):json({
            error = "Either messageId or messageTxId is required"
        })
    end

    local message = nil

    if messageId then
        message = SQLRead("SELECT * FROM messages WHERE messageId = ?", messageId)
    elseif messageTxId then
        message = SQLRead("SELECT * FROM messages WHERE messageTxId = ?", messageTxId)
    end

    if not message or #message == 0 then
        res:status(404):json({
            error = "Message not found"
        })
        return
    end

    res:json(message[1])
end)

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

    local query = [[
        SELECT
            m.messageId,
            m.content,
            m.channelId,
            m.authorId,
            m.messageTxId,
            m.timestamp,
            m.edited,
            m.attachments,
            m.replyTo,
            rm.messageId as replyToMessageId,
            rm.content as replyToContent,
            rm.authorId as replyToAuthorId,
            rm.timestamp as replyToTimestamp,
            rm.edited as replyToEdited,
            rm.attachments as replyToAttachments
        FROM messages m
        LEFT JOIN messages rm ON m.replyTo = rm.messageId
        WHERE m.channelId = ?
    ]]
    local params = { channelId }

    if before then
        before = tonumber(before)
        query = query .. " AND m.messageId < ?"
        table.insert(params, before)
    end

    if after then
        after = tonumber(after)
        query = query .. " AND m.messageId > ?"
        table.insert(params, after)
    end

    query = query .. " ORDER BY m.messageId DESC LIMIT ?"
    table.insert(params, limit)

    local raw_messages = SQLRead(query, table.unpack(params))

    -- Restructure the response to include replied-to message as nested object
    local messages = {}
    for i, row in ipairs(raw_messages) do
        local message = {
            messageId = row.messageId,
            content = row.content,
            channelId = row.channelId,
            authorId = row.authorId,
            messageTxId = row.messageTxId,
            timestamp = row.timestamp,
            edited = row.edited,
            attachments = row.attachments,
            replyTo = row.replyTo
        }

        -- If this message is a reply and we have the replied-to message data
        if row.replyTo and row.replyToMessageId then
            message.replyToMessage = {
                messageId = row.replyToMessageId,
                content = row.replyToContent,
                authorId = row.replyToAuthorId,
                timestamp = row.replyToTimestamp,
                edited = row.replyToEdited,
                attachments = row.replyToAttachments
            }
        end

        table.insert(messages, message)
    end

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

    -- print(attachments)

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

    -- if replyTo is not nil, check if it is a valid messageId
    if replyTo then
        replyTo = tonumber(replyTo)
        local message = SQLRead("SELECT * FROM messages WHERE messageId = ?", replyTo)
        if not message or #message == 0 then
            res:status(404):json({
                error = "Reply to message not found"
            })
            return
        else
            -- the message is mentioning the author of the replied to message
            local replyAuthorId = message[1].authorId
            -- add the message to the mentions
            mentions[replyAuthorId] = replyAuthorId
        end
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
-- ROLES

app.get("/get-roles", function(req, res)
    local roles = SQLRead("SELECT * FROM roles ORDER BY orderId ASC")
    res:json(roles)
end)

app.get("/get-role", function(req, res)
    local roleId = req.body.roleId
    local role = SQLRead("SELECT * FROM roles WHERE roleId = ?", roleId)
    if not role or #role == 0 then
        res:status(404):json({
            error = "Role not found"
        })
        return
    end
    res:json(role[1])
end)

app.get("/get-role-members", function(req, res)
    local roleId = VarOrNil(req.body.roleId)

    if not roleId then
        res:status(400):json({
            error = "Role ID is required"
        })
        return
    end

    local members = SQLRead("SELECT * FROM members WHERE roles LIKE ?", "%" .. roleId .. "%")
    local membersWithRole = {}
    for _, member in ipairs(members) do
        local roles = json.decode(member.roles)
        if roles[roleId] then
            table.insert(membersWithRole, member)
        end
    end
    res:json(membersWithRole)
end)

app.post("/create-role", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local HasPermission = MemberHasPermission(GetProfile(userId), Permissions.MANAGE_ROLES)
    if not HasPermission then
        res:status(403):json({
            error = "You are not authorized to create roles"
        })
        return
    end

    local name = VarOrNil(req.body.name) or "New Role"
    local color = VarOrNil(req.body.color) or "#696969"
    local permissions = VarOrNil(req.body.permissions) or 1
    local orderId

    -- put the new role at bottom by default
    local c_roles = SQLRead("SELECT COUNT(*) as count FROM roles")[1].count
    orderId = c_roles + 1

    local rows_updated = SQLWrite("INSERT INTO roles (name, color, permissions, orderId) VALUES (?, ?, ?, ?)", name,
        color, permissions, orderId)
    if rows_updated == 1 then
        res:json({})
    else
        res:status(500):json({
            error = "Failed to create role " .. db:errmsg()
        })
    end
end)

app.post("/update-role", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)

    local hasPermission = MemberHasPermission(GetProfile(userId), Permissions.MANAGE_ROLES)
    if not hasPermission then
        res:status(403):json({
            error = "You are not authorized to update roles"
        })
        return
    end

    local roleId = req.body.roleId

    local role = SQLRead("SELECT * FROM roles WHERE roleId = ?", roleId)
    if not role or #role == 0 then
        res:status(404):json({
            error = "Role not found"
        })
        return
    end

    role = role[1]

    local name = VarOrNil(req.body.name) or role.name
    local color = VarOrNil(req.body.color) or role.color
    local permissions = tonumber(VarOrNil(req.body.permissions) or role.permissions)
    local orderId = tonumber(VarOrNil(req.body.orderId) or role.orderId)

    db:exec("BEGIN TRANSACTION")
    local success = true

    -- If just updating name, color, or permissions without changing order
    if not orderId then
        local rows = SQLWrite("UPDATE roles SET name = ?, color = ?, permissions = ? WHERE roleId = ?",
            name, color, permissions, roleId)
        if rows ~= 1 then
            success = false
        end
    else
        -- Handle ordering changes
        local current_order = role.orderId

        if orderId ~= current_order then
            if orderId < current_order then
                -- Moving up in order
                SQLWrite([[
                    UPDATE roles
                    SET orderId = orderId + 1
                    WHERE orderId >= ? AND orderId < ? AND roleId != ?
                ]], orderId, current_order, roleId)
            else
                -- Moving down in order
                SQLWrite([[
                    UPDATE roles
                    SET orderId = orderId - 1
                    WHERE orderId > ? AND orderId <= ? AND roleId != ?
                ]], current_order, orderId, roleId)

                -- Adjust for shift
                orderId = orderId - 1
            end
        end

        -- Update the role with all fields
        local rows = SQLWrite("UPDATE roles SET name = ?, color = ?, permissions = ?, orderId = ? WHERE roleId = ?",
            name, color, permissions, orderId, roleId)
        if rows ~= 1 then
            success = false
        end

        -- Resequence to clean up any gaps
        if success then
            resequence_roles()
        end
    end

    if success then
        db:exec("COMMIT")
        res:json({})
    else
        db:exec("ROLLBACK")
        res:status(500):json({
            error = "Failed to update role " .. db:errmsg()
        })
    end
end)

app.post("/delete-role", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local hasPermission = MemberHasPermission(GetProfile(userId), Permissions.MANAGE_ROLES)
    if not hasPermission then
        res:status(403):json({
            error = "You are not authorized to delete roles"
        })
        return
    end

    local roleId = req.body.roleId

    db:exec("BEGIN TRANSACTION")
    local success = true

    local rows_updated = SQLWrite("DELETE FROM roles WHERE roleId = ?", roleId)
    if rows_updated == 1 then
        -- update all members that have this role in their roles list
        local members = SQLRead("SELECT * FROM members WHERE roles LIKE ?", "%" .. roleId .. "%")
        local usersUpdated = 0
        for _, member in ipairs(members) do
            local roles = json.decode(member.roles or "[]") or {}
            for i, role in ipairs(roles) do
                if role.roleId == roleId then
                    table.remove(roles, i)
                    break
                end
            end
            local updatedRolesString
            if #roles == 0 then
                updatedRolesString = "[]"
            else
                updatedRolesString = json.encode(roles)
            end
            local rows_updated_1 = SQLWrite("UPDATE members SET roles = ? WHERE userId = ?", updatedRolesString,
                member.userId)
            usersUpdated = usersUpdated + rows_updated_1
        end

        -- Resequence roles to fill the gap
        resequence_roles()

        db:exec("COMMIT")
        res:json({
            usersUpdated = usersUpdated
        })
    else
        db:exec("ROLLBACK")
        res:status(500):json({
            error = "Failed to delete role " .. db:errmsg()
        })
    end
end)

app.post("/assign-role", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local hasPermission = MemberHasPermission(GetProfile(userId), Permissions.MANAGE_ROLES)
    if not hasPermission then
        res:status(403):json({
            error = "You are not authorized to assign roles"
        })
        return
    end

    local userIdToUpdate = req.body.userId
    local roleId = req.body.roleId

    local member = GetProfile(userIdToUpdate)
    if not member then
        res:status(404):json({
            error = "Member not found"
        })
        return
    end

    local role = SQLRead("SELECT * FROM roles WHERE roleId = ?", roleId)
    if not role or #role == 0 then
        res:status(404):json({
            error = "Role not found"
        })
        return
    end

    role = role[1]

    local roles = json.decode(member.roles or "[]") or {}
    for _, addingRoleId in ipairs(roles) do
        if addingRoleId == roleId then
            res:status(400):json({
                error = "Member already has this role"
            })
            return
        end
    end

    table.insert(roles, roleId)

    local updatedRolesString = json.encode(roles)
    local rows_updated = SQLWrite("UPDATE members SET roles = ? WHERE userId = ?", updatedRolesString, userIdToUpdate)
    if rows_updated == 1 then
        res:json({})
    else
        res:status(500):json({
            error = "Failed to assign role " .. db:errmsg()
        })
    end
end)

app.post("/unassign-role", function(req, res)
    local userId = req.msg.From
    userId = TranslateDelegation(userId)
    local hasPermission = MemberHasPermission(GetProfile(userId), Permissions.MANAGE_ROLES)
    if not hasPermission then
        res:status(403):json({
            error = "You are not authorized to unassign roles"
        })
        return
    end

    local userIdToUpdate = req.body.userId
    local roleId = req.body.roleId

    local member = GetProfile(userIdToUpdate)
    if not member then
        res:status(404):json({
            error = "Member not found"
        })
        return
    end

    local role = SQLRead("SELECT * FROM roles WHERE roleId = ?", roleId)
    if not role or #role == 0 then
        res:status(404):json({
            error = "Role not found"
        })
        return
    end

    role = role[1]

    local roles = json.decode(member.roles or "[]") or {}

    local removed = false
    for i, removingRoleId in ipairs(roles) do
        if removingRoleId == roleId then
            table.remove(roles, i)
            removed = true
            break
        end
    end

    if not removed then
        res:status(400):json({
            error = "Member does not have this role"
        })
        return
    end

    local updatedRolesString = json.encode(roles)
    local rows_updated = SQLWrite("UPDATE members SET roles = ? WHERE userId = ?", updatedRolesString, userIdToUpdate)
    if rows_updated == 1 then
        res:json({})
    else
        res:status(500):json({
            error = "Failed to unassign role " .. db:errmsg()
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

-- Helper function to resequence all roles
function resequence_roles()
    local roles = SQLRead("SELECT roleId FROM roles ORDER BY orderId ASC")

    -- Resequence starting from 1
    for i, role in ipairs(roles) do
        SQLWrite("UPDATE roles SET orderId = ? WHERE roleId = ?", i, role.roleId)
    end

    return #roles
end

app.listen()
