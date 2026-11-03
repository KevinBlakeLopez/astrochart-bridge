/** Thrown when Swiss Ephemeris reports an error. */
export class SwissEphError extends Error {
    fn;
    detail;
    constructor(message, 
    /** The C function that failed. */
    fn, 
    /**
     * The library's own `serr` text, when `message` rephrases it.
     *
     * Kept because it is the ground truth and because a Swiss Ephemeris user
     * may recognise it — but it is not the message, since it can point
     * somewhere unhelpful. A missing-file error names the **virtual** search
     * path inside the WebAssembly filesystem (`'.:/users/ephe/'`), which does
     * not exist on the caller's machine and sends them looking in the wrong
     * place.
     */
    detail) {
        super(message);
        this.fn = fn;
        this.detail = detail;
        this.name = 'SwissEphError';
    }
    /**
     * The `.se1` file the library could not find, when that is what failed.
     *
     * Null for every other error. Useful for deciding what to fetch and retry.
     */
    get missingFile() {
        const source = this.detail ?? this.message;
        return /SwissEph file '([^']+)' not found/.exec(source)?.[1] ?? null;
    }
}
//# sourceMappingURL=types.js.map