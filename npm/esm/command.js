/**
 * The `commands` module provides a set of classes and functions for executing
 * commands in a shell environment. It includes the `Command` class for
 * executing commands, the `ShellCommand` class for executing shell scripts,
 * and the `Pipe` class for chaining commands together. The module also
 * provides utility functions for creating commands, executing
 * commands, and handling output.
 *
 * @module
 */
// @ts-nocheck TS2455
import { CommandError, NotFoundOnPathError } from "./errors.js";
import { globals, loadChildProcess } from "./globals.js";
import { pathFinder } from "./path_finder.js";
import { getLogger } from "./set_logger.js";
import { splat } from "./splat.js";
import { splitArguments } from "./split_arguments.js";
import { remove, removeSync } from "@bearz/fs/remove";
/**
 * Converts the command arguments to an array of strings.
 * @param args Converts the command arguments to an array of strings.
 * @returns The array of strings.
 */
export function convertCommandArgs(args) {
    if (typeof args === "string") {
        return splitArguments(args);
    }
    if (Array.isArray(args)) {
        return args;
    }
    return splat(args);
}
/**
 * Represents a command that can be executed.
 */
export class Command {
    file;
    args;
    options;
    static #pipeFactory;
    /**
     * Creates a new instance of the Command class.
     * @param file The executable command.
     * @param args The arguments for the command.
     * @param options The options for the command.
     */
    constructor(file, args, options) {
        this.file = file;
        this.args = args;
        this.options = options ?? {};
        this.options.log ??= getLogger();
    }
    toArgs() {
        const args = convertCommandArgs(this.args ?? []);
        return [this.file, ...args];
    }
    toOptions() {
        return this.options ?? {};
    }
    /**
     * Sets the current working directory for the command.
     * @param value The current working directory.
     * @returns The Command instance.
     */
    withCwd(value) {
        this.options ??= {};
        this.options.cwd = value;
        return this;
    }
    /**
     * Sets the environment variables for the command.
     * @param value The environment variables.
     * @returns The Command instance.
     */
    withEnv(value) {
        this.options ??= {};
        this.options.env = value;
        return this;
    }
    /**
     * Sets the user ID for the command.
     * @param value The user ID.
     * @returns The Command instance.
     */
    withUid(value) {
        this.options ??= {};
        this.options.uid = value;
        return this;
    }
    /**
     * Sets the group ID for the command.
     * @param value The group ID.
     * @returns The Command instance.
     */
    withGid(value) {
        this.options ??= {};
        this.options.gid = value;
        return this;
    }
    /**
     * Sets the abort signal for the command.
     * @param value The abort signal.
     * @returns The Command instance.
     */
    withSignal(value) {
        this.options ??= {};
        this.options.signal = value;
        return this;
    }
    /**
     * Sets the arguments for the command.
     * @param value The arguments.
     * @returns The Command instance.
     */
    withArgs(value) {
        this.args = value;
        return this;
    }
    /**
     * Sets the stdin behavior for the command.
     * @param value The stdin behavior.
     * @returns The Command instance.
     */
    withStdin(value) {
        this.options ??= {};
        this.options.stdin = value;
        return this;
    }
    /**
     * Sets the stdout behavior for the command.
     * @param value The stdout behavior.
     * @returns The Command instance.
     */
    withStdout(value) {
        this.options ??= {};
        this.options.stdout = value;
        return this;
    }
    /**
     * Sets the stderr behavior for the command.
     * @param value The stderr behavior.
     * @returns The Command instance.
     */
    withStderr(value) {
        this.options ??= {};
        this.options.stderr = value;
        return this;
    }
    /**
     * Thenable method that allows the Command object to be used as a promise which calls the `output` method.
     * It is not recommended to use this method directly. Instead, use the `output` method.
     * @param onfulfilled A function called when the promise is fulfilled.
     * @param onrejected A function called when the promise is rejected.
     * @returns A promise that resolves to the output of the command.
     * @example
     * ```ts
     * var cmd = new Command("echo", ["hello world"], { stdout: 'piped' });
     * const result = await cmd;
     * console.log(result.code);
     * console.log(result.stdout);
     * console.log(result.text());
     * ```
     */
    then(
        onfulfilled,
        // deno-lint-ignore no-explicit-any
        onrejected,
    ) {
        return this.output().then(onfulfilled, onrejected);
    }
    /**
     * Runs the command asynchronously and returns a promise that resolves to the output of the command.
     * The stdout and stderr are set to `inherit`.
     * @returns A promise that resolves to the output of the command.
     */
    async run() {
        this.options ??= {};
        const { stdout, stderr } = this.options;
        try {
            this.options.stdout = "inherit";
            this.options.stderr = "inherit";
            return await this.output();
        } finally {
            this.options.stdout = stdout;
            this.options.stderr = stderr;
        }
    }
    /**
     * Runs the command synchronously and returns the output of the command.
     * The stdout and stderr are set to `inherit`.
     * @returns The output of the command.
     */
    runSync() {
        this.options ??= {};
        const { stdout, stderr } = this.options;
        try {
            this.options.stdout = "inherit";
            this.options.stderr = "inherit";
            return this.outputSync();
        } finally {
            this.options.stdout = stdout;
            this.options.stderr = stderr;
        }
    }
    pipe() {
        this.options ??= {};
        this.options.stdout = "piped";
        this.options.stderr = "inherit";
        if (arguments.length === 0) {
            throw new Error("Invalid arguments");
        }
        let next;
        if (typeof arguments[0] === "string") {
            const args = arguments[1];
            const options = arguments[2];
            const ctor = Object.getPrototypeOf(this).constructor;
            next = new ctor(arguments[0], args, options);
            next.withStdout("piped");
            next.withStdin("piped");
        } else {
            next = arguments[0];
        }
        Command.#pipeFactory ??= new PipeFactory((file, args, options) => {
            const ctor = Object.getPrototypeOf(this).constructor;
            next = new ctor(file, args, options);
            next.withStdin("piped");
            next.withStdout("piped");
            return next;
        });
        return Command.#pipeFactory.create(this.spawn()).pipe(next);
    }
    /**
     * Gets the output of the command as text.
     * @returns A promise that resolves to the output of the command as text.
     */
    async text() {
        this.options ??= {};
        const { stdout } = this.options;
        try {
            this.options.stdout = "piped";
            const output = await this.output();
            return output.text();
        } finally {
            this.options.stdout = stdout;
        }
    }
    /**
     * Gets the output of the command as an array of lines.
     * @returns A promise that resolves to the output of the command as an array of lines.
     */
    async lines() {
        this.options ??= {};
        const { stdout } = this.options;
        try {
            this.options.stdout = "piped";
            const output = await this.output();
            return output.lines();
        } finally {
            this.options.stdout = stdout;
        }
    }
    /**
     * Gets the output of the command as JSON.
     * @returns A promise that resolves to the output of the command as JSON.
     */
    async json() {
        this.options ??= {};
        const { stdout } = this.options;
        try {
            this.options.stdout = "piped";
            const output = await this.output();
            return output.json();
        } finally {
            this.options.stdout = stdout;
        }
    }
    /**
     * Gets the output of the command.
     * @returns A promise that resolves to the output of the command.
     */
    output() {
        throw new Error("Not implemented");
    }
    /**
     * Gets the output of the command synchronously.
     * @returns The output of the command.
     */
    outputSync() {
        throw new Error("Not implemented");
    }
    /**
     * Spawns a child process for the command.
     * @returns The spawned child process.
     */
    spawn() {
        throw new Error("Not implemented");
    }
}
/**
 * Represents a shell command.
 */
