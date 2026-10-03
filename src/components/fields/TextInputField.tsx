import {TextField} from "@mui/material";
import {FieldLayout, type FieldProps} from "./FieldLayout.tsx";

interface TextInputFieldProps extends FieldProps {
    value: string;
    onChange: (value: string) => void;
}

export function TextInputField({label, tooltip, row, value, onChange}: TextInputFieldProps) {
    return (
        <FieldLayout label={label} tooltip={tooltip} row={row}>
            <TextField value={value} onChange={(e) => onChange(e.target.value)} fullWidth/>
        </FieldLayout>
    );
}
