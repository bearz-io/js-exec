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
import type {
    ChildProcess,
    CommandArgs,
    CommandOptions,
    Output,
    ShellCommandOptions,
} from "./types.js";
export type { ChildProcess, CommandArgs, CommandOptions, Output, ShellCommandOptions };
/**
 * Converts the command arguments to an array of strings.
 * @param args Converts the command arguments to an array of strings.
 * @returns The array of strings.
 */
export declare function convertCommandArgs(args: CommandArgs): string[];
/**
 * Represents a command that can be executed.
 */
export declare class Command {
    #private;
    protected file: string;
    protected args?: CommandArgs;
    protected options?: CommandOptions;
    /**
     * Creates a new instance of the Command class.
     * @param file The executable command.
     * @param args The arguments for the command.
     * @param options The options for the command.
     */
    constructor(file: string, args?: CommandArgs, options?: CommandOptions);
    [key: string]: unknown;
    toArgs(): string[];
    toOptions(): CommandOptions;
    /**
     * Sets the current working directory for the command.
     * @param value The current working directory.
     * @returns The Command instance.
     */
    withCwd(value: string | URL): this;
    /**
     * Sets the environment variables for the command.
     * @param value The environment variables.
     * @returns The Command instance.
     */
    withEnv(value: Record<string, string>): this;
    /**
     * Sets the user ID for the command.
     * @param value The user ID.
     * @returns The Command instance.
     */
    withUid(value: number): this;
    /**
     * Sets the group ID for the command.
     * @param value The group ID.
     * @returns The Command instance.
     */
    withGid(value: number): this;
    /**
     * Sets the abort signal for the command.
     * @param value The abort signal.
     * @returns The Command instance.
     */
    withSignal(value: AbortSignal): this;
    /**
     * Sets the arguments for the command.
     * @param value The arguments.
     * @returns The Command instance.
     */
    withArgs(value: CommandArgs): this;
    /**
     * Sets the stdin behavior for the command.
     * @param value The stdin behavior.
     * @returns The Command instance.
     */
    withStdin(value: "inherit" | "piped" | "null" | undefined): this;
    /**
     * Sets the stdout behavior for the command.
     * @param value The stdout behavior.
     * @returns The Command instance.
     */
    withStdout(value: "inherit" | "piped" | "null" | undefined): this;
    /**
     * Sets the stderr behavior for the command.
     * @param value The stderr behavior.
     * @returns The Command instance.
     */
    withStderr(value: "inherit" | "piped" | "null" | undefined): this;
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
        onrejected?: ((reason: any) => TError | PromiseLike<TError>) | null | undefined,
    ): PromiseLike<TValue | TError>;
    /**
     * Runs the command asynchronously and returns a promise that resolves to the output of the command.
     * The stdout and stderr are set to `inherit`.
     * @returns A promise that resolves to the output of the command.
     */
    run(): Promise<Output>;
    /**
     * Runs the command synchronously and returns the output of the command.
     * The stdout and stderr are set to `inherit`.
     * @returns The output of the command.
     */
    runSync(): Output;
    /**
     * Pipes the output of the command to another command or child process.
     * @param name The name of the command to pipe to.
     * @param args The arguments for the command.
     * @param options The options for the command.
     * @returns A Pipe instance that represents the piped output.
     */
    pipe(name: string, args?: CommandArgs, options?: CommandOptions): Pipe;
    pipe(command: Command | ChildProcess): Pipe;
    /**
     * Gets the output of the command as text.
     * @returns A promise that resolves to the output of the command as text.
     */
    text(): Promise<string>;
    /**
     * Gets the output of the command as an array of lines.
     * @returns A promise that resolves to the output of the command as an array of lines.
     */
    lines(): Promise<string[]>;
    /**
     * Gets the output of the command as JSON.
     * @returns A promise that resolves to the output of the command as JSON.
     */
    json(): Promise<unknown>;
    /**
     * Gets the output of the command.
     * @returns A promise that resolves to the output of the command.
     */
    output(): Promise<Output>;
    /**
     * Gets the output of the command synchronously.
     * @returns The output of the command.
     */
    outputSync(): Output;
    /**
     * Spawns a child process for the command.
     * @returns The spawned child process.
     */
    spawn(): ChildProcess;
}
/**
 * Represents a shell command.
 */
export declare class ShellCommand extends Command {
    protected shellArgs?: string[];
    protected script: string;
    protected isFile?: boolean;
    /**
     * Creates a new instance of the ShellCommand class.
     * @param exe The executable command.
     * @param script The shell script or command to execute.
     * @param options The options for the shell command.
     */
    constructor(exe: string, script: string, options?: ShellCommandOptions);
    /**
     * Gets the file extension for the shell script.
     * @returns The file extension.
     */
    get ext(): string;
    toArgs(): string[];
    /**
     * Gets the shell arguments for the given script and file type.
     * @param script The shell script or command.
     * @param isFile Indicates whether the script is a file.
     * @returns An array of shell arguments.
     */
    getShellArgs(script: string, isFile: boolean): string[];
    /**
     * Gets the script file information. The `file` property is undefined if the script is not a file.
     * @returns An object containing the script file path and whether it was generated.
     */
    getScriptFile(): {
        file: string | undefined;
        generated: boolean;
    };
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
export declare function cmd(exe: string, args?: CommandArgs, options?: CommandOptions): Command;
/**
 * Converts a string representing invoking an executable into a command instance.
 * @param command The command to execute.
 * @param options The options for the command.
 * @returns The command instance.
 */
export declare function exec(command: string, options?: CommandOptions): Command;
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
declare class Pipe {
    #private;
    private readonly process;
    private readonly cmdFactory;
    /**
     * Creates a new instance of the Pipe class.
     * @param process The initial ChildProcess to start the pipe with.
     * @param cmdFactory The factory function for creating Command instances.
     */
    constructor(process: ChildProcess, cmdFactory: CommandFactory);
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
    /**
     * Retrieves the output of the pipe as an Output instance.
     * @returns A Promise that resolves to the Output instance.
     */
    output(): Promise<Output>;
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
export declare function run(
    exe: string,
    args?: CommandArgs,
    options?: Omit<CommandOptions, "stderr" | "stdout">,
): Promise<Output>;
/**
 * Run a command and return the output synchronously. This is a shorthand for
 * creating a new {@linkcode Command} and calling {@linkcode Command.outputSync}
 * with stdout and stderr set to `inherit`.
 * @param exe The executable to run.
 * @param args The arguments to pass to the executable.
 * @param options The options to run the command with.
 * @returns The output of the command.
 */
export declare function runSync(
    exe: string,
    args?: CommandArgs,
    options?: Omit<CommandOptions, "stderr" | "stdout">,
): Output;
/**
 * Run a command and return the output. This is a shorthand for creating a new
 * {@linkcode Command} and calling {@linkcode Command.output} with stderr and
 * stdout defaulting to `piped` if not set in the options.
 * @param exe The executable to run.
 * @param args The arguments to pass to the executable.
 * @param options The options to run the command with.
 * @returns The output of the command.
 */
export declare function output(
    exe: string,
    args?: CommandArgs,
    options?: CommandOptions,
): Promise<Output>;
/**
 * Run a command and return the output synchronously. This is a shorthand for
 * creating a new {@linkcode Command} and calling {@linkcode Command.outputSync}
 * with stderr and stdout defaulting to `piped` if not set in the options.
 * @param exe The executable to run.
 * @param args The arguments to pass to the executable.
 * @param options The options to run the command with.
 * @returns The output of the command.
 */
export declare function outputSync(
    exe: string,
    args?: CommandArgs,
    options?: CommandOptions,
): Output;
/**
 * Spawn a command and return the process. This is a shorthand for creating a new
 * {@linkcode Command} and calling {@linkcode Command.spawn} with stdin, stderr,
 * and stdout defaulting to `inherit` if not set in the options.
 * @param exe The executable to run.
 * @param args The arguments to pass to the executable.
 * @param options The options to run the command with.
 * @returns The process of the command.
 */
export declare function spawn(
    exe: string,
    args?: CommandArgs,
    options?: CommandOptions,
): ChildProcess;
