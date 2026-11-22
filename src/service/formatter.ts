/**
 * Replaces the trailing extension of `fileName` with `ext` (e.g. ".ktx2"), or appends `ext` when there is none.
 * A leading dot (".hidden") is not treated as an extension. Example: "a.b.png" → "a.b.ktx2".
 */
export function changeFileExtension(fileName: string, ext: string): string {
    const name = fileName ?? "";
    const extIndex = name.lastIndexOf(".");
    const base = extIndex > 0 ? name.slice(0, extIndex) : name;
    return base + ext;
}

/**
 * Returns `name`, or the first free `base (n).ext` (n = 2, 3, …) if `isTaken(name)` is true.
 * Example: "brick.ktx2" → "brick (2).ktx2".
 */
export function makeUniqueName(name: string, isTaken: (candidate: string) => boolean): string {
    if (!isTaken(name)) {
        return name;
    }
    const extIndex = name.lastIndexOf(".");
    const base = extIndex > 0 ? name.slice(0, extIndex) : name;
    const ext = extIndex > 0 ? name.slice(extIndex) : "";
    for (let n = 2; ; n++) {
        const candidate = `${base} (${n})${ext}`;
        if (!isTaken(candidate)) {
            return candidate;
        }
    }
}
