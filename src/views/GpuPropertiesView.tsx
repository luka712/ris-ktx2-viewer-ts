import {useMemo, useState} from "react";
import {Alert, Box, Button, Chip, CircularProgress, Divider, Stack, Tooltip, Typography} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DoneIcon from "@mui/icons-material/Done";
import {useViewerStore} from "../store/viewerStore.ts";
import {InfoRow, SectionTitle} from "../components/InfoSection.tsx";
import {type FormatFamilySupport, formatGpuSummary, readGpuSummary} from "../service/gpuInfo.ts";

async function copyText(text: string) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    // Fallback for non-secure contexts (e.g. LAN IP during development).
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) {
        throw new Error("Copy is not available");
    }
}

function FormatFamilyCard({family}: { family: FormatFamilySupport }) {
    const status = family.supported ? "Supported" : "Not supported";
    const details = family.supported
        ? [`${family.formatCount.supported}/${family.formatCount.total} formats`,
            ...(family.srgb === null ? [] : [family.srgb ? "sRGB" : "no sRGB"])].join(" · ")
        : status;
    return (
        <Box role="listitem" aria-label={`${family.name}: ${status}`}
             sx={{
                 display: "flex", gap: 1, alignItems: "flex-start", p: 1, borderRadius: 1,
                 border: 1, borderColor: family.supported ? "success.main" : "divider",
                 bgcolor: family.supported ? "action.hover" : "transparent",
                 opacity: family.supported ? 1 : 0.75,
             }}>
            {family.supported
                ? <CheckCircleIcon color="success" fontSize="small" sx={{mt: 0.25}} titleAccess="Supported"/>
                : <CancelOutlinedIcon color="disabled" fontSize="small" sx={{mt: 0.25}} titleAccess="Not supported"/>}
            <Box sx={{minWidth: 0}}>
                <Typography variant="body2" sx={{fontWeight: 500}}>
                    {family.name}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ml: 0.75}}>{family.alias}</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>{details}</Typography>
                {family.supported &&
                    <Typography variant="caption" color="text.secondary" sx={{display: "block", fontStyle: "italic"}}>
                        {family.hint}
                    </Typography>}
            </Box>
        </Box>
    );
}

/** "Copy" for the GPU info dialog actions: copies a plain-text summary for bug reports. Hidden until the GPU is ready. */
export function GpuInfoCopyButton() {
    const framework = useViewerStore(store => store.framework);
    const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
    if (!framework) {
        return null;
    }
    const copy = async () => {
        try {
            await copyText(formatGpuSummary(readGpuSummary(framework), navigator.userAgent));
            setCopied("ok");
        } catch {
            setCopied("failed");
        }
        window.setTimeout(() => setCopied(null), 2000);
    };
    return (
        <Tooltip title="Copy a plain-text summary for bug reports">
            <Button size="small" onClick={copy} color={copied === "failed" ? "error" : "primary"}
                    startIcon={copied === "ok" ? <DoneIcon/> : <ContentCopyIcon/>}>
                {copied === "ok" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy"}
            </Button>
        </Tooltip>
    );
}

/** Header Info menu → "GPU info" dialog content: device summary, compressed formats, limits. */
export function GpuPropertiesView() {
    const framework = useViewerStore(store => store.framework);
    const initError = useViewerStore(store => store.initError);

    const summary = useMemo(() => framework ? readGpuSummary(framework) : null, [framework]);

    if (!summary) {
        if (initError) {
            return <Alert severity="error" sx={{m: 2}}>GPU initialization failed: {initError}</Alert>;
        }
        return (
            <Stack direction="row" spacing={1.5} sx={{p: 2, alignItems: "center"}}>
                <CircularProgress size={18}/>
                <Typography variant="body2" color="text.secondary">Initializing GPU…</Typography>
            </Stack>
        );
    }

    const supportedCount = summary.families.filter((family) => family.supported).length;

    return (
        <Stack sx={{pb: 1}}>
            <Box sx={{px: 2, pt: 2, pb: 1, display: "flex", gap: 1, alignItems: "flex-start"}}>
                <Box sx={{minWidth: 0, flex: 1}}>
                    <Typography variant="subtitle1" sx={{fontWeight: 600, lineHeight: 1.3, wordBreak: "break-word"}}>
                        {summary.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{wordBreak: "break-word"}}>
                        {summary.vendor}
                    </Typography>
                </Box>
                <Chip size="small" color="primary" variant="outlined" label={summary.backend} aria-label={`Backend ${summary.backend}`}/>
            </Box>
            {summary.apiVersion && <InfoRow label="API version" value={summary.apiVersion}/>}

            <Divider sx={{mt: 1}}/>
            <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", pr: 2}}>
                <SectionTitle>Compressed texture formats</SectionTitle>
                <Typography variant="caption" color="text.secondary" sx={{pt: 1.5}}>
                    {supportedCount}/{summary.families.length}
                </Typography>
            </Box>
            <Box role="list" aria-label="Compressed texture formats"
                 sx={{px: 2, pb: 1, display: "grid", gap: 1, gridTemplateColumns: {xs: "repeat(auto-fill, minmax(148px, 1fr))", sm: "1fr 1fr"}}}>
                {summary.families.map((family) => <FormatFamilyCard key={family.id} family={family}/>)}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{px: 2}}>
                Uncompressed RGBA8 always works. Basis Universal files are transcoded to the best supported format.
            </Typography>

            {summary.limits && <>
                <Divider sx={{mt: 1.5}}/>
                <SectionTitle>Limits</SectionTitle>
                {summary.limits.map((limit) => <InfoRow key={limit.label} label={limit.label} value={limit.value}/>)}
            </>}
        </Stack>
    );
}
