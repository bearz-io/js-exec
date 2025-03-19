/**
 * ## Overview
 *
 * The exec module makes it easy to spawn child_processes across
 * different runtimes (NodeJS, Bun, Deno) and different operating
 * systems (Windows, Linux, Mac) and include additional utilities
 * like splatting arguments and looking up executables on the path.
 *
 * ![logo](https://raw.githubusercontent.com/bearz-io/js/refs/heads/main/eng/assets/bearz.io.png)
 *
 * [![JSR](https://jsr.io/badges/@bearz/exec)](https://jsr.io/@bearz/exec)
 * [![npm version](https://badge.fury.io/js/@bearz%2Fexec.svg)](https://badge.fury.io/js/@bearz%2Fexec)
 * [![GitHub version](https://badge.fury.io/gh/bearz-io%2Fjs-exec.svg)](https://badge.fury.io/gh/bearz-io%2Fjs-exec)
 *
 * ## Documentation
 *
 * Documentation is available on [jsr.io](https://jsr.io/@bearz/exec/doc)
 *
 * A list of other modules can be found at [github.com/bearz-io/js](https://github.com/bearz-io/js)
 *
 * ## Usage
 *
 * ```typescript
 * import { Command, cmd, run, exec, output, type SplatObject, which } from "@bearz/exec";
 *
 * console.log( await (which("git"))); //path to git
 *
 * // string, array, or objects can be used for "args".
 * const cmd1 = new Command("git", "show-ref master", {
 *     env: { "MY_VAR": "TEST" },
 *     cwd: "../parent"
 * });
 * const output = await cmd1.output();
 *
 * console.log(output); // ->
 * // {
 * //    code: 0,
 * //    signal: undefined,
 * //    success: true
 * //    stdout: Uint8Array([01, 12..])
 * //    stderr: Uint8Array([0])
 * // }
 *
 * // the output result has different methods on it..
 * console.log(output.text()) // text
 * console.log(output.lines()) // string[]
 * console.log(output.json()) // will throw if output is not valid json
 *
 * const cmd2 = cmd("git", ["show-ref", "master");
 *
 * // these are the same.
 * console.log(await cmd2.output())
 * console.log(await cmd2);
 * console.log(await new Command("git", ["show-ref", "master"]));
 *
 * console.log(await cmd2.text()); // get only the text from stdout instead
 *
 * // pipe commands together
 * const result = await cmd("echo", ["my test"])
 *     .pipe("grep", ["test"])
 *     .pipe("cat")
 *     .output();
 *
 * console.log(result.code);
 * console.log(result.stdout);
 *
 * // output is the short hand for new Command().output()
 * // and output defaults stdout and stderr to 'piped'
 * // which returns the stdout and stderr streams a as Uint8Array
 * const text = await output("git", ["show-ref", "master"]).then(o => o.text());
 *
 * console.log(text);
 *
 * // exec will let you use a string for the command which will use
 * // splitArguments on the string and pass those to the cmd function.
 * console.log(await exec("git show-ref master").text());
 *
 * ```
 *
 * ## Classes
 *
 * - Command - A command/syscall that spawns a child process.
 * - Options - An interface that respresents the output of a command.
 * - PathFinder - A registry of executable paths, which can include additional
 *   paths to find the executable in case its not yet available in the PATH.
 * - ShellCommand - A command/syscall that spawns a child process for shells
 *   like pwsh, powershell, bash, sh, etc.
 *
 * ## Functions
 *
 * - `cmd` - Creates a new command.
 * - `exec` - Creates a new command from a string.
 * - `output` &amp; `outputSync` - Creates a new command and sets the standard streams to 'piped'
 *    which allow you to capture the output and executes the command.
 * - `run` &amp; `runSync` - Creates a new command sets the standard streams to `inherit`
 *    executes the command.
 * - `setLogger` - Sets a global logger that logs comamnds and its parameters any time
 *    a command is executed.
 * - `spawn` - Spawns a child process and lets you interact with the child process.
 * - `splitArguments` - Splits a string into commandline/cli arguments handling spaces, quotes, etc. This
 *   includes multiline strings that use `\` or `\`` to put parameters on additional lines similar
 *   to bash or powershell.
 * - `splat` - Takes an object and options and converts the object into command line parameters.
 * - `which` &amp; `whichSync` - Determines if a command/app is available on the environment path
 *   and returns the full path if found.
 *
 * ## License
 *
 * [MIT License](./LICENSE.md)
 *
 * @module
 */
export * from "./command.js";
export * from "./splat.js";
export * from "./split_arguments.js";
export * from "./which.js";
export { setLogger } from "./set_logger.js";
export * from "./path_finder.js";
export * from "./errors.js";
