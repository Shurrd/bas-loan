import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { ACCOUNTS } from "@/lib/constant";

export type Db = Database.Database;

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

export const openDatabase = (path = ":memory:") => {
    const db = new Database(path);
    db.defaultSafeIntegers(true);
    db.pragma("foreign_keys = ON");
    if (path !== ":memory:") db.pragma("journal_mode = WAL");
    db.exec(schema);

    const insertAccount = db.prepare(
        "INSERT OR IGNORE INTO accounts (code, name, type) VALUES (?, ?, ?)"
    );
    for (const [code, { name, type }] of Object.entries(ACCOUNTS)) {
        insertAccount.run(code, name, type);
    }
    return db;
};
