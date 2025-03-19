/**
 * The `logger` module provides a way to set a default logger function
 * for logging command execution details.
 *
 * @module
 */
/**
 * Set the default logger function to write
 * commands when they are invoked.
 *
 * @param defaultLogger The logger function to use.
 * @example
 * ```typescript
 * import { setLogger } from "@bearz/exec/set-logger";
 * setLogger(console.log);
 * ```
 */
export declare function setLogger(defaultLogger?: (file: string, args?: string[]) => void): void;
/**
 * Gets the default logger function.
 * @returns The default logger function.
 */
export declare function getLogger(): undefined | ((file: string, args?: string[]) => void);
