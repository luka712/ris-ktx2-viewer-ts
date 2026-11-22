/**
 * Persisting the rendering backend switch (WebGL2 | WebGPU) and probing WebGPU.
 *
 * Run: node --experimental-strip-types --test tests/backendStorage.test.ts
 */
import assert from "node:assert/strict";
import {beforeEach, describe, it} from "node:test";
import {GpuBackend} from "ris-framework";
import {
    BACKEND_STORAGE_KEY,
    backendName,
    loadBackend,
    probeWebGpuAsync,
    saveBackend
} from "../src/service/backendStorage.ts";

const store = new Map<string, string>();
const globals = globalThis as Record<string, unknown>;
const memoryStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
};
globals.localStorage = memoryStorage;

describe("backend storage", () => {
    beforeEach(() => store.clear());

    it("defaults to WebGL2", () => {
        assert.equal(loadBackend(), GpuBackend.WEB_GL);
    });

    it("round-trips under ris-ktx2-viewer.backend as a stable string", () => {
        assert.equal(BACKEND_STORAGE_KEY, "ris-ktx2-viewer.backend");
        saveBackend(GpuBackend.WEB_GPU);
        assert.equal(store.get(BACKEND_STORAGE_KEY), "webgpu");
        assert.equal(loadBackend(), GpuBackend.WEB_GPU);
        saveBackend(GpuBackend.WEB_GL);
        assert.equal(store.get(BACKEND_STORAGE_KEY), "webgl2");
        assert.equal(loadBackend(), GpuBackend.WEB_GL);
    });

    it("falls back to WebGL2 for invalid values and unavailable storage", () => {
        for (const value of ["1", "2", "WebGPU", "", "default"]) {
            store.set(BACKEND_STORAGE_KEY, value);
            assert.equal(loadBackend(), GpuBackend.WEB_GL, value);
        }
        globals.localStorage = {getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }};
        try {
            assert.equal(loadBackend(), GpuBackend.WEB_GL);
            assert.doesNotThrow(() => saveBackend(GpuBackend.WEB_GPU));
        } finally {
            globals.localStorage = memoryStorage;
        }
    });

    it("names the backends", () => {
        assert.equal(backendName(GpuBackend.WEB_GL), "WebGL2");
        assert.equal(backendName(GpuBackend.WEB_GPU), "WebGPU");
    });
});

describe("probeWebGpuAsync", () => {
    it("reports a missing navigator.gpu, a missing adapter, a failing request and success", async () => {
        assert.equal((await probeWebGpuAsync(undefined)).status, "unavailable");
        const gpu = (adapter: () => Promise<unknown>) => ({requestAdapter: adapter}) as unknown as GPU;
        const none = await probeWebGpuAsync(gpu(async () => null));
        assert.deepEqual(none, {status: "unavailable", reason: "WebGPU is present, but no GPU adapter is available."});
        const failed = await probeWebGpuAsync(gpu(async () => { throw new Error("blocked"); }));
        assert.equal(failed.status, "unavailable");
        assert.match(failed.status === "unavailable" ? failed.reason : "", /blocked/);
        assert.deepEqual(await probeWebGpuAsync(gpu(async () => ({}))), {status: "available"});
    });
});
