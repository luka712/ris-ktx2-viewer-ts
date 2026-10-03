import {MenuItem, Select} from "@mui/material";
import {FieldLayout, type FieldProps} from "./FieldLayout.tsx";

type OptionValue = string | number;

/** A select option: either a plain value (shown as-is) or a value with a display label. */
export type SelectOption<T extends OptionValue> = T | { value: T; label: string };

interface SelectFieldProps<T extends OptionValue> extends FieldProps {
    value: T;
    options: readonly SelectOption<T>[];
    onChange: (value: T) => void;
    /** Tooltip (native title) on the select itself. */
    valueTooltip?: string;
}

export function SelectField<T extends OptionValue>({
                                                       label, tooltip, row, value, options, onChange, valueTooltip,
                                                   }: SelectFieldProps<T>) {
    return (
        <FieldLayout label={label} tooltip={tooltip} row={row}>
            <Select
                value={value}
                label={label}
                sx={{marginTop: 1, marginBottom: 1, height: "40px"}}
                onChange={(e) => onChange(e.target.value as T)}
                fullWidth
                title={valueTooltip}
            >
                {options.map((option) => {
                    const {value, label} = typeof option === "object" ? option : {value: option, label: String(option)};
                    return <MenuItem key={value} value={value}>{label}</MenuItem>;
                })}
            </Select>
        </FieldLayout>
    );
}
