import { test } from "@bearz/testing";
import { equal, ok } from "@bearz/assert";
import { splitArguments } from "./split_arguments.ts";

test("exec::splitArguments", () => {
    const args = splitArguments("deno run --allow-read mod.ts");
    console.log(args);
    ok(args.length === 4);
    ok(args[0] === "deno");
    ok(args[1] === "run");
    ok(args[2] === "--allow-read");
    ok(args[3] === "mod.ts");
});

test("exec::splitArguments with quotes", () => {
    const args = splitArguments('deno run --allow-read "mod.ts"');
    console.log(args);
    ok(args.length === 4);
    ok(args[0] === "deno");
    ok(args[1] === "run");
    ok(args[2] === "--allow-read");
    ok(args[3] === "mod.ts");
});

test("exec::splitArguments with escaped quotes", () => {
    const args = splitArguments('deno run --allow-read \\"mod.ts\\"');
    console.log(args);
    ok(args.length === 4);
    ok(args[0] === "deno");
    ok(args[1] === "run");
    ok(args[2] === "--allow-read");
    console.log(args[3]);
    equal(args[3], '\\"mod.ts\\"');
});

test("exec::splitArguments with quotes that has spaces", () => {
    const args = splitArguments('deno run --allow-read "path\\next folder\\mod.ts"');
    console.log(args.length);
    console.log(args);
    ok(args.length === 4);
    ok(args[0] === "deno");
    ok(args[1] === "run");
    ok(args[2] === "--allow-read");
    equal(args[3], "path\\next folder\\mod.ts");
});

test("exec::splitArguments with quotes that has spaces and escaped quotes", () => {
    const args = splitArguments('deno run --allow-read "path\\next folder\\\\"mod.ts\\"');

    console.log(args);
    ok(args[0] === "deno");
    ok(args[1] === "run");
    ok(args[2] === "--allow-read");
    equal(args[3], `path\\next folder\\"mod.ts"`);
});

test("exec::splitArguments with quotes", () => {
    const args = splitArguments("deno run --allow-read ' whatever i want '");
    console.log(args);
    ok(args.length === 4);
    ok(args[0] === "deno");
    ok(args[1] === "run");
    ok(args[2] === "--allow-read");
    ok(args[3] === " whatever i want ");
});
