import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { ACCOUNTS } from "@/lib/constant";

export type Db = Database.Database;

// Bump when schema.sql changes in a way CREATE IF NOT EXISTS cannot apply to an old file
const SCHEMA_VERSION = 3;

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

export const openDatabase = (path = ":memory:") => {
    const db = new Database(path);
    db.defaultSafeIntegers(true);
    db.pragma("foreign_keys = ON");
    if (path !== ":memory:") db.pragma("journal_mode = WAL");

    const existing = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'loans'").get();
    const version = Number(db.pragma("user_version", { simple: true }));
    if (existing && version !== SCHEMA_VERSION) {
        db.close();
        throw new Error(
            `${path} was created by an older version of the app. Delete it and restart to create a fresh one.`
        );
    }

    db.exec(schema);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);

    const insertAccount = db.prepare(
        "INSERT OR IGNORE INTO accounts (code, name, type) VALUES (?, ?, ?)"
    );
    for (const [code, { name, type }] of Object.entries(ACCOUNTS)) {
        insertAccount.run(code, name, type);
    }
    return db;
};
