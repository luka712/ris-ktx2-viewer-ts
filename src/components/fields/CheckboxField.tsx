import {useId} from "react";
import {Checkbox} from "@mui/material";
import {FieldLayout, type FieldProps} from "./FieldLayout.tsx";

interface CheckboxFieldProps extends FieldProps {
    value: boolean;
    onChange: (value: boolean) => void;
}

export function CheckboxField({label, tooltip, row, value, onChange}: CheckboxFieldProps) {
    const id = useId();

    return (
        <FieldLayout label={label} tooltip={tooltip} row={row} controlId={id} labelId={`${id}-label`}>
            <Checkbox
                id={id}
                checked={value}
                onChange={(_, checked) => onChange(checked)}
                slotProps={{input: {"aria-labelledby": `${id}-label`}}}
                sx={row ? {alignSelf: "start", paddingLeft: 0} : {alignSelf: "start"}}
            />
        </FieldLayout>
    );
}
