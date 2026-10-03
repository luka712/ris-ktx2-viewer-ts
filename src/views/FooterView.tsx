import {Paper, Stack, Typography} from "@mui/material";
import {type IKtx2Texture, VkFormat } from "ris-ktx2-api";
import {useTextureStore} from "../store/TextureStore.ts";

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

function ktx2FormatLabel(ktx2: IKtx2Texture): string {
    if (ktx2.vkFormat === VkFormat.UNDEFINED) {
        return ktx2.needsTranscoding ? "Universal Basis" : "—";
    }
    return VkFormat[ktx2.vkFormat] ?? `Unknown (${ktx2.vkFormat})`;
}

/**
 * Footer strip showing selected texture metrics.
 */
export function FooterView() {
    const resolution = useTextureStore((store) => store.resolution);
    const memory = useTextureStore((store) => store.size);
    const selectedTexture = useTextureStore((store) => store.selectedTexture);

    const ktx2 = selectedTexture?.ktxContainer;
    const mipLevels = selectedTexture?.texture?.mipLevels ?? 0;

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
                {ktx2 && <FooterStat label="Ktx2 Format" value={ktx2FormatLabel(ktx2)}/>}
            </Stack>
        </Paper>
    );
}
