// deno-lint-ignore no-explicit-any
export const globals: typeof globalThis & Record<string, any> = globalThis as any;

export const WIN = globals.process && globals.process.platform === "win32" ||
    globals.navigator && globals.navigator.userAgent.includes("Windows");

export const DARWIN = globals.process && globals.process.platform === "darwin" ||
    globals.navigator && globals.navigator.userAgent.includes("Mac OS X");

export function loadChildProcess(): typeof import("node:child_process") | undefined {
    if (globals.process && globals.process.getBuiltinModule) {
        return globals.process.getBuiltinModule(
            "node:child_process",
        ) as typeof import("node:child_process");
    } else if (globals.Bun && typeof require !== "undefined") {
        try {
            return require("node:child_process") as typeof import("node:child_process");
        } catch (_) {
            // Ignore error
        }
    }

    return undefined;
}
