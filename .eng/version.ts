import { dirname, fromFileUrl } from "jsr:@std/path@1";
import { parseArgs } from "jsr:@std/cli@1";
import { format, parse } from "jsr:@std/semver@1";
const __dirname = dirname(fromFileUrl(import.meta.url));
const pwd = dirname(__dirname);

interface Options {
    bump?: boolean;
    major?: boolean;
    minor?: boolean;
    patch?: boolean;
    set?: string;
}

const options = parseArgs(Deno.args, {}) as Options;

interface DenoJson {
    name: string;
    version: string;
    description: string;
    keywords: string[];
    exports: Record<string, string>;
    imports: Record<string, string>;
}

const denoJson = JSON.parse(Deno.readTextFileSync(`${pwd}/deno.json`)) as DenoJson;

console.log("Current version: ", denoJson.version);
console.log("Options: ", options);

if (options.set) {
    denoJson.version = options.set;
    Deno.writeTextFileSync(`${pwd}/deno.json`, JSON.stringify(denoJson, null, 4));
    Deno.exit(0);
}

if (options.bump) {
    const version = parse(denoJson.version);
    if (options.major) {
        version.major++;
    }

    if (options.minor) {
        version.minor++;
    }

    if (options.patch) {
        version.patch++;
    }

    denoJson.version = format(version);
    Deno.writeTextFileSync(`${pwd}/deno.json`, JSON.stringify(denoJson, null, 4));
    Deno.exit(0);
}