export class ShellCommand extends Command {
    shellArgs;
    script;
    isFile;
    /**
     * Creates a new instance of the ShellCommand class.
     * @param exe The executable command.
     * @param script The shell script or command to execute.
     * @param options The options for the shell command.
     */
    constructor(exe, script, options) {
        super(exe, options?.args, options);
        this.shellArgs = options?.shellArgs;
        this.script = script;
        this.isFile = options?.isFile;
    }
    /**
     * Gets the file extension for the shell script.
     * @returns The file extension.
     */
    get ext() {
        return "";
    }
    toArgs() {
        const { file, generated } = this.getScriptFile();
        const args = this.getShellArgs(file ?? this.script, generated || (this.isFile ?? false));
        return [this.file, ...args];
    }
    /**
     * Gets the shell arguments for the given script and file type.
     * @param script The shell script or command.
     * @param isFile Indicates whether the script is a file.
     * @returns An array of shell arguments.
     */
    // deno-lint-ignore no-unused-vars
    getShellArgs(script, isFile) {
        const args = this.shellArgs ?? [];
        args.push(script);
        return args;
    }
    /**
     * Gets the script file information. The `file` property is undefined if the script is not a file.
     * @returns An object containing the script file path and whether it was generated.
     */
    getScriptFile() {
        if (
            this.isFile ||
            (!this.script.match(/\n/) && this.ext.length &&
                this.script.trimEnd().endsWith(this.ext))
        ) {
            return { file: this.script, generated: false };
        }
        return { file: undefined, generated: false };
    }
}
/**
 * Creates a new command instance. This is a shorthand for creating a new
 * {@linkcode Command} instance and defaults the stdin to `inherit`, stderr
 *  to `piped`, and stdout to `piped` if the options are not set.
 *
 * @param exe - The executable to run.
 * @param args - The arguments to pass to the executable.
 * @param options - The options for the command.
 * @returns A new `CommandType` instance.
 */
