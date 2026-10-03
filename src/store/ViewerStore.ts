import {type IFramework, type ISampler, MipMapSamplerFilter, SamplerDescriptor, SamplerFilter} from "ris-framework-api";
import {create} from "zustand";
import {View2D} from "../model/View.ts";

/**
 * Framework instance, GPU capabilities and viewer display settings
 * (view mode, sampler filter, displayed mip level).
 *
 * The framework is set once by App; other stores/services read it via
 * `useViewerStore.getState().framework`.
 */
interface ViewerStore {
    framework: IFramework | null;

    supportsBC7: boolean;
    supportsASTC: boolean;
    supportsETC2: boolean;
    supportsBC3: boolean;

    view: string;
    filter: SamplerFilter;
    sampler: ISampler | undefined;
    mipLevel: number;

    setFramework: (framework: IFramework) => void;
    setView: (view: string) => void;
    setFilter: (filter: SamplerFilter) => void;
    setMipLevel: (mipLevel: number) => void;
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

    supportsBC7: false,
    supportsASTC: false,
    supportsETC2: false,
    supportsBC3: false,

    view: View2D,
    filter: SamplerFilter.LINEAR,
    sampler: undefined,
    mipLevel: 0,

    setFramework: (framework) => {
        const features = framework?.graphicsDevice.features;
        const {filter, sampler} = get();

        set({
            framework,
            supportsBC3: features?.supportsTextureCompressionS3TC,
            supportsBC7: features?.supportsTextureCompressionBC,
            supportsASTC: features?.supportsTextureCompressionASTC,
            supportsETC2: features?.supportsTextureCompressionETC2,
            sampler: createSampler(framework, filter, sampler),
        });
    },

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

    setMipLevel: (mipLevel) => set({mipLevel}),
}));
