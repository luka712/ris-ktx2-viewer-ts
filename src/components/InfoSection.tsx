import type {ReactNode} from "react";
import {Box, Typography} from "@mui/material";

/** Overline section heading (Inspector, GPU info). */
export function SectionTitle({children}: { children: ReactNode }) {
    return (
        <Typography variant="overline" color="text.secondary" sx={{px: 2, pt: 1.5, display: "block", lineHeight: 2}}>
            {children}
        </Typography>
    );
}

/** Name/value rows; the value wraps (long VkFormat names). */
export function InfoRow({label, value}: { label: string; value: ReactNode }) {
    return (
        <Box sx={{display: "flex", justifyContent: "space-between", gap: 2, px: 2, py: 0.5}}>
            <Typography variant="body2" color="text.secondary" sx={{flexShrink: 0}}>{label}</Typography>
            <Typography variant="body2" component="div" sx={{textAlign: "right", wordBreak: "break-word"}}>{value}</Typography>
        </Box>
    );
}
