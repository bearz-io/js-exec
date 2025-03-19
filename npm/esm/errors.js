/**
 * The `errors` module provides error classes for handling command execution errors.
 *
 * @module
 */
/**
 * Represents an error that occurs when executing a command.
 */
export class CommandError extends Error {
    /**
     * The exit code of the command.
     */
    exitCode;
    /**
     * The name of the command.
     */
    fileName;
    /**
     * The arguments passed to the command.
     */
    args;
    /**
     * The descriptor of the target when the error occurred.
     */
    target;
    /**
     * A link to more information about the error.
     */
    link;
    /**
     * Creates a new instance of the CommandError class.
     */
    constructor() {
        const arg = arguments.length === 1 ? arguments[0] : undefined;
        const options = typeof arg === "object" ? arguments[0] : {};
        const message = typeof arg === "string" ? arguments[0] : options.message;
        super(
            message ?? `Command ${options?.fileName} failed with exit code ${options?.code}`,
            options,
        );
        this.name = "CommandError";
        this.exitCode = options.code;
        this.fileName = options.fileName;
        this.args = options.args;
        this.target = options.target;
        this.link = options.link ?? "https://jsr.io/@bearz/exec/doc/errors/~/CommandError";
    }
}
export class NotFoundOnPathError extends Error {
    /**
     * The descriptor of the target when the error occurred.
     */
    target;
    /**
     * A link to more information about the error.
     */
    link;
    /**
     * The name or path of the command that was not found.
     */
    exe;
    constructor() {
        const arg = arguments.length === 1 ? arguments[0] : undefined;
        const options = typeof arg === "object" ? arguments[0] : {};
        const message = typeof arg === "string" ? arguments[0] : options.message;
        super(message ?? `Executable ${options.exe} not found on environment PATH.`, options);
        this.name = "NotFoundOnPathError";
        this.target = options.target;
        this.link = options.link ?? "https://jsr.io/@bearz/exec/doc/errors/~/NotFoundOnPathError";
        this.exe = options.exe;
    }
}
