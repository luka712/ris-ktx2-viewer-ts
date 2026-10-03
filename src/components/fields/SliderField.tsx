import {Slider, Stack} from "@mui/material";
import {FieldLayout, type FieldProps} from "./FieldLayout.tsx";

interface SliderFieldProps extends FieldProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
}

export function SliderField({label, tooltip, row, value, onChange, min = 0, max = 100}: SliderFieldProps) {
    const slider = (
        <Slider
            min={min}
            max={max}
            value={value}
            onChange={(_, v) => onChange(v)}
            valueLabelDisplay="auto"
            sx={row ? {alignSelf: "start", paddingLeft: 0} : {alignSelf: "start"}}
        />
    );

    return (
        <FieldLayout label={label} tooltip={tooltip} row={row}>
            {/* Flex wrapper in row layout keeps the slider from sitting on the text baseline. */}
            {row ? <Stack direction="row">{slider}</Stack> : slider}
        </FieldLayout>
    );
}
