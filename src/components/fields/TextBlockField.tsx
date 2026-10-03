import {Typography} from "@mui/material";
import {FieldLayout, type FieldProps} from "./FieldLayout.tsx";

interface TextBlockFieldProps extends FieldProps {
    text: string;
}

/** Read-only field: dimmed label with the value as a heading. */
export function TextBlockField({label, tooltip, row, text}: TextBlockFieldProps) {
    return (
        <FieldLayout label={label} tooltip={tooltip} row={row}>
            <Typography component="span" variant="h6">{text}</Typography>
        </FieldLayout>
    );
}
