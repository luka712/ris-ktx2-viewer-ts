import {Grid, Stack, Tooltip, Typography} from "@mui/material";
import type {ReactNode} from "react";

/** Props shared by every labeled field. */
export interface FieldProps {
    /** Text shown next to (row) or above (column) the control. */
    label: string;
    /** Optional tooltip shown when hovering the label. */
    tooltip?: string;
    /** Label on the left (4/12) and control on the right (8/12), instead of label above control. */
    row?: boolean;
}

interface FieldLayoutProps extends FieldProps {
    children: ReactNode;
    /** id of the label element, for aria-labelledby on the control. */
    labelId?: string;
    /** id of the control, so the label's htmlFor focuses it. */
    controlId?: string;
}

/**
 * Label + control layout used by all fields.
 * Column: dimmed label above the control (properties panel).
 * Row: label in a 4-column cell, control in an 8-column cell (dialogs).
 */
export function FieldLayout({label, tooltip, row, children, labelId, controlId}: FieldLayoutProps) {
    const text = (
        <Typography
            id={labelId}
            component="label"
            htmlFor={controlId}
            sx={{opacity: row ? 0.75 : 0.5}}
        >
            {label}
        </Typography>
    );
    const labelElement = tooltip ? <Tooltip title={tooltip}>{text}</Tooltip> : text;

    if (row) {
        return (
            <Grid container direction="row" spacing={0} sx={{justifyContent: "center", alignItems: "center"}}>
                <Grid size={4}>{labelElement}</Grid>
                <Grid size={8}>{children}</Grid>
            </Grid>
        );
    }

    return (
        <Stack direction="column" spacing={0} sx={{px: 2, py: 1}}>
            {labelElement}
            {children}
        </Stack>
    );
}
