import { test } from "@bearz/testing";
import { equal, ok } from "@bearz/assert";
import { setLogger } from "./set_logger.js";
import { cmd } from "./command.js";
import { pathFinder } from "./path_finder.js";
const hasExe = pathFinder.findExeSync("echo") !== undefined;
test("exec::setLogger", { ignore: !hasExe }, async () => {
    let fileName = "";
    let args2 = [];
    setLogger((file, args) => {
        fileName = file;
        args2 = args;
    });
    try {
        await cmd("echo", ["test"]);
        ok(fileName.endsWith("echo") || fileName.endsWith("echo.exe"));
        equal(args2, ["test"]);
    } finally {
        setLogger(undefined);
    }
});
