
## Tests

When writing tests import test from "node:test"


## Documentation

When generating documentation always include the original code and 
add the doc comments.

When generating documentation for a TypeScript or JavaScript constructor use
the template "Creates a new instance of {{Type}}" where "{{Type}} is the name of
the class for the summary.

```typescript

export class AssertError extends Error {
   

    /**
     * Creates a new instance of AssertError
     * @param message The error message.
     * @param options Optional. The options for the error.
     */
    constructor(message: string, options?: AssertErrorOptions) {
        super(message, options);
        this.name = "AssertError";
        this.link = options?.link ?? "https://jsr.io/@bearz/assert/docs/assert-error";
        this.target = options?.target
    }
}

```