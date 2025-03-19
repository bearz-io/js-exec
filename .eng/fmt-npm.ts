import { dirname, fromFileUrl } from "jsr:@std/path@1";

const __dirname = dirname(fromFileUrl(import.meta.url));
const pwd = dirname(__dirname);

const cmd = new Deno.Command("deno", {
    args: [
        "fmt",
        "--line-width",
        "100",
        "--indent-width",
        "4",
        "--no-config",
        `${pwd}/npm/esm`,
        `${pwd}/npm/types`,
    ],
    stdout: "inherit",
    stderr: "inherit",
    cwd: `${pwd}`,
});

const o = await cmd.output();
if (o.code !== 0) {
    throw new Error("Failed to run deno fmt");
}
