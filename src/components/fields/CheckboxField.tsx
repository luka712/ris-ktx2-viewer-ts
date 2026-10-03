import {Checkbox} from "@mui/material";
import {FieldLayout, type FieldProps} from "./FieldLayout.tsx";

interface CheckboxFieldProps extends FieldProps {
    value: boolean;
    onChange: (value: boolean) => void;
}

export function CheckboxField({label, tooltip, row, value, onChange}: CheckboxFieldProps) {
    return (
        <FieldLayout label={label} tooltip={tooltip} row={row}>
            <Checkbox
                checked={value}
                onChange={(_, checked) => onChange(checked)}
                sx={row ? {alignSelf: "start", paddingLeft: 0} : {alignSelf: "start"}}
            />
        </FieldLayout>
    );
}
