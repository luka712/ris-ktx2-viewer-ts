/**
 * Tests for the persisted Display color space switch (sRGB | Linear).
 *
 * Run: node --experimental-strip-types --test tests/displayColorSpaceStorage.test.ts
 */
import {beforeEach, describe, it} from "node:test";
import assert from "node:assert/strict";
import {ColorSpace} from "ris-framework";
import {
    DISPLAY_COLOR_SPACE_STORAGE_KEY,
    loadDisplayColorSpace,
    saveDisplayColorSpace,
} from "../src/service/displayColorSpaceStorage.ts";

const store = new Map<string, string>();
const globals = globalThis as unknown as { localStorage: unknown };
globals.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
};

describe("display color space storage", () => {
    beforeEach(() => store.clear());

    it("defaults to sRGB when nothing is saved", () => {
        assert.equal(loadDisplayColorSpace(), ColorSpace.SRGB);
    });

    it("round-trips Linear and sRGB under the documented key", () => {
        assert.equal(DISPLAY_COLOR_SPACE_STORAGE_KEY, "ris-ktx2-viewer.displayColorSpace");
        saveDisplayColorSpace(ColorSpace.LINEAR);
        assert.equal(store.get(DISPLAY_COLOR_SPACE_STORAGE_KEY), ColorSpace.LINEAR);
        assert.equal(loadDisplayColorSpace(), ColorSpace.LINEAR);
        saveDisplayColorSpace(ColorSpace.SRGB);
        assert.equal(loadDisplayColorSpace(), ColorSpace.SRGB);
    });

    it("falls back to sRGB for invalid and stale values (old FILE option)", () => {
        for (const value of ["FILE", "srgb", "", "NONE", "{}"]) {
            store.set(DISPLAY_COLOR_SPACE_STORAGE_KEY, value);
            assert.equal(loadDisplayColorSpace(), ColorSpace.SRGB, value);
        }
    });

    it("falls back to sRGB and ignores saves when storage throws", () => {
        const saved = globals.localStorage;
        globals.localStorage = {
            getItem: () => { throw new Error("denied"); },
            setItem: () => { throw new Error("denied"); },
        };
        try {
            assert.equal(loadDisplayColorSpace(), ColorSpace.SRGB);
            assert.doesNotThrow(() => saveDisplayColorSpace(ColorSpace.LINEAR));
        } finally {
            globals.localStorage = saved;
        }
    });
});
