/**
 * The `which` module provides a way to find the full path of an executable file
 * given its name.
 *
 * @module
 */
/**
 * which - Returns the full path of the executable file of the given program;
 * otherwise, returns undefined.
 *
 * @remarks The returned path is the full path of the executable file of the given program
 * if the program can be found in the system PATH environment variable or
 * using any of the paths from `prependedPaths` if specified.
 *
 * By default, `which` will cache the first lookup and then use the cache
 * for subsequent lookups unless `useCache` is set to false.
 *
 * @param {string} fileName The program file name.
 * @param {(string[] | undefined)} prependPath The paths to prepend to the PATH environment variable.
 * @param {IEnvironment} env The environment class to use to lookup environment variables. Defaults to `envDefault`.
 * @param {boolean} useCache
 * @returns {string | undefined}
 */
export declare function whichSync(
    fileName: string,
    prependPath?: string[],
    useCache?: boolean,
    debug?: boolean,
): string | undefined;
/**
 * which - Returns the full path of the executable file of the given program;
 * otherwise, returns undefined.
 *
 * @remarks The returned path is the full path of the executable file of the given program
 * if the program can be found in the system PATH environment variable or
 * using any of the paths from `prependedPaths` if specified.
 *
 * By default, `which` will cache the first lookup and then use the cache
 * for subsequent lookups unless `useCache` is set to false.
 *
 * @param {string} fileName The program file name.
 * @param {(string[] | undefined)} prependPath The paths to prepend to the PATH environment variable.
 * @param {IEnvironment} env The environment class to use to lookup environment variables. Defaults to `envDefault`.
 * @param {boolean} useCache
 * @returns {string | undefined}
 */
export declare function which(
    fileName: string,
    prependPath?: string[],
    useCache?: boolean,
    debug?: boolean,
): Promise<string | undefined>;
