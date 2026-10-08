/**
 * Mip chain length used by the KTX2 converter and unique output names.
 *
 * Run: node --experimental-strip-types --test tests/mipLevels.test.ts
 */
import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {mipLevelCount} from "../src/service/mipLevels.ts";
import {makeUniqueName} from "../src/service/formatter.ts";

/** Sizes produced by repeatedly halving with Math.floor, like ris-framework's generateMipmapsAsync. */
function chain(width: number, height: number, levels: number): Array<[number, number]> {
    const sizes: Array<[number, number]> = [[width, height]];
    for (let i = 1; i < levels; i++) {
        width = Math.floor(width / 2);
        height = Math.floor(height / 2);
        sizes.push([width, height]);
    }
    return sizes;
}

describe("mipLevelCount", () => {
    it("RGBA goes down to 1×1 and never to 0", () => {
        assert.equal(mipLevelCount(256, 256, 1), 9);
        assert.equal(mipLevelCount(300, 300, 1), 9);
        assert.equal(mipLevelCount(512, 256, 1), 9);
        for (const [w, h] of [[256, 256], [300, 300], [512, 256], [1000, 3], [1, 1]]) {
            const sizes = chain(w, h, mipLevelCount(w, h, 1));
            assert.ok(sizes.every(([x, y]) => x >= 1 && y >= 1), `${w}x${h}: ${JSON.stringify(sizes)}`);
            assert.equal(Math.min(...sizes.at(-1)!), 1);
        }
    });

    it("Basis stops at 4 on the smaller side", () => {
        assert.equal(mipLevelCount(256, 256, 4), 7); // 256 … 4
        assert.equal(mipLevelCount(1024, 256, 4), 7); // 1024x256 … 16x4
        assert.equal(mipLevelCount(4, 4, 4), 1);
        assert.equal(mipLevelCount(8, 8, 4), 2);
    });
});

describe("makeUniqueName", () => {
    it("keeps a free name and numbers taken ones", () => {
        const taken = new Set(["a.ktx2", "a (2).ktx2"]);
        assert.equal(makeUniqueName("b.ktx2", (n) => taken.has(n)), "b.ktx2");
        assert.equal(makeUniqueName("a.ktx2", (n) => taken.has(n)), "a (3).ktx2");
        assert.equal(makeUniqueName("noext", (n) => n === "noext"), "noext (2)");
    });
});
