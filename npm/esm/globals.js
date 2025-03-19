export const globals = globalThis;

export const WIN = globals.process && globals.process.platform === "win32" ||
    globals.navigator && globals.navigator.userAgent.includes("Windows");

export const DARWIN = globals.process && globals.process.platform === "darwin" ||
    globals.navigator && globals.navigator.userAgent.includes("Mac OS X");

export function loadChildProcess() {
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
