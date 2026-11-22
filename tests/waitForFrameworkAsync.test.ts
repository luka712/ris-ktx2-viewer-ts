/**
 * waitForFrameworkAsync: abort, the getState/subscribe race, and initError.
 *
 * Run: node --experimental-strip-types --test tests/waitForFrameworkAsync.test.ts
 */
import assert from "node:assert/strict";
import {afterEach, describe, it} from "node:test";
import type {IFramework} from "ris-framework";
import {useViewerStore, waitForFrameworkAsync} from "../src/store/viewerStore.ts";

const fakeFramework = {} as IFramework;

function resetViewer() {
    useViewerStore.setState({framework: null, initError: null, sampler: undefined});
}

function timeout(ms: number, label: string): Promise<never> {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(label)), ms);
    });
}

describe("waitForFrameworkAsync", () => {
    afterEach(resetViewer);

    it("resolves immediately when a framework is already set", async () => {
        useViewerStore.setState({framework: fakeFramework, initError: null});
        assert.equal(await waitForFrameworkAsync(), fakeFramework);
    });

    it("resolves when the framework is set after the wait starts", async () => {
        const pending = waitForFrameworkAsync();
        queueMicrotask(() => useViewerStore.setState({framework: fakeFramework, initError: null}));
        assert.equal(await pending, fakeFramework);
    });

    it("resolves if the framework appears between the first store read and subscribe", async () => {
        const originalSubscribe = useViewerStore.subscribe;
        useViewerStore.subscribe = ((listener: Parameters<typeof originalSubscribe>[0]) => {
            useViewerStore.setState({framework: fakeFramework, initError: null});
            return originalSubscribe(listener);
        }) as typeof originalSubscribe;
        try {
            assert.equal(
                await Promise.race([waitForFrameworkAsync(), timeout(500, "timed out waiting for framework")]),
                fakeFramework,
            );
        } finally {
            useViewerStore.subscribe = originalSubscribe;
        }
    });

    it("rejects immediately when the signal is already aborted", async () => {
        useViewerStore.setState({framework: fakeFramework, initError: null});
        const controller = new AbortController();
        controller.abort();
        await assert.rejects(() => waitForFrameworkAsync(controller.signal), {name: "AbortError"});
    });

    it("rejects when the signal aborts while waiting", async () => {
        const controller = new AbortController();
        const pending = waitForFrameworkAsync(controller.signal);
        queueMicrotask(() => controller.abort());
        await assert.rejects(() => pending, {name: "AbortError"});
    });

    it("rejects immediately when initialization has already failed", async () => {
        useViewerStore.setState({framework: null, initError: "WebGL2 is not available"});
        await assert.rejects(() => waitForFrameworkAsync(), {message: "WebGL2 is not available"});
    });

    it("rejects when initialization fails while waiting", async () => {
        const pending = waitForFrameworkAsync();
        queueMicrotask(() => useViewerStore.setState({initError: "WebGL2 is not available"}));
        await assert.rejects(() => pending, {message: "WebGL2 is not available"});
    });
});