export function cmd(exe, args, options) {
    options ??= {};
    options.stdin ??= "inherit";
    options.stderr ??= "piped";
    options.stdout ??= "piped";
    return new Command(exe, args, options);
}
/**
 * Converts a string representing invoking an executable into a command instance.
 * @param command The command to execute.
 * @param options The options for the command.
 * @returns The command instance.
 */
export function exec(command, options) {
    const args = splitArguments(command);
    if (args.length === 0) {
        throw new Error("Invalid command");
    }
    const exe = args.shift();
    return cmd(exe, args, options);
}
/**
 * Represents a pipe for executing commands and chaining them together.
 */
class Pipe {
    process;
    cmdFactory;
    #promise;
    /**
     * Creates a new instance of the Pipe class.
     * @param process The initial ChildProcess to start the pipe with.
     * @param cmdFactory The factory function for creating Command instances.
     */
    constructor(process, cmdFactory) {
        this.process = process;
        this.cmdFactory = cmdFactory;
        this.#promise = Promise.resolve(process);
    }
    pipe() {
        if (arguments.length === 0) {
            throw new Error("Invalid arguments");
        }
        if (typeof arguments[0] === "string") {
            const args = arguments[1];
            const options = arguments[2];
            const next = this.cmdFactory(arguments[0], args, options);
            return this.pipe(next);
        }
        const next = arguments[0];
        this.#promise = this.#promise.then(async (process) => {
            let child = next;
            if (typeof next === "object" && "spawn" in next) {
                if ("stdin" in next) {
                    next.stdin("piped");
                }
                child = next.spawn();
            }
            try {
                // force stdin to close
                await process.stdout.pipeTo(child.stdin, { preventClose: false });
                if (!process.stdout.locked) {
                    await process.stdout.cancel();
                }
                // if (process.stderr.)
                //await process.stderr.cancel();
            } catch (ex) {
                if (ex instanceof Error) {
                    throw new Error(`Pipe failed for ${process}: ${ex.message} ${ex.stack}`);
                } else {
                    throw new Error(`Pipe failed for ${process}: ${ex}`);
                }
            }
            return child;
        });
        return this;
    }
    /**
     * Retrieves the output of the pipe as an Output instance.
     * @returns A Promise that resolves to the Output instance.
     */
    async output() {
        const process = await this.#promise;
        return process.output();
    }
}
/**
 * Represents a factory for creating Pipe instances.
 */
