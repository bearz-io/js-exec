import { dirname, fromFileUrl } from "jsr:@std/path@1";

const __dirname = dirname(fromFileUrl(import.meta.url));
const pwd = dirname(__dirname);

export async function deleteShim(path: string) {
    await Deno.remove(path);
}

export async function replaceGlobalsFile(path: string) {
    const content = `export const globals = globalThis;

export const WIN = globals.process && globals.process.platform === "win32" ||
    globals.navigator && globals.navigator.userAgent.includes("Windows");

export const DARWIN = globals.process && globals.process.platform === "darwin" ||
    globals.navigator && globals.navigator.userAgent.includes("Mac OS X");

export function loadChildProcess()  {
    if (globals.process && globals.process.getBuiltinModule) {
        return globals.process.getBuiltinModule("node:child_process");
    } else if (globals.Bun && typeof require !== "undefined") {
        try {
            return require("node:child_process");
        } catch (_) {
            // Ignore error
        }
    }

    return undefined;
}
`;

    await Deno.writeTextFile(path, content);
}

export async function replaceGlobalsTypeFile(path: string) {
    const content = `export declare const globals: typeof globalThis & Record<string, any>;

export declare const WIN: boolean;
export declare const DARWIN: boolean;

export declare function loadChildProcess(): typeof import("node:child_process") | undefined;
`;

    await Deno.writeTextFile(path, content);
}

await replaceGlobalsTypeFile(`${pwd}/npm/types/globals.d.ts`);
await replaceGlobalsFile(`${pwd}/npm/esm/globals.js`);
await deleteShim(`${pwd}/npm/esm/_dnt.shims.js`);
await deleteShim(`${pwd}/npm/types/_dnt.shims.d.ts`);
