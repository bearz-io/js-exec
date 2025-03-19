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
import { CommandError, NotFoundOnPathError } from "./errors.ts";
import { globals, loadChildProcess } from "./globals.ts";
import { pathFinder } from "./path_finder.ts";
import { getLogger } from "./set_logger.ts";
import { splat } from "./splat.ts";
import { splitArguments } from "./split_arguments.ts";
import { remove, removeSync } from "@bearz/fs/remove";
import type {
    ChildProcess,
    CommandArgs,
    CommandOptions,
    CommandStatus,
    Output,
    ShellCommandOptions,
    Signal,
} from "./types.ts";
import type { ChildProcess as Node2ChildProcess, IOType } from "node:child_process";

export type { ChildProcess, CommandArgs, CommandOptions, Output, ShellCommandOptions };

/**
 * Converts the command arguments to an array of strings.
 * @param args Converts the command arguments to an array of strings.
 * @returns The array of strings.
 */
export function convertCommandArgs(args: CommandArgs): string[] {
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
    protected file: string;
    protected args?: CommandArgs;
    protected options?: CommandOptions;

    static #pipeFactory?: PipeFactory;

    /**
     * Creates a new instance of the Command class.
     * @param file The executable command.
     * @param args The arguments for the command.
     * @param options The options for the command.
     */
    constructor(file: string, args?: CommandArgs, options?: CommandOptions) {
        this.file = file;
        this.args = args;
        this.options = options ?? {};
        this.options.log ??= getLogger();
    }

    [key: string]: unknown;

    toArgs(): string[] {
        const args = convertCommandArgs(this.args ?? []);
        return [this.file, ...args];
    }

    toOptions(): CommandOptions {
        return this.options ?? {};
    }

    /**
     * Sets the current working directory for the command.
     * @param value The current working directory.
     * @returns The Command instance.
     */
    withCwd(value: string | URL): this {
        this.options ??= {};
        this.options.cwd = value;
        return this;
    }

    /**
     * Sets the environment variables for the command.
     * @param value The environment variables.
     * @returns The Command instance.
     */
    withEnv(value: Record<string, string>): this {
        this.options ??= {};
        this.options.env = value;
        return this;
    }

    /**
     * Sets the user ID for the command.
     * @param value The user ID.
     * @returns The Command instance.
     */
    withUid(value: number): this {
        this.options ??= {};
        this.options.uid = value;
        return this;
    }

    /**
     * Sets the group ID for the command.
     * @param value The group ID.
     * @returns The Command instance.
     */
    withGid(value: number): this {
        this.options ??= {};
        this.options.gid = value;
        return this;
    }

    /**
     * Sets the abort signal for the command.
     * @param value The abort signal.
     * @returns The Command instance.
     */
    withSignal(value: AbortSignal): this {
        this.options ??= {};
        this.options.signal = value;
        return this;
    }

    /**
     * Sets the arguments for the command.
     * @param value The arguments.
     * @returns The Command instance.
     */
    withArgs(value: CommandArgs): this {
        this.args = value;
        return this;
    }

    /**
     * Sets the stdin behavior for the command.
     * @param value The stdin behavior.
     * @returns The Command instance.
     */
    withStdin(value: "inherit" | "piped" | "null" | undefined): this {
        this.options ??= {};
        this.options.stdin = value;
        return this;
    }

    /**
     * Sets the stdout behavior for the command.
     * @param value The stdout behavior.
     * @returns The Command instance.
     */
    withStdout(value: "inherit" | "piped" | "null" | undefined): this {
        this.options ??= {};
        this.options.stdout = value;
        return this;
    }

    /**
     * Sets the stderr behavior for the command.
     * @param value The stderr behavior.
     * @returns The Command instance.
     */
    withStderr(value: "inherit" | "piped" | "null" | undefined): this {
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
    then<TValue = Output, TError = Error | never>(
        onfulfilled?: ((value: Output) => TValue | PromiseLike<TValue>) | null | undefined,
        // deno-lint-ignore no-explicit-any
        onrejected?: ((reason: any) => TError | PromiseLike<TError>) | null | undefined,
    ): PromiseLike<TValue | TError> {
        return this.output().then(onfulfilled, onrejected);
    }

    /**
     * Runs the command asynchronously and returns a promise that resolves to the output of the command.
     * The stdout and stderr are set to `inherit`.
     * @returns A promise that resolves to the output of the command.
     */
    async run(): Promise<Output> {
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
    runSync(): Output {
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

    /**
     * Pipes the output of the command to another command or child process.
     * @param name The name of the command to pipe to.
     * @param args The arguments for the command.
     * @param options The options for the command.
     * @returns A Pipe instance that represents the piped output.
     */
    pipe(name: string, args?: CommandArgs, options?: CommandOptions): Pipe;
    pipe(command: Command | ChildProcess): Pipe;
    pipe(): Pipe {
        this.options ??= {};
        this.options.stdout = "piped";
        this.options.stderr = "inherit";

        if (arguments.length === 0) {
            throw new Error("Invalid arguments");
        }

        let next: ChildProcess | Command;
        if (typeof arguments[0] === "string") {
            const args = arguments[1] as CommandArgs;
            const options = arguments[2] as CommandOptions;
            const ctor = Object.getPrototypeOf(this).constructor;
            next = new ctor(arguments[0], args, options) as Command;
            next.withStdout("piped");
            next.withStdin("piped");
        } else {
            next = arguments[0];
        }

        Command.#pipeFactory ??= new PipeFactory((file, args, options) => {
            const ctor = Object.getPrototypeOf(this).constructor;
            next = new ctor(file, args, options) as Command;
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
    async text(): Promise<string> {
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
    async lines(): Promise<string[]> {
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
    async json(): Promise<unknown> {
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
    output(): Promise<Output> {
        throw new Error("Not implemented");
    }

    /**
     * Gets the output of the command synchronously.
     * @returns The output of the command.
     */
    outputSync(): Output {
        throw new Error("Not implemented");
    }

    /**
     * Spawns a child process for the command.
     * @returns The spawned child process.
     */
    spawn(): ChildProcess {
        throw new Error("Not implemented");
    }
}

/**
 * Represents a shell command.
 */
export class ShellCommand extends Command {
    protected shellArgs?: string[];
    protected script: string;
    protected isFile?: boolean;

    /**
     * Creates a new instance of the ShellCommand class.
     * @param exe The executable command.
     * @param script The shell script or command to execute.
     * @param options The options for the shell command.
     */
    constructor(exe: string, script: string, options?: ShellCommandOptions) {
        super(exe, options?.args, options);
        this.shellArgs = options?.shellArgs;
        this.script = script;
        this.isFile = options?.isFile;
    }

    /**
     * Gets the file extension for the shell script.
     * @returns The file extension.
     */
    get ext(): string {
        return "";
    }

    override toArgs(): string[] {
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
    getShellArgs(script: string, isFile: boolean): string[] {
        const args = this.shellArgs ?? [];
        args.push(script);
        return args;
    }

    /**
     * Gets the script file information. The `file` property is undefined if the script is not a file.
     * @returns An object containing the script file path and whether it was generated.
     */
    getScriptFile(): { file: string | undefined; generated: boolean } {
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
export function cmd(exe: string, args?: CommandArgs, options?: CommandOptions): Command {
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
export function exec(command: string, options?: CommandOptions): Command {
    const args = splitArguments(command);
    if (args.length === 0) {
        throw new Error("Invalid command");
    }

    const exe = args.shift() as string;

    return cmd(exe, args, options);
}

/**
 * Represents a factory function that creates a command.
 * @param file - The file to execute.
 * @param args - Optional arguments for the command.
 * @param options - Optional options for the command.
 * @returns A command instance.
 */
export interface CommandFactory {
    (file: string, args?: CommandArgs, options?: CommandOptions): Command;
}

/**
 * Represents a pipe for executing commands and chaining them together.
 */
class Pipe {
    #promise: Promise<ChildProcess>;

    /**
     * Creates a new instance of the Pipe class.
     * @param process The initial ChildProcess to start the pipe with.
     * @param cmdFactory The factory function for creating Command instances.
     */
    constructor(
        private readonly process: ChildProcess,
        private readonly cmdFactory: CommandFactory,
    ) {
        this.#promise = Promise.resolve(process);
    }

    [key: string]: unknown;

    /**
     * Chains a command to the pipe.
     * @param name The name of the command to execute.
     * @param args The arguments to pass to the command.
     * @param options The options to configure the command.
     * @returns The updated Pipe instance.
     */
    pipe(name: string, args?: CommandArgs, options?: CommandOptions): Pipe;
    /**
     * Chains a ChildProcess, Command, or Output instance to the pipe.
     * @param next The next ChildProcess, Command, or Output instance to chain.
     * @returns The updated Pipe instance.
     */
    pipe(next: ChildProcess | Command | Output): Pipe;
    pipe(): Pipe {
        if (arguments.length === 0) {
            throw new Error("Invalid arguments");
        }

        if (typeof arguments[0] === "string") {
            const args = arguments[1] as CommandArgs;
            const options = arguments[2] as CommandOptions;
            const next = this.cmdFactory(arguments[0], args, options);
            return this.pipe(next);
        }

        const next = arguments[0];

        this.#promise = this.#promise.then(async (process) => {
            let child = next as ChildProcess;
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
                    throw new Error(
                        `Pipe failed for ${process}: ${ex.message} ${ex.stack}`,
                    );
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
    async output(): Promise<Output> {
        const process = await this.#promise;
        return process.output();
    }
}

/**
 * Represents a factory for creating Pipe instances.
 */
class PipeFactory {
    constructor(private readonly cmdFactory: CommandFactory) {}

    /**
     * Creates a new Pipe instance.
     * @param process The ChildProcess object to associate with the Pipe.
     * @returns A new Pipe instance.
     */
    create(process: ChildProcess): Pipe {
        return new Pipe(process, this.cmdFactory);
    }
}

if (globals.Deno) {
    const EMPTY = "";

    class DenoChildProcess implements ChildProcess {
        #childProcess: Deno.ChildProcess;
        #options: CommandOptions;
        #file: string;

        constructor(childProcess: Deno.ChildProcess, options: CommandOptions, file: string) {
            this.#childProcess = childProcess;
            this.#options = options;
            this.#file = file;
        }

        get stdin(): WritableStream<Uint8Array> {
            return this.#childProcess.stdin;
        }

        get stdout(): ReadableStream<Uint8Array> {
            return this.#childProcess.stdout;
        }

        get stderr(): ReadableStream<Uint8Array> {
            return this.#childProcess.stderr;
        }

        get pid(): number {
            return this.#childProcess.pid;
        }

        get status(): Promise<CommandStatus> {
            return this.#childProcess.status;
        }

        ref(): void {
            return this.#childProcess.ref();
        }

        unref(): void {
            return this.#childProcess.unref();
        }

        async output(): Promise<Output> {
            const out = await this.#childProcess.output();

            return new DenoOutput({
                stdout: this.#options.stdout === "piped" ? out.stdout : new Uint8Array(0),
                stderr: this.#options.stderr === "piped" ? out.stderr : new Uint8Array(0),
                code: out.code,
                signal: out.signal,
                success: out.success,
            }, this.#file);
        }

        kill(signo?: Signal): void {
            return this.#childProcess.kill(signo);
        }

        onDispose: (() => void) | undefined;

        [Symbol.asyncDispose](): Promise<void> {
            if (this.onDispose) {
                this.onDispose();
            }

            return this.#childProcess[Symbol.asyncDispose]();
        }
    }

    class DenoOutput implements Output {
        #text?: string;
        #lines?: string[];
        #json?: unknown;
        #errorText?: string;
        #errorLines?: string[];
        #errorJson?: unknown;
        #file: string;
        readonly stdout: Uint8Array;
        readonly stderr: Uint8Array;
        readonly code: number;
        readonly signal?: string | undefined;
        readonly success: boolean;

        constructor(output: Deno.CommandOutput, file: string) {
            this.stdout = output.stdout;
            this.stderr = output.stderr;
            this.code = output.code;
            this.signal = output.signal as string;
            this.success = output.success;
            this.#file = file;
        }

        validate(
            fn?: ((code: number) => boolean) | undefined,
            failOnStderr?: true | undefined,
        ): this {
            fn ??= (code: number) => code === 0;
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

        text(): string {
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

        lines(): string[] {
            if (this.#lines) {
                return this.#lines;
            }

            this.#lines = this.text().split(/\r?\n/);
            return this.#lines;
        }

        json(): unknown {
            if (this.#json) {
                return this.#json;
            }

            this.#json = JSON.parse(this.text());
            return this.#json;
        }
        errorText(): string {
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

        errorLines(): string[] {
            if (this.#errorLines) {
                return this.#errorLines;
            }

            this.#errorLines = this.errorText().split(/\r?\n/);
            return this.#errorLines;
        }

        errorJson(): unknown {
            if (this.#errorJson) {
                return this.#errorJson;
            }

            this.#errorJson = JSON.parse(this.errorText());
            return this.#errorJson;
        }

        toString(): string {
            return this.text();
        }
    }

    Command.prototype.spawn = function (): ChildProcess {
        const exe = pathFinder.findExeSync(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const args = this.args ? convertCommandArgs(this.args) : undefined;
        const options = {
            ...this.options,
            args: args,
        } as Deno.CommandOptions;

        if (this.options?.log) {
            this.options?.log(exe, args);
        }

        const process = new Deno.Command(exe, options);
        return new DenoChildProcess(process.spawn(), options, this.file);
    };

    Command.prototype.outputSync = function (): Output {
        const exe = pathFinder.findExeSync(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }

        const args = this.args ? convertCommandArgs(this.args) : undefined;
        const options = {
            ...this.options,
            args: args,
        } as Deno.CommandOptions;

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
    Command.prototype.output = async function (): Promise<Output> {
        const exe = await pathFinder.findExe(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const args = this.args ? convertCommandArgs(this.args) : undefined;
        const options = {
            ...this.options,
            args: args,
            // deno-lint-ignore no-explicit-any
        } as any;

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

    ShellCommand.prototype.output = async function (): Promise<Output> {
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
            } as Deno.CommandOptions;

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

    ShellCommand.prototype.outputSync = function (): Output {
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

    ShellCommand.prototype.spawn = function (): ChildProcess {
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
        } as Deno.CommandOptions;

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
    const { spawn, spawnSync } = child_process!;

    interface NodeCommonOutput {
        file: string;
        args?: string[];
        stdout: Uint8Array;
        stderr: Uint8Array;
        code: number;
        signal?: string;
        success: boolean;
    }

    class NodeOutput implements Output {
        #text?: string;
        #lines?: string[];
        #json?: unknown;
        #errorText?: string;
        #errorLines?: string[];
        #errorJson?: unknown;
        #file: string;
        #args?: string[];
        readonly stdout: Uint8Array;
        readonly stderr: Uint8Array;
        readonly code: number;
        readonly signal?: string | undefined;
        readonly success: boolean;

        constructor(output: NodeCommonOutput) {
            this.stdout = output.stdout;
            this.stderr = output.stderr;
            this.code = output.code;
            this.signal = output.signal as string;
            this.success = output.success;
            this.#file = output.file;
            this.#args = output.args;
        }

        validate(
            fn?: ((code: number) => boolean) | undefined,
            failOnStderr?: true | undefined,
        ): this {
            fn ??= (code: number) => code === 0;

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

        text(): string {
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

        lines(): string[] {
            if (this.#lines) {
                return this.#lines;
            }

            this.#lines = this.text().split(/\r?\n/);
            return this.#lines;
        }

        json(): unknown {
            if (this.#json) {
                return this.#json;
            }

            this.#json = JSON.parse(this.text());
            return this.#json;
        }
        errorText(): string {
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

        errorLines(): string[] {
            if (this.#errorLines) {
                return this.#errorLines;
            }

            this.#errorLines = this.errorText().split(/\r?\n/);
            return this.#errorLines;
        }

        errorJson(): unknown {
            if (this.#errorJson) {
                return this.#errorJson;
            }

            this.#errorJson = JSON.parse(this.errorText());
            return this.#errorJson;
        }

        toString(): string {
            return this.text();
        }
    }

    class NodeChildProcess implements ChildProcess {
        readonly #child: Node2ChildProcess;
        #stdout?: ReadableStream<Uint8Array>;
        #stderr?: ReadableStream<Uint8Array>;
        #stdin?: WritableStream<Uint8Array>;
        #status: Promise<CommandStatus>;
        #file: string;

        constructor(child: Node2ChildProcess, file: string, signal?: AbortSignal) {
            this.#child = child;
            this.#file = file;

            if (signal !== undefined) {
                signal.addEventListener("abort", () => {
                    child.kill("SIGTERM");
                });
            }

            this.#status = new Promise<CommandStatus>((resolve, reject) => {
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

        get pid(): number {
            return this.#child.pid ? this.#child.pid : -1;
        }

        get status(): Promise<CommandStatus> {
            return this.#status;
        }

        get stdout(): ReadableStream<Uint8Array> {
            if (this.#stdout) {
                return this.#stdout;
            }

            const child = this.#child;
            if (child.stdout === null) {
                throw new Error("stdout is not available");
            }

            const stream = new ReadableStream<Uint8Array>({
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

        get stderr(): ReadableStream<Uint8Array> {
            const child = this.#child;
            if (child.stderr === null) {
                throw new Error("stderr is not available");
            }

            const stream = new ReadableStream<Uint8Array>({
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

        get stdin(): WritableStream<Uint8Array> {
            if (this.#stdin) {
                return this.#stdin;
            }

            const child = this.#child;
            if (child.stdin === null) {
                throw new Error("stdin is not available");
            }

            const stream = new WritableStream<Uint8Array>({
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

        kill(signo?: Signal | undefined): void {
            if (signo === "SIGEMT") {
                signo = "SIGTERM";
            }

            this.#child.kill(signo);
        }

        ref(): void {
            this.#child.ref();
        }

        unref(): void {
            this.#child.unref();
        }

        output(): Promise<Output> {
            let stdout = new Uint8Array(0);
            let stderr = new Uint8Array(0);

            this.#child.stdout?.on("data", (data) => {
                stdout = new Uint8Array([...stdout, ...data]);
            });

            this.#child.stderr?.on("data", (data) => {
                stderr = new Uint8Array([...stderr, ...data]);
            });

            return new Promise<Output>((resolve, reject) => {
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
                    } as NodeCommonOutput;

                    resolve(new NodeOutput(o));
                });
            });
        }

        onDispose?: (() => void) | undefined;

        async [Symbol.asyncDispose](): Promise<void> {
            if (this.onDispose) {
                this.onDispose();
            }

            await this.status;
        }
    }

    // deno-lint-ignore no-inner-declarations
    function mapPipe(pipe: "inherit" | "null" | "piped" | undefined): IOType | null | undefined {
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

    Command.prototype.output = async function (): Promise<Output> {
        const exe = await pathFinder.findExe(this.file);
        if (exe === undefined) {
            throw new NotFoundOnPathError(this.file);
        }
        const args = this.args ? convertCommandArgs(this.args) : [];
        let signal: AbortSignal | undefined;
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
            signal: signal as any,
        });
        if (this.options?.log) {
            this.options.log(exe, args);
        }

        let stdout = new Uint8Array(0);
        let stderr = new Uint8Array(0);

        let code = 1;
        let sig: string | Signal | undefined;

        const promises: Promise<void>[] = [];
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
            new Promise<void>((resolve) => {
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
            new Promise<void>((resolve) => {
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
            new Promise<void>((resolve) => {
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
        } as NodeCommonOutput);
    };

    Command.prototype.outputSync = function (): Output {
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
        } as NodeCommonOutput);
    };

    Command.prototype.spawn = function (): ChildProcess {
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

    ShellCommand.prototype.output = async function (): Promise<Output> {
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

            let signal: AbortSignal | undefined;
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
                signal: signal as any,
            });

            let stdout = new Uint8Array(0);
            let stderr = new Uint8Array(0);

            let code = 1;
            let sig: string | Signal | undefined;

            const promises: Promise<void>[] = [];
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
                new Promise<void>((resolve) => {
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
                new Promise<void>((resolve) => {
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
                new Promise<void>((resolve) => {
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
            } as NodeCommonOutput);
        } finally {
            if (isFile && generated) {
                await remove(file);
            }
        }
    };

    ShellCommand.prototype.outputSync = function (): Output {
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
            } as NodeCommonOutput);
        } finally {
            if (isFile && generated) {
                removeSync(file);
            }
        }
    };

    ShellCommand.prototype.spawn = function (): ChildProcess {
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
export function run(
    exe: string,
    args?: CommandArgs,
    options?: Omit<CommandOptions, "stderr" | "stdout">,
): Promise<Output> {
    const o = (options || {}) as CommandOptions;
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
export function runSync(
    exe: string,
    args?: CommandArgs,
    options?: Omit<CommandOptions, "stderr" | "stdout">,
): Output {
    const o = (options || {}) as CommandOptions;
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
export function output(exe: string, args?: CommandArgs, options?: CommandOptions): Promise<Output> {
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
export function outputSync(exe: string, args?: CommandArgs, options?: CommandOptions): Output {
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
export function spawn(exe: string, args?: CommandArgs, options?: CommandOptions): ChildProcess {
    options ??= {};
    options.stdin ??= "inherit";
    options.stderr ??= "inherit";
    options.stdout ??= "inherit";

    return new Command(exe, args, options).spawn();
}
