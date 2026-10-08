import {type IFramework, type ISampler, MipMapSamplerFilter, SamplerDescriptor, SamplerFilter} from "ris-framework";
import {create} from "zustand";
import {View2D} from "../model/View.ts";

/**
 * Framework instance and viewer display settings (view mode, sampler filter).
 * GPU capabilities are read from `framework.graphicsDevice.features`.
 *
 * The framework is set by useFramework; other stores/services read it via
 * `useViewerStore.getState().framework`.
 */
interface ViewerStore {
    framework: IFramework | null;
    /** Set when the GPU framework could not be created (e.g. no WebGL2). */
    initError: string | null;

    view: string;
    filter: SamplerFilter;
    sampler: ISampler | undefined;

    setFramework: (framework: IFramework) => void;
    /** Disposes the sampler and forgets the framework (viewport unmounted). */
    clearFramework: () => void;
    setInitError: (message: string) => void;
    setView: (view: string) => void;
    setFilter: (filter: SamplerFilter) => void;
}

function createSampler(
    framework: IFramework,
    filter: SamplerFilter,
    previous?: ISampler,
): ISampler {
    previous?.dispose();

    const descriptor = new SamplerDescriptor();
    descriptor.minFilter = filter;
    descriptor.magFilter = filter;
    descriptor.mipMapFilter = filter == SamplerFilter.LINEAR ? MipMapSamplerFilter.LINEAR : MipMapSamplerFilter.NEAREST;
    return framework.graphicsDevice.createSampler(descriptor);
}

export const useViewerStore = create<ViewerStore>((set, get) => ({
    framework: null,
    initError: null,

    view: View2D,
    filter: SamplerFilter.LINEAR,
    sampler: undefined,

    setFramework: (framework) => {
        const {filter, sampler} = get();
        set({
            framework,
            initError: null,
            sampler: createSampler(framework, filter, sampler),
        });
    },

    clearFramework: () => {
        get().sampler?.dispose();
        set({framework: null, sampler: undefined});
    },

    setInitError: (initError) => set({initError}),

    setView: (view) => set({view}),

    setFilter: (filter) => {
        const {framework, sampler} = get();
        if (!framework) {
            return;
        }

        set({
            filter,
            sampler: createSampler(framework, filter, sampler),
        });
    },
}));