class PipeFactory {
    cmdFactory;
    constructor(cmdFactory) {
        this.cmdFactory = cmdFactory;
    }
    /**
     * Creates a new Pipe instance.
     * @param process The ChildProcess object to associate with the Pipe.
     * @returns A new Pipe instance.
     */
    create(process) {
        return new Pipe(process, this.cmdFactory);
    }
}
if (globals.Deno) {
    const EMPTY = "";
    class DenoChildProcess {
        #childProcess;
        #options;
        #file;
        constructor(childProcess, options, file) {
            this.#childProcess = childProcess;
            this.#options = options;
            this.#file = file;
        }
        get stdin() {
            return this.#childProcess.stdin;
        }
        get stdout() {
            return this.#childProcess.stdout;
        }
        get stderr() {
            return this.#childProcess.stderr;
        }
        get pid() {
            return this.#childProcess.pid;
        }
        get status() {
            return this.#childProcess.status;
        }
        ref() {
            return this.#childProcess.ref();
        }
        unref() {
            return this.#childProcess.unref();
        }
        async output() {
            const out = await this.#childProcess.output();
            return new DenoOutput({
                stdout: this.#options.stdout === "piped" ? out.stdout : new Uint8Array(0),
                stderr: this.#options.stderr === "piped" ? out.stderr : new Uint8Array(0),
                code: out.code,
                signal: out.signal,
                success: out.success,
            }, this.#file);
        }
        kill(signo) {
            return this.#childProcess.kill(signo);
        }
        onDispose;
        [Symbol.asyncDispose]() {
            if (this.onDispose) {
                this.onDispose();
            }
            return this.#childProcess[Symbol.asyncDispose]();
        }
    }
    class DenoOutput {
        #text;
        #lines;
        #json;
        #errorText;
        #errorLines;
        #errorJson;
        #file;
        stdout;
        stderr;
        code;
        signal;
        success;
        constructor(output, file) {
            this.stdout = output.stdout;
            this.stderr = output.stderr;
            this.code = output.code;
            this.signal = output.signal;
            this.success = output.success;
            this.#file = file;
        }
        validate(fn, failOnStderr) {
            fn ??= (code) => code === 0;
            if (!fn(this.code)) {
                throw new CommandError({ fileName: this.#file, code: this.code });
            }
            if (failOnStderr && this.stderr.length > 0) {
                throw new CommandError({
                    fileName: this.#file,
                    code: this.code,
                    message: `${this.#file} failed with stderr: ${this.errorText()}`,
                });
            }
            return this;
        }
        text() {
            if (this.#text) {
                return this.#text;
            }
            if (this.stdout.length === 0) {
                this.#text = EMPTY;
                return this.#text;
            }
            this.#text = new TextDecoder().decode(this.stdout);
            return this.#text;
        }
        lines() {
            if (this.#lines) {
                return this.#lines;
            }
            this.#lines = this.text().split(/\r?\n/);
            return this.#lines;
        }
        json() {
            if (this.#json) {
                return this.#json;
            }
            this.#json = JSON.parse(this.text());
            return this.#json;
        }
        errorText() {
            if (this.#errorText) {
                return this.#errorText;
            }
            if (this.stderr.length === 0) {
                this.#errorText = EMPTY;
                return this.#errorText;
            }
            this.#errorText = new TextDecoder().decode(this.stderr);
            return this.#errorText;
        }
        errorLines() {
            if (this.#errorLines) {
                return this.#errorLines;
            }
            this.#errorLines = this.errorText().split(/\r?\n/);
            return this.#errorLines;
        }
        errorJson() {
            if (this.#errorJson) {
                return this.#errorJson;
            }
            this.#errorJson = JSON.parse(this.errorText());
            return this.#errorJson;
        }
        toString() {
            return this.text();
        }
    }
    Command.prototype.spawn = function () {
        const exe = pathFinder.findExeSync(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const args = this.args ? convertCommandArgs(this.args) : undefined;
        const options = {
            ...this.options,
            args: args,
        };
        if (this.options?.log) {
            this.options?.log(exe, args);
        }
        const process = new Deno.Command(exe, options);
        return new DenoChildProcess(process.spawn(), options, this.file);
    };
    Command.prototype.outputSync = function () {
        const exe = pathFinder.findExeSync(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const args = this.args ? convertCommandArgs(this.args) : undefined;
        const options = {
            ...this.options,
            args: args,
        };
        options.stdout ??= "piped";
        options.stderr ??= "piped";
        options.stdin ??= "inherit";
        if (this.options?.log) {
            this.options?.log(exe, args);
        }
        const process = new Deno.Command(exe, options);
        const out = process.outputSync();
        return new DenoOutput({
            stdout: options.stdout === "piped" ? out.stdout : new Uint8Array(0),
            stderr: options.stderr === "piped" ? out.stderr : new Uint8Array(0),
            code: out.code,
            signal: out.signal,
            success: out.success,
        }, this.file);
    };
    Command.prototype.output = async function () {
        const exe = await pathFinder.findExe(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const args = this.args ? convertCommandArgs(this.args) : undefined;
        const options = {
            ...this.options,
            args: args,
            // deno-lint-ignore no-explicit-any
        };
        options.stdout ??= "piped";
        options.stderr ??= "piped";
        options.stdin ??= "inherit";
        if (this.options?.log) {
            this.options?.log(exe, args);
        }
        const process = new Deno.Command(exe, options);
        const out = await process.output();
        return new DenoOutput({
            stdout: options.stdout === "piped" ? out.stdout : new Uint8Array(0),
            stderr: options.stderr === "piped" ? out.stderr : new Uint8Array(0),
            code: out.code,
            signal: out.signal,
            success: out.success,
        }, this.file);
    };
    ShellCommand.prototype.output = async function () {
        const exe = await pathFinder.findExe(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const { file, generated } = this.getScriptFile();
        const isFile = file !== undefined;
        try {
            const args = this.getShellArgs(isFile ? file : this.script, isFile);
            if (isFile && this.args) {
                const splat = convertCommandArgs(this.args);
                args.push(...splat);
            }
            const options = {
                ...this.options,
                args: args,
            };
            options.stdout ??= "piped";
            options.stderr ??= "piped";
            options.stdin ??= "inherit";
            if (this.options?.log) {
                this.options?.log(exe, args);
            }
            const process = new Deno.Command(exe, options);
            const out = await process.output();
            return new DenoOutput({
                stdout: options.stdout === "piped" ? out.stdout : new Uint8Array(0),
                stderr: options.stderr === "piped" ? out.stderr : new Uint8Array(0),
                code: out.code,
                signal: out.signal,
                success: out.success,
            }, this.file);
        } finally {
            if (isFile && generated) {
                await remove(file);
            }
        }
    };
    ShellCommand.prototype.outputSync = function () {
        const exe = pathFinder.findExeSync(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const { file, generated } = this.getScriptFile();
        const isFile = file !== undefined;
        try {
            const args = this.getShellArgs(isFile ? file : this.script, isFile);
            if (isFile && this.args) {
                const splat = convertCommandArgs(this.args);
                args.push(...splat);
            }
            const options = {
                ...this.options,
                args: args,
            };
            options.stdout ??= "piped";
            options.stderr ??= "piped";
            options.stdin ??= "inherit";
            if (this.options?.log) {
                this.options?.log(exe, args);
            }
            const process = new Deno.Command(exe, options);
            const out = process.outputSync();
            return new DenoOutput({
                stdout: options.stdout === "piped" ? out.stdout : new Uint8Array(0),
                stderr: options.stderr === "piped" ? out.stderr : new Uint8Array(0),
                code: out.code,
                signal: out.signal,
                success: out.success,
            }, this.file);
        } finally {
            if (isFile && generated) {
                removeSync(file);
            }
        }
    };
    ShellCommand.prototype.spawn = function () {
        const exe = pathFinder.findExeSync(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const { file, generated } = this.getScriptFile();
        const isFile = file !== undefined;
        const args = this.getShellArgs(isFile ? file : this.script, isFile);
        if (isFile && this.args) {
            const splat = convertCommandArgs(this.args);
            args.push(...splat);
        }
        const options = {
            ...this.options,
            args: args,
        };
        if (this.options?.log) {
            this.options?.log(exe, args);
        }
        const process = new Deno.Command(exe, options);
        const proc = new DenoChildProcess(process.spawn(), options, this.file);
        proc.onDispose = () => {
            if (isFile && generated) {
                removeSync(file);
            }
        };
        return proc;
    };
} else if (globals.process) {
    const child_process = loadChildProcess();
    const { spawn, spawnSync } = child_process;
    class NodeOutput {
        #text;
        #lines;
        #json;
        #errorText;
        #errorLines;
        #errorJson;
        #file;
        #args;
        stdout;
        stderr;
        code;
        signal;
        success;
        constructor(output) {
            this.stdout = output.stdout;
            this.stderr = output.stderr;
            this.code = output.code;
            this.signal = output.signal;
            this.success = output.success;
            this.#file = output.file;
            this.#args = output.args;
        }
        validate(fn, failOnStderr) {
            fn ??= (code) => code === 0;
            if (!fn(this.code)) {
                throw new CommandError({
                    fileName: this.#file,
                    code: this.code,
                });
            }
            if (failOnStderr && this.stderr.length > 0) {
                throw new CommandError({
                    fileName: this.#file,
                    code: this.code,
                    message: `Command failed with stderr: ${this.errorText()}`,
                });
            }
            return this;
        }
        text() {
            if (this.#text) {
                return this.#text;
            }
            if (this.stdout.length === 0) {
                this.#text = "";
                return this.#text;
            }
            this.#text = new TextDecoder().decode(this.stdout);
            return this.#text;
        }
        lines() {
            if (this.#lines) {
                return this.#lines;
            }
            this.#lines = this.text().split(/\r?\n/);
            return this.#lines;
        }
        json() {
            if (this.#json) {
                return this.#json;
            }
            this.#json = JSON.parse(this.text());
            return this.#json;
        }
        errorText() {
            if (this.#errorText) {
                return this.#errorText;
            }
            if (this.stderr.length === 0) {
                this.#errorText = "";
                return this.#errorText;
            }
            this.#errorText = new TextDecoder().decode(this.stderr);
            return this.#errorText;
        }
        errorLines() {
            if (this.#errorLines) {
                return this.#errorLines;
            }
            this.#errorLines = this.errorText().split(/\r?\n/);
            return this.#errorLines;
        }
        errorJson() {
            if (this.#errorJson) {
                return this.#errorJson;
            }
            this.#errorJson = JSON.parse(this.errorText());
            return this.#errorJson;
        }
        toString() {
            return this.text();
        }
    }
    class NodeChildProcess {
        #child;
        #stdout;
        #stderr;
        #stdin;
        #status;
        #file;
        constructor(child, file, signal) {
            this.#child = child;
            this.#file = file;
            if (signal !== undefined) {
                signal.addEventListener("abort", () => {
                    child.kill("SIGTERM");
                });
            }
            this.#status = new Promise((resolve, reject) => {
                child.on("error", (_err) => {
                    reject(_err);
                });
                child.on("exit", (code, signal) => {
                    resolve({
                        success: code === 0,
                        code: code || 1,
                        signal: signal,
                    });
                });
            });
        }
        get pid() {
            return this.#child.pid ? this.#child.pid : -1;
        }
        get status() {
            return this.#status;
        }
        get stdout() {
            if (this.#stdout) {
                return this.#stdout;
            }
            const child = this.#child;
            if (child.stdout === null) {
                throw new Error("stdout is not available");
            }
            const stream = new ReadableStream({
                start(controller) {
                    if (child.stdout === null) {
                        controller.close();
                        return;
                    }
                    child.stdout.on("data", (data) => {
                        if (data instanceof Uint8Array) {
                            controller.enqueue(data);
                        }
                    });
                    child.stdout.on("end", () => {
                        controller.close();
                    });
                },
            });
            this.#stdout = stream;
            return stream;
        }
        get stderr() {
            const child = this.#child;
            if (child.stderr === null) {
                throw new Error("stderr is not available");
            }
            const stream = new ReadableStream({
                start(controller) {
                    if (child.stderr === null) {
                        controller.close();
                        return;
                    }
                    child.stderr.on("data", (data) => {
                        controller.enqueue(data);
                    });
                    child.stderr.on("end", () => {
                        controller.close();
                    });
                },
            });
            return stream;
        }
        get stdin() {
            if (this.#stdin) {
                return this.#stdin;
            }
            const child = this.#child;
            if (child.stdin === null) {
                throw new Error("stdin is not available");
            }
            const stream = new WritableStream({
                write(chunk) {
                    child.stdin?.write(chunk);
                },
                close() {
                    child.stdin?.end();
                },
                abort() {
                    child.stdin?.end();
                },
            });
            this.#stdin = stream;
            return stream;
        }
        kill(signo) {
            if (signo === "SIGEMT") {
                signo = "SIGTERM";
            }
            this.#child.kill(signo);
        }
        ref() {
            this.#child.ref();
        }
        unref() {
            this.#child.unref();
        }
        output() {
            let stdout = new Uint8Array(0);
            let stderr = new Uint8Array(0);
            this.#child.stdout?.on("data", (data) => {
                stdout = new Uint8Array([...stdout, ...data]);
            });
            this.#child.stderr?.on("data", (data) => {
                stderr = new Uint8Array([...stderr, ...data]);
            });
            return new Promise((resolve, reject) => {
                this.#child.on("error", (err) => {
                    reject(err);
                });
                this.#child.on("exit", (code, signal) => {
                    const o = {
                        file: this.#file,
                        stdout: stdout,
                        stderr: stderr,
                        code: code,
                        signal: signal,
                        success: code === 0,
                    };
                    resolve(new NodeOutput(o));
                });
            });
        }
        onDispose;
        async [Symbol.asyncDispose]() {
            if (this.onDispose) {
                this.onDispose();
            }
            await this.status;
        }
    }
    // deno-lint-ignore no-inner-declarations
    function mapPipe(pipe) {
        if (pipe === undefined) {
            return undefined;
        }
        if (pipe === "inherit") {
            return "inherit";
        }
        if (pipe === "null") {
            return "ignore";
        }
        if (pipe === "piped") {
            return "pipe";
        }
        return undefined;
    }
    Command.prototype.output = async function () {
        const exe = await pathFinder.findExe(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const args = this.args ? convertCommandArgs(this.args) : [];
        let signal;
        if (this.options?.signal) {
            signal = this.options.signal;
        }
        const o = this.options ?? {};
        o.stdin ??= "inherit";
        o.stdout ??= "piped";
        o.stderr ??= "piped";
        const child = spawn(exe, args, {
            cwd: o.cwd,
            env: o.env,
            gid: o.gid,
            uid: o.uid,
            stdio: [mapPipe(o.stdin), mapPipe(o.stdout), mapPipe(o.stderr)],
            windowsVerbatimArguments: o.windowsRawArguments,
            // deno-lint-ignore no-explicit-any
            signal: signal,
        });
        if (this.options?.log) {
            this.options.log(exe, args);
        }
        let stdout = new Uint8Array(0);
        let stderr = new Uint8Array(0);
        let code = 1;
        let sig;
        const promises = [];
        if (child.stdout !== null) {
            child.stdout.on("data", (data) => {
                stdout = new Uint8Array([...stdout, ...data]);
            });
        }
        if (child.stderr !== null) {
            child.stderr.on("data", (data) => {
                stderr = new Uint8Array([...stderr, ...data]);
            });
        }
        promises.push(
            new Promise((resolve) => {
                if (child.stdout === null) {
                    resolve();
                    return;
                }
                child.stdout.on("end", () => {
                    resolve();
                });
            }),
        );
        promises.push(
            new Promise((resolve) => {
                if (child.stderr === null) {
                    resolve();
                    return;
                }
                child.stderr.on("end", () => {
                    resolve();
                });
            }),
        );
        promises.push(
            new Promise((resolve) => {
                child.on("exit", (c, s) => {
                    code = c !== null ? c : 1;
                    sig = s === null ? undefined : s;
                    resolve();
                });
            }),
        );
        await Promise.all(promises);
        return new NodeOutput({
            file: this.file,
            stdout: stdout,
            stderr: stderr,
            code: code,
            signal: sig,
            success: code === 0,
        });
    };
    Command.prototype.outputSync = function () {
        const exe = pathFinder.findExeSync(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const args = this.args ? convertCommandArgs(this.args) : [];
        const o = {
            ...this.options,
        };
        o.stdin ??= "inherit";
        o.stdout ??= "piped";
        o.stderr ??= "piped";
        if (this.options?.log) {
            this.options.log(exe, args);
        }
        const child = spawnSync(exe, args, {
            cwd: o.cwd,
            env: o.env,
            gid: o.gid,
            uid: o.uid,
            stdio: [mapPipe(o.stdin), mapPipe(o.stdout), mapPipe(o.stderr)],
            windowsVerbatimArguments: o.windowsRawArguments,
        });
        const code = child.status ? child.status : 1;
        return new NodeOutput({
            file: this.file,
            stdout: new Uint8Array(0),
            stderr: new Uint8Array(0),
            code: child.status ? child.status : 1,
            signal: child.signal,
            success: code === 0,
        });
    };
    Command.prototype.spawn = function () {
        const exe = pathFinder.findExeSync(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const args = this.args ? convertCommandArgs(this.args) : [];
        const o = {
            ...this.options,
        };
        o.stdout ??= "inherit";
        o.stderr ??= "inherit";
        o.stdin ??= "inherit";
        const stdin = mapPipe(o.stdin);
        const stdout = mapPipe(o.stdout);
        const stderr = mapPipe(o.stderr);
        if (this.options?.log) {
            this.options.log(exe, args);
        }
        const child = spawn(exe, args, {
            cwd: o.cwd,
            env: o.env,
            gid: o.gid,
            uid: o.uid,
            stdio: [stdin, stdout, stderr],
            windowsVerbatimArguments: o.windowsRawArguments,
        });
        return new NodeChildProcess(child, this.file, o.signal);
    };
    ShellCommand.prototype.output = async function () {
        const exe = await pathFinder.findExe(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const { file, generated } = this.getScriptFile();
        const isFile = file !== undefined;
        try {
            const args = this.getShellArgs(isFile ? file : this.script, isFile);
            if (isFile && this.args) {
                const splat = convertCommandArgs(this.args);
                args.push(...splat);
            }
            let signal;
            if (this.options?.signal) {
                signal = this.options.signal;
            }
            const o = this.options ?? {};
            o.stdin ??= "inherit";
            o.stdout ??= "piped";
            o.stderr ??= "piped";
            if (this.options?.log) {
                this.options.log(exe, args);
            }
            const child = spawn(exe, args, {
                cwd: o.cwd,
                env: o.env,
                gid: o.gid,
                uid: o.uid,
                stdio: [mapPipe(o.stdin), mapPipe(o.stdout), mapPipe(o.stderr)],
                windowsVerbatimArguments: o.windowsRawArguments,
                // deno-lint-ignore no-explicit-any
                signal: signal,
            });
            let stdout = new Uint8Array(0);
            let stderr = new Uint8Array(0);
            let code = 1;
            let sig;
            const promises = [];
            if (child.stdout !== null) {
                child.stdout.on("data", (data) => {
                    stdout = new Uint8Array([...stdout, ...data]);
                });
            }
            if (child.stderr !== null) {
                child.stderr.on("data", (data) => {
                    stderr = new Uint8Array([...stderr, ...data]);
                });
            }
            promises.push(
                new Promise((resolve) => {
                    if (child.stdout === null) {
                        resolve();
                        return;
                    }
                    child.stdout.on("end", () => {
                        resolve();
                    });
                }),
            );
            promises.push(
                new Promise((resolve) => {
                    if (child.stderr === null) {
                        resolve();
                        return;
                    }
                    child.stderr.on("end", () => {
                        resolve();
                    });
                }),
            );
            promises.push(
                new Promise((resolve) => {
                    child.on("exit", (c, s) => {
                        code = c !== null ? c : 1;
                        sig = s === null ? undefined : s;
                        resolve();
                    });
                }),
            );
            await Promise.all(promises);
            return new NodeOutput({
                file: exe,
                stdout: stdout,
                stderr: stderr,
                code: code,
                signal: sig,
                success: code === 0,
            });
        } finally {
            if (isFile && generated) {
                await remove(file);
            }
        }
    };
    ShellCommand.prototype.outputSync = function () {
        const exe = pathFinder.findExeSync(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const { file, generated } = this.getScriptFile();
        const isFile = file !== undefined;
        try {
            const args = this.getShellArgs(isFile ? file : this.script, isFile);
            if (isFile && this.args) {
                const splat = convertCommandArgs(this.args);
                args.push(...splat);
            }
            const o = {
                ...this.options,
            };
            o.stdin ??= "inherit";
            o.stdout ??= "piped";
            o.stderr ??= "piped";
            if (this.options?.log) {
                this.options.log(exe, args);
            }
            const child = spawnSync(this.file, args, {
                cwd: o.cwd,
                env: o.env,
                gid: o.gid,
                uid: o.uid,
                stdio: [mapPipe(o.stdin), mapPipe(o.stdout), mapPipe(o.stderr)],
                windowsVerbatimArguments: o.windowsRawArguments,
            });
            if (this.options?.log) {
                this.options.log(this.file, args);
            }
            const code = child.status ? child.status : 1;
            return new NodeOutput({
                file: this.file,
                stdout: new Uint8Array(0),
                stderr: new Uint8Array(0),
                code: child.status ? child.status : 1,
                signal: child.signal,
                success: code === 0,
            });
        } finally {
            if (isFile && generated) {
                removeSync(file);
            }
        }
    };
    ShellCommand.prototype.spawn = function () {
        const exe = pathFinder.findExeSync(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const { file, generated } = this.getScriptFile();
        const isFile = file !== undefined;
        const args = this.getShellArgs(isFile ? file : this.script, isFile);
        if (isFile && this.args) {
            const splat = convertCommandArgs(this.args);
            args.push(...splat);
        }
        const o = {
            ...this.options,
        };
        o.stdout ??= "inherit";
        o.stderr ??= "inherit";
        o.stdin ??= "inherit";
        const stdin = mapPipe(o.stdin);
        const stdout = mapPipe(o.stdout);
        const stderr = mapPipe(o.stderr);
        if (this.options?.log) {
            this.options.log(exe, args);
        }
        const child = spawn(exe, args, {
            cwd: o.cwd,
            env: o.env,
            gid: o.gid,
            uid: o.uid,
            stdio: [stdin, stdout, stderr],
            windowsVerbatimArguments: o.windowsRawArguments,
        });
        const proc = new NodeChildProcess(child, this.file, o.signal);
        proc.onDispose = () => {
            if (isFile && generated) {
                removeSync(file);
            }
        };
        return proc;
    };
}
/**
 * Run a command and return the output. This is a shorthand for creating a new
 * {@linkcode Command} and calling {@linkcode Command.output} with stdout and
 * stderr set to `inherit`.
 * @param exe The executable to run.
 * @param args The arguments to pass to the executable.
 * @param options The options to run the command with.
 * @returns The output of the command.
 */
export function run(exe, args, options) {
    const o = options || {};
    o.stderr = "inherit";
    o.stdout = "inherit";
    return new Command(exe, args, o).output();
}
/**
 * Run a command and return the output synchronously. This is a shorthand for
 * creating a new {@linkcode Command} and calling {@linkcode Command.outputSync}
 * with stdout and stderr set to `inherit`.
 * @param exe The executable to run.
 * @param args The arguments to pass to the executable.
 * @param options The options to run the command with.
 * @returns The output of the command.
 */
export function runSync(exe, args, options) {
    const o = options || {};
    o.stderr = "inherit";
    o.stdout = "inherit";
    return new Command(exe, args, options).outputSync();
}
/**
 * Run a command and return the output. This is a shorthand for creating a new
 * {@linkcode Command} and calling {@linkcode Command.output} with stderr and
 * stdout defaulting to `piped` if not set in the options.
 * @param exe The executable to run.
 * @param args The arguments to pass to the executable.
 * @param options The options to run the command with.
 * @returns The output of the command.
 */
export function output(exe, args, options) {
    options ??= {};
    options.stdin ??= "inherit";
    options.stderr ??= "piped";
    options.stdout ??= "piped";
    return new Command(exe, args, options).output();
}
/**
 * Run a command and return the output synchronously. This is a shorthand for
 * creating a new {@linkcode Command} and calling {@linkcode Command.outputSync}
 * with stderr and stdout defaulting to `piped` if not set in the options.
 * @param exe The executable to run.
 * @param args The arguments to pass to the executable.
 * @param options The options to run the command with.
 * @returns The output of the command.
 */
export function outputSync(exe, args, options) {
    options ??= {};
    options.stderr = "piped";
    options.stdout = "piped";
    return new Command(exe, args, options).outputSync();
}
/**
 * Spawn a command and return the process. This is a shorthand for creating a new
 * {@linkcode Command} and calling {@linkcode Command.spawn} with stdin, stderr,
 * and stdout defaulting to `inherit` if not set in the options.
 * @param exe The executable to run.
 * @param args The arguments to pass to the executable.
 * @param options The options to run the command with.
 * @returns The process of the command.
 */
export function spawn(exe, args, options) {
    options ??= {};
    options.stdin ??= "inherit";
    options.stderr ??= "inherit";
    options.stdout ??= "inherit";
    return new Command(exe, args, options).spawn();
}
