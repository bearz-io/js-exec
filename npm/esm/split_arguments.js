/**
 * The `split-arguments` module provides a function to split a string into an array of arguments.
 * It handles quoted arguments, space-separated arguments, and multiline strings.
 *
 * @module
 */
import {
    CHAR_BACKWARD_SLASH,
    CHAR_CARRIAGE_RETURN,
    CHAR_DOUBLE_QUOTE,
    CHAR_GRAVE_ACCENT,
    CHAR_LINE_FEED,
    CHAR_SINGLE_QUOTE,
    CHAR_SPACE,
} from "@bearz/chars/constants";
import { StringBuilder } from "@bearz/strings/string-builder";
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
export function splitArguments(value) {
    let Quote;
    (function (Quote) {
        Quote[Quote["None"] = 0] = "None";
        Quote[Quote["Single"] = 1] = "Single";
        Quote[Quote["Double"] = 2] = "Double";
    })(Quote || (Quote = {}));
    let quote = Quote.None;
    const tokens = [];
    const sb = new StringBuilder();
    for (let i = 0; i < value.length; i++) {
        const c = value.codePointAt(i);
        if (c === undefined) {
            break;
        }
        if (quote > Quote.None) {
            if (
                (c === CHAR_SINGLE_QUOTE || c === CHAR_DOUBLE_QUOTE) &&
                value.codePointAt(i - 1) === CHAR_BACKWARD_SLASH
            ) {
                const copy = sb.toArray().subarray(0, sb.length - 1);
                sb.clear();
                sb.appendCharArray(copy);
                sb.appendChar(c);
                continue;
            }
            if (quote === Quote.Single && c === CHAR_SINGLE_QUOTE) {
                quote = Quote.None;
                if (sb.length > 0) {
                    tokens.push(sb.toString());
                }
                sb.clear();
                continue;
            } else if (quote === Quote.Double && c === CHAR_DOUBLE_QUOTE) {
                quote = Quote.None;
                if (sb.length > 0) {
                    tokens.push(sb.toString());
                }
                sb.clear();
                continue;
            }
            sb.appendChar(c);
            continue;
        }
        if (c === CHAR_SPACE) {
            const remaining = (value.length - 1) - i;
            if (remaining > 2) {
                // if the line ends with characters that normally allow for scripts with multiline
                // statements, consume token and skip characters.
                // ' \\\n'
                // ' \\\r\n'
                // ' `\n'
                // ' `\r\n'
                const j = value.codePointAt(i + 1);
                const k = value.codePointAt(i + 2);
                if (j === CHAR_SINGLE_QUOTE || j === CHAR_GRAVE_ACCENT) {
                    if (k === CHAR_LINE_FEED) {
                        i += 2;
                        if (sb.length > 0) {
                            tokens.push(sb.toString());
                        }
                        sb.clear();
                        continue;
                    }
                    if (remaining > 3) {
                        const l = value.codePointAt(i + 3);
                        if (k === CHAR_CARRIAGE_RETURN && l === CHAR_LINE_FEED) {
                            i += 3;
                            if (sb.length > 0) {
                                tokens.push(sb.toString());
                            }
                            sb.clear();
                            continue;
                        }
                    }
                }
            }
            if (sb.length > 0) {
                tokens.push(sb.toString());
            }
            sb.clear();
            continue;
        }
        if (c === CHAR_BACKWARD_SLASH) {
            const next = value.codePointAt(i + 1);
            if (next === CHAR_SPACE || next === CHAR_SINGLE_QUOTE || next === CHAR_DOUBLE_QUOTE) {
                sb.appendChar(c);
                sb.appendChar(next);
                i++;
                continue;
            } else {
                sb.appendChar(c);
                continue;
            }
        }
        if (sb.length === 0) {
            if (c === CHAR_SINGLE_QUOTE || c === CHAR_DOUBLE_QUOTE) {
                if (i > 0 && value.codePointAt(i - 1) === CHAR_BACKWARD_SLASH) {
                    sb.appendChar(c);
                    continue;
                }
                quote = c === CHAR_SINGLE_QUOTE ? Quote.Single : Quote.Double;
                continue;
            }
        }
        sb.appendChar(c);
    }
    if (sb.length > 0) {
        tokens.push(sb.toString());
    }
    sb.clear();
    return tokens;
}
/**
 * Joins command arguments into a single string.
 * @param args The command arguments to join.
 * @returns The joined command arguments.
 */
export function joinArgs(args) {
    return args.map((arg) => {
        if (arg.match(/[\$']/gm)) {
            return `"${arg}"`;
        } else if (arg.match(/[\n\r\s\t"]/gm)) {
            return `'${arg}'`;
        } else {
            return arg;
        }
    }).join(" ");
}
