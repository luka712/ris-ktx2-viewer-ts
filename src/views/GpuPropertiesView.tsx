import {useMemo} from "react";
import {Box} from "@mui/material";
import {useViewerStore} from "../store/ViewerStore.ts";
import {type Property, PropertyList} from "../components/PropertyList.tsx";

const supported = (value: boolean) => (value ? "Supported" : "Not Supported");

/** Sidebar "GPU Info" tab. */
export function GpuPropertiesView() {
    const framework = useViewerStore(store => store.framework);

    const [gpuProperties, gpuFeatures] = useMemo((): [Property[], Property[]] => {
        if (!framework) {
            return [[], []];
        }

        const {gpuInfo, features} = framework.renderer.graphicsDevice;
        return [
            [
                {name: "GPU Vendor", value: gpuInfo.vendor},
                {name: "GPU", value: gpuInfo.name},
            ],
            [
                {name: "S3TC Texture Compression (BC1-BC3)", value: supported(features.supportsTextureCompressionS3TC)},
                {name: "BPTC Texture Compression (BC6-BC7)", value: supported(features.supportsTextureCompressionBC)},
                {name: "ETC2 Texture Compression", value: supported(features.supportsTextureCompressionETC2)},
                {name: "ASTC Texture Compression", value: supported(features.supportsTextureCompressionASTC)},
                {name: "PVRTC Texture Compression", value: supported(features.supportsTextureCompressionPVRTC)},
            ],
        ];
    }, [framework]);

    if (!framework) {
        return <Box sx={{p: 2}}>Initializing GPU…</Box>;
    }

    return (
        <>
            <PropertyList properties={gpuProperties}/>
            <PropertyList properties={gpuFeatures}/>
        </>
    );
}
