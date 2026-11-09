import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/db";
import { startTestServer } from "@/test-helpers";

describe("serving the built client", () => {
    let dir: string;
    let api: Awaited<ReturnType<typeof startTestServer>>;
    let url: string;

    beforeEach(async () => {
        dir = mkdtempSync(join(tmpdir(), "client-"));
        mkdirSync(join(dir, "assets"));
        writeFileSync(join(dir, "index.html"), "<!doctype html><div id=root></div>");
        writeFileSync(join(dir, "assets", "app-abc123.js"), "console.log('app')");
        writeFileSync(join(dir, "favicon.svg"), "<svg/>");

        api = await startTestServer(openDatabase(), { clientDir: dir });
        url = api.url;
    });

    afterEach(async () => {
        await api.close();
        rmSync(dir, { recursive: true, force: true });
    });

    it("serves the app at the root", async () => {
        const res = await fetch(`${url}/`);
        expect(res.status).toBe(200);
        expect(await res.text()).toContain("<div id=root>");
    });

    it("serves the same page for a deep link, so the client's router can handle it", async () => {
        for (const path of ["/loans", "/loans/1", "/loans/1/statement", "/invoices/2"]) {
            const res = await fetch(`${url}${path}`);
            expect(res.status, path).toBe(200);
            expect(await res.text(), path).toContain("<div id=root>");
        }
    });

    it("serves built files, and lets the hashed ones be cached for good", async () => {
        const asset = await fetch(`${url}/assets/app-abc123.js`);
        expect(asset.status).toBe(200);
        expect(await asset.text()).toBe("console.log('app')");
        expect(asset.headers.get("cache-control")).toBe(
            "public, max-age=31536000, immutable"
        );

        const icon = await fetch(`${url}/favicon.svg`);
        expect(icon.status).toBe(200);
        expect(await icon.text()).toBe("<svg/>");
    });

    it("does not let the page swallow the API", async () => {
        const list = await fetch(`${url}/api/loans`);
        expect(list.status).toBe(200);
        expect(await list.json()).toEqual([]);

        const unknown = await fetch(`${url}/api/nothing-here`);
        expect(unknown.status).toBe(404);
        expect(await unknown.text()).not.toContain("<div id=root>");
    });

    it("does not answer a POST to an unknown path with the page", async () => {
        const res = await fetch(`${url}/loans/1`, { method: "POST" });
        expect(res.status).toBe(404);
    });

    it("serves only the API when no client is given", async () => {
        const apiOnly = await startTestServer(openDatabase());
        const res = await fetch(`${apiOnly.url}/`);
        expect(res.status).toBe(404);
        await apiOnly.close();
    });
});
