app = require("aoxpress")
sqlite3 = require("lsqlite3")
json = require("json")

db = db or sqlite3.open_memory()

db:exec([[
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER NOT NULL,
        withUser TEXT NOT NULL,
        author TEXT NOT NULL,
        content TEXT DEFAULT "",
        attachments TEXT DEFAULT "[]",
        timestamp INTEGER NOT NULL,
        replyTo INTEGER DEFAULT NULL,
        messageId INTEGER DEFAULT NULL,
        messageTxId TEXT DEFAULT NULL,
        edited INTEGER DEFAULT 0,
        PRIMARY KEY (id, withUser)
    );
]])
