import type {ReactNode} from "react";
import {Box, Divider, IconButton, Paper, Tooltip, Typography} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

interface SidePanelProps {
    title: string;
    side: "left" | "right";
    open: boolean;
    onToggle: () => void;
    width: number;
    actions?: ReactNode;
    children: ReactNode;
}

/** Desktop side panel that collapses to a thin rail with a « / » toggle. */
export function SidePanel({title, side, open, onToggle, width, actions, children}: SidePanelProps) {
    const collapseIcon = side === "left" ? <ChevronLeftIcon/> : <ChevronRightIcon/>;
    const expandIcon = side === "left" ? <ChevronRightIcon/> : <ChevronLeftIcon/>;

    if (!open) {
        return (
            <Paper elevation={1} sx={{width: 40, flexShrink: 0, borderRadius: 2, display: "flex",
                flexDirection: "column", alignItems: "center", pt: 0.5}}>
                <Tooltip title={`Show ${title}`} placement={side === "left" ? "right" : "left"}>
                    <IconButton size="small" aria-label={`Show ${title}`} aria-expanded={false} onClick={onToggle}>
                        {expandIcon}
                    </IconButton>
                </Tooltip>
                <Typography variant="caption" color="text.secondary"
                            sx={{writingMode: "vertical-rl", mt: 1, userSelect: "none"}}>
                    {title}
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper elevation={1} component="aside" aria-label={title}
               sx={{width, flexShrink: 0, borderRadius: 2, display: "flex", flexDirection: "column", minHeight: 0}}>
            <Box sx={{display: "flex", alignItems: "center", pl: 2, pr: 0.5, minHeight: 40,
                flexDirection: side === "left" ? "row" : "row-reverse"}}>
                <Typography variant="subtitle2" sx={{flex: 1, textAlign: side === "left" ? "left" : "right", pr: side === "right" ? 1.5 : 0}}>
                    {title}
                </Typography>
                {actions}
                <Tooltip title={`Hide ${title}`}>
                    <IconButton size="small" aria-label={`Hide ${title}`} aria-expanded onClick={onToggle}>
                        {collapseIcon}
                    </IconButton>
                </Tooltip>
            </Box>
            <Divider/>
            <Box sx={{flex: 1, minHeight: 0, overflowY: "auto"}}>{children}</Box>
        </Paper>
    );
}
