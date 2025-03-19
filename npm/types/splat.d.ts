/**
 * The `splat` module provides a function to convert an object
 * to an array of command line arguments.
 *
 * @module
 */
import type { SplatObject, SplatOptions } from "./types.js";
export type { SplatObject, SplatOptions };
/**
 * Special keys in a splat object that use
 * symbols to avoid conflicts with other keys
 * and to provide a way to access the values.
 *
 * @example
 * ```ts
 *
 * const args = {
 *   [SplatSymbols.command]: "run",
 *   [SplatSymbols.arguments]: ["task"],
 *   yes: true,
 * }
 *
 * splat(args); // ["run", "task", "--yes"]
 */
export declare const SplatSymbols: Record<string, symbol>;
/**
 * Converts an object to an `string[]` of command line arguments.
 *
 * @description
 * This is a modified version of the dargs npm package.  Its useful for converting an object to an array of command line arguments
 * especially when using typescript interfaces to provide intellisense and type checking for command line arguments
 * for an executable or commands in an executable.
 *
 * The code https://github.com/sindresorhus/dargs which is under under MIT License.
 * The original code is Copyrighted under (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 * @param object The object to convert.
 * @param options The {@linkcode SplatOptions} to use for the conversion.
 * @returns An array of command line arguments.
 * @example
 * ```ts
 * let args = splat({ foo: "bar" });
 * console.log(args); // ["--foo", "bar"]
 *
 * args = splat({
 *     '*': ['foo', 'bar'], // positional arguments
 *     foo: "bar", // option
 *     yes: true, // flag
 *     '_': ["baz"], // remaining arguments
 *     '--': ["--baz"], // extra arguments
 * })
 *
 * console.log(args); // ["foo", "bar", "--foo", "bar", "--yes", "baz", "--", "--baz"]
 *
 * args = splat({
 *     [SplatSymbols.command]: "run",
 *     [SplatSymbols.arguments]: ["task1", "task2"],
 *     yes: true
 * });
 *
 * console.log(args); // ["run", "task", "task2" "--yes"]
 *
 * args = splat({
 *     "foo": "bar",
 *      "test": "baz",
 *      splat: {
 *          argumentNames: ["foo"],
 *          assign: "=",
 *      }
 * })
 *
 * console.log(args); // ["bar", "--foo=baz"]
 *
 * ```
 */
export declare function splat(object: SplatObject, options?: SplatOptions): string[];
