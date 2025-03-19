/**
 * The `split-arguments` module provides a function to split a string into an array of arguments.
 * It handles quoted arguments, space-separated arguments, and multiline strings.
 *
 * @module
 */
/**
 * Split a string into an array of arguments. The function will handle
 * arguments that are quoted, arguments that are separated by spaces, and multiline
 * strings that include a backslash (\\) or backtick (`) at the end of the line for cases
 * where the string uses bash or powershell multi line arguments.
 * @param value
 * @returns a `string[]` of arguments.
 * @example
 * ```ts
 * const args0 = splitArguments("hello world");
 * console.log(args0); // ["hello", "world"]
 *
 * const args1 = splitArguments("hello 'dog world'");
 * console.log(args1); // ["hello", "dog world"]
 *
 * const args2 = splitArguments("hello \"cat world\"");
 * console.log(args2); // ["hello", "cat world"]
 *
 * const myArgs = `--hello \
 * "world"`
 * const args3 = splitArguments(myArgs);
 * console.log(args3); // ["--hello", "world"]
 * ```
 */
export declare function splitArguments(value: string): string[];
/**
 * Joins command arguments into a single string.
 * @param args The command arguments to join.
 * @returns The joined command arguments.
 */
export declare function joinArgs(args: string[]): string;
