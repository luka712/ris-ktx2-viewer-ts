import {useId} from "react";
import {TextField} from "@mui/material";
import {FieldLayout, type FieldProps} from "./FieldLayout.tsx";

interface TextInputFieldProps extends FieldProps {
    value: string;
    onChange: (value: string) => void;
}

export function TextInputField({label, tooltip, row, value, onChange}: TextInputFieldProps) {
    const id = useId();

    return (
        <FieldLayout label={label} tooltip={tooltip} row={row} controlId={id} labelId={`${id}-label`}>
            <TextField id={id} value={value} onChange={(e) => onChange(e.target.value)} fullWidth/>
        </FieldLayout>
    );
}
