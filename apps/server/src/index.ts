import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApp } from "@/app";
import { openDatabase } from "@/db";

const dbPath = process.env.DB_PATH ?? "data/lending.db";
const port = Number(process.env.PORT ?? 3001);
const clientDir = process.env.CLIENT_DIR;

mkdirSync(dirname(dbPath), { recursive: true });

const openOrExit = () => {
    try {
        return openDatabase(dbPath);
    } catch (error) {
        console.error(`API not started: ${(error as Error).message}`);
        process.exit(1);
    }
};

createApp(openOrExit(), { clientDir }).listen(port, () =>
    console.log(`API listening on http://localhost:${port}`)
);
