import { dirname, fromFileUrl } from "jsr:@std/path@1";
import { expandGlob } from "jsr:@std/fs@1";

const __dirname = dirname(fromFileUrl(import.meta.url));
const pwd = dirname(__dirname);

for await (const entry of expandGlob(`${pwd}/npm/**/*.test.js`)) {
    console.log(`Running test: ${entry.path}`);
    const cmd = new Deno.Command("bun", {
        args: ["test", entry.path],
        stdout: "inherit",
        stderr: "inherit",
    });

    await cmd.output();
}
