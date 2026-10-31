import {Paper, Stack, Typography} from "@mui/material";
import {VkFormat} from "ris-ktx2";
import type {FrameworkKtx2Texture} from "../model/FrameworkKtx2.ts";
import {formatFileSize, textureDetails, useSelectedTexture} from "../store/TextureStore.ts";

function FooterStat({label, value}: { label: string; value: string | number }) {
    return (
        <Stack spacing={0.25} sx={{alignItems: "center"}}>
            <Typography variant="caption" sx={{opacity: 0.6, fontSize: 11, lineHeight: 1.2}}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{fontSize: 13, lineHeight: 1.2}}>
                {value}
            </Typography>
        </Stack>
    );
}

/**
 * sRGB / Linear from the VkFormat name. Basis data reports UNDEFINED and the framework's ris-ktx2 0.1
 * does not expose the DFD transfer function, so it shows "—".
 */
function ktx2ColorSpace(ktx2: FrameworkKtx2Texture): string {
    if (ktx2.vkFormat === VkFormat.UNDEFINED) {
        // TODO: Show sRGB/Linear for Basis textures once the DFD transfer function is exposed.
        return "—";
    }
    return (VkFormat[ktx2.vkFormat] ?? "").includes("SRGB") ? "sRGB" : "Linear";
}

function ktx2FormatLabel(ktx2: FrameworkKtx2Texture): string {
    if (ktx2.vkFormat === VkFormat.UNDEFINED) {
        return ktx2.needsTranscoding ? "Universal Basis" : "—";
    }
    return VkFormat[ktx2.vkFormat] ?? `Unknown (${ktx2.vkFormat})`;
}

/**
 * Footer strip showing selected texture metrics.
 */
export function FooterView() {
    const selectedTexture = useSelectedTexture();
    const {resolution, size: memory, mipLevels} = textureDetails(selectedTexture?.texture);

    const ktx2 = selectedTexture?.ktxContainer;

    return (
        <Paper elevation={3} sx={{borderRadius: 5, px: {xs: 1, sm: 2}, py: 2}}>
            <Stack
                direction="row"
                spacing={2.5}
                useFlexGap
                sx={{
                    justifyContent: {xs: "flex-start", sm: "flex-end"},
                    flexWrap: "wrap",
                    gap: 2,
                }}
            >
                <FooterStat label="Resolution" value={resolution}/>
                <FooterStat label="Mip Levels" value={mipLevels}/>
                <FooterStat label="GPU Memory" value={memory}/>
                <FooterStat label="File Size" value={formatFileSize(selectedTexture?.fileSize)}/>
                {ktx2 && <FooterStat label="Ktx2 Format" value={ktx2FormatLabel(ktx2)}/>}
                {ktx2 && <FooterStat label="Color Space" value={ktx2ColorSpace(ktx2)}/>}
            </Stack>
        </Paper>
    );
}
