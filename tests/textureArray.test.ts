/**
 * Texture array rules (which selections can become one KTX2 array, layer reordering).
 *
 * Run: node --experimental-strip-types --test tests/textureArray.test.ts
 */
import assert from "node:assert/strict";
import {describe, it} from "node:test";
import type {ITexture2DContainer} from "../src/model/ITexture2DContainer.ts";
import {arrayFileName, arraySourceProblem, convertibleSources, moveItem} from "../src/service/textureArray.ts";

function image(name: string, width: number, height: number): ITexture2DContainer {
    return {id: name, name, texture: null, ktxContainer: null,
        image: {baseWidth: width, baseHeight: height} as ITexture2DContainer["image"]};
}

function ktx2(name: string): ITexture2DContainer {
    return {id: name, name, texture: null, ktxContainer: {} as ITexture2DContainer["ktxContainer"], image: null};
}

describe("arraySourceProblem", () => {
    it("accepts two or more images of the same size", () => {
        assert.equal(arraySourceProblem([image("a.png", 256, 128), image("b.png", 256, 128), image("c.webp", 256, 128)]), null);
    });

    it("needs at least two images", () => {
        assert.match(arraySourceProblem([image("a.png", 64, 64)]) ?? "", /at least two/);
    });

    it("rejects different sizes and lists them", () => {
        const problem = arraySourceProblem([image("a.png", 64, 64), image("b.png", 128, 64)]);
        assert.match(problem ?? "", /same size/);
        assert.match(problem ?? "", /64×64, 128×64/);
    });

    it("rejects KTX2 files", () => {
        assert.match(arraySourceProblem([image("a.png", 64, 64), ktx2("b.ktx2")]) ?? "", /b\.ktx2 is already a KTX2 file/);
        assert.match(arraySourceProblem([image("a.png", 64, 64), ktx2("b.ktx2"), ktx2("c.ktx2")]) ?? "", /2 of the selected/);
    });
});

describe("texture array helpers", () => {
    it("keeps only convertible images, in order", () => {
        assert.deepEqual(convertibleSources([image("a.png", 1, 1), ktx2("b.ktx2"), image("c.png", 1, 1)]).map((t) => t.name),
            ["a.png", "c.png"]);
    });

    it("names the array after the first image", () => {
        assert.equal(arrayFileName([image("grass.png", 1, 1), image("dirt.png", 1, 1)]), "grass_array.ktx2");
        assert.equal(arrayFileName([image("noext", 1, 1)]), "noext_array.ktx2");
    });

    it("moves layers up and down without mutating", () => {
        const layers = ["a", "b", "c"];
        assert.deepEqual(moveItem(layers, 1, -1), ["b", "a", "c"]);
        assert.deepEqual(moveItem(layers, 1, 1), ["a", "c", "b"]);
        assert.deepEqual(moveItem(layers, 0, -1), ["a", "b", "c"]);
        assert.deepEqual(moveItem(layers, 2, 1), ["a", "b", "c"]);
        assert.deepEqual(layers, ["a", "b", "c"]);
    });
});
