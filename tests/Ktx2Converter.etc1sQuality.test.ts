/**
 * Focused check: ETC1S Basis qualityLevel must come from etc1sQuality,
 * not the separate uastcQuality UI field.
 *
 * Run: node --experimental-strip-types --test tests/Ktx2Converter.etc1sQuality.test.ts
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {describe, it} from "node:test";
import {
    etECT1SQualityLevel,
    KTX_HIGHEST_QUALITY,
    KTX_LOWEST_QUALITY,
} from "../src/model/CompressionQualityConstants.ts";
import {ConvertParameters} from "../src/model/ConvertParameters.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("ETC1S quality wiring", () => {
    it("maps etc1sQuality independently of uastcQuality", () => {
        const params = new ConvertParameters();
        params.uastcQuality = KTX_LOWEST_QUALITY; // → 32
        params.etc1sQuality = KTX_HIGHEST_QUALITY; // → 255

        const fromEtc1s = etECT1SQualityLevel(params.etc1sQuality);
        const fromUastc = etECT1SQualityLevel(params.uastcQuality);

        assert.equal(fromEtc1s, 255);
        assert.equal(fromUastc, 32);
        assert.notEqual(
            fromEtc1s,
            fromUastc,
            "diverging UI fields must produce different Basis quality levels",
        );
    });

    it("Ktx2Encoder (shared by worker and main-thread convert) uses convertParameters.etc1sQuality for ETC1S", () => {
        const source = readFileSync(join(here, "../src/service/Ktx2Encoder.ts"), "utf8");

        assert.match(
            source,
            /etECT1SQualityLevel\(\s*convertParameters\.etc1sQuality\s*\)/,
            "ETC1S path must read etc1sQuality (the field ConvertDialog sets from the ETC1S Quality select)",
        );
        assert.doesNotMatch(
            source,
            /etECT1SQualityLevel\(\s*convertParameters\.uastcQuality\s*\)/,
            "must not keep the old bug of feeding uastcQuality into ETC1S qualityLevel",
        );
    });
});
