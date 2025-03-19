import { dirname, fromFileUrl } from "jsr:@std/path@1";
import { build, emptyDir, type EntryPoint } from "jsr:@deno/dnt";

const __dirname = dirname(fromFileUrl(import.meta.url));
const pwd = dirname(__dirname);
Deno.chdir(`${pwd}/jsr`);

const content = Deno.readTextFileSync(`${pwd}/.git/config`);
const lines = content.split(/\r?\n/);
let url = lines.find((line) => line.includes("url"))?.split("=")[1].trim();

if (!url) {
    throw new Error("Could not find git url in .git/config");
}

if (url.startsWith("git@")) {
    url = url.replace(":", "/").replace("git@", "https://");
}
const bugsUrl = url.replace(".git", "/discussions");
await emptyDir("./npm");

interface DenoJson {
    name: string;
    version: string;
    description: string;
    keywords: string[];
    exports: Record<string, string>;
    imports: Record<string, string>;
}

const denoJson = JSON.parse(Deno.readTextFileSync(`${pwd}/jsr/deno.json`)) as DenoJson;
const entryPoints: Array<string | EntryPoint> = [];
for (const key of Object.keys(denoJson.exports)) {
    if (key == ".") {
        entryPoints.push({ name: ".", path: denoJson.exports[key] });
    } else {
        entryPoints.push({ name: key, path: denoJson.exports[key] });
    }
}

const deps: Record<string, string> = {
    "@bearz/chars": "^0.1.0",
    "@bearz/strings": "^0.1.3",
    "@bearz/env": "^0.1.3",
    "@bearz/fs": "^0.1.0",
    "@bearz/path": "^0.0.0",
};
const devDeps: Record<string, string> = {
    "@types/node": "^22.13.4",
    "@bearz/testing": "^0.0.0",
    "@bearz/assert": "^0.1.0",
};

await build({
    entryPoints: entryPoints,
    outDir: "../npm",
    declaration: "separate",
    esModule: true,
    shims: { deno: false },
    scriptModule: false,
    skipSourceOutput: true,
    compilerOptions: {
        "lib": ["ES2023.Collection", "ES2023"],
        "target": "ES2023",
        "skipLibCheck": true,
    },
    packageManager: "bun",
    package: {
        // package.json properties
        name: denoJson.name,
        version: denoJson.version,
        description: denoJson.description,
        keywords: denoJson.keywords,
        license: "MIT",
        authors: [{
            name: "jolt9dev",
            email: "dev@jolt9.com",
        }],
        scripts: {
            "test": "node --test",
            "test:bun": "bun test",
        },
        repository: {
            type: "git",
            url: `git+${url}`,
        },
        bugs: {
            url: bugsUrl,
        },
        homepage: "bearz.io",
        engines: {
            "node": ">=22",
        },
        type: "module",
        dependencies: deps,
        devDependencies: devDeps,
    },
    async postBuild() {
        // steps to run after building and before running the tests
        Deno.copyFileSync(`${pwd}/LICENSE.md`, `${pwd}/npm/LICENSE.md`);
        Deno.copyFileSync(`${pwd}/README.md`, `${pwd}/npm/README.md`);
        await import("./replace-dnt-shim.ts");
    },
});

Deno.removeSync(`${pwd}/npm/test_runner.js`);
await Deno.writeTextFile(
    `${pwd}/npm/.npmignore`,
    `vite.config.ts
.artifacts/**
node_modules/**
bun.lock
bun.lockb`,
    { append: true },
);

const cmd = new Deno.Command("bun", {
    args: ["run", "npm", "install", "--package-lock-only"],
    stdout: "inherit",
    stderr: "inherit",
    cwd: `${pwd}/npm`,
});

const o = await cmd.output();
if (o.code !== 0) {
    throw new Error("Failed to run yarn install --package-lock-only");
}

await import("./fmt-npm.ts");
