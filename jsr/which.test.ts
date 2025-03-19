import { test } from "@bearz/testing";
import { equal, ok } from "@bearz/assert";
import { globals, WIN } from "./globals.ts";
import { which, whichSync } from "./which.ts";

let rt = "node";
if (globals.Deno) {
    rt = "deno";
} else if (globals.Bun) {
    rt = "bun";
}
const RUNTIME = rt;

test("exec::which", async () => {
    switch (RUNTIME) {
        case "deno":
            {
                const exe = await which("deno");
                ok(exe);
                if (WIN) {
                    equal(exe.substring(exe.length - 8), "deno.exe");
                } else {
                    equal(exe.substring(exe.length - 4), "deno");
                }
            }
            break;

        case "node":
            {
                const exe = await which("node");
                ok(exe);
                if (WIN) {
                    equal(exe.substring(exe.length - 8), "node.exe");
                } else {
                    equal(exe.substring(exe.length - 4), "node");
                }
            }
            break;

        case "bun":
            {
                const exe = await which("bun");
                ok(exe);
                if (WIN) {
                    equal(exe.substring(exe.length - 7), "bun.exe");
                } else {
                    equal(exe.substring(exe.length - 3), "bun");
                }
            }
            break;
    }
});

test("exec::whichSync", () => {
    switch (RUNTIME) {
        case "deno":
            {
                const exe = whichSync("deno");
                ok(exe);
                if (WIN) {
                    equal(exe.substring(exe.length - 8), "deno.exe");
                } else {
                    equal(exe.substring(exe.length - 4), "deno");
                }
            }
            break;

        case "node":
            {
                const exe = whichSync("node");
                ok(exe);
                if (WIN) {
                    equal(exe.substring(exe.length - 8), "node.exe");
                } else {
                    equal(exe.substring(exe.length - 4), "node");
                }
            }
            break;

        case "bun":
            {
                const exe = whichSync("bun");
                ok(exe);
                if (WIN) {
                    equal(exe.substring(exe.length - 7), "bun.exe");
                } else {
                    equal(exe.substring(exe.length - 3), "bun");
                }
            }
            break;
    }
});
