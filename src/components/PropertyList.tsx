import {Divider} from "@mui/material";
import {Fragment} from "react";
import {Panel} from "./Panel.tsx";
import {TextBlockField} from "./fields/TextBlockField.tsx";

export interface Property {
    name: string;
    value: string;
}

/**
 * Read-only name/value rows in a panel, separated by dividers.
 */
export function PropertyList({properties}: { properties: Property[] }) {
    if (properties.length === 0) {
        return null;
    }

    return (
        <Panel>
            {properties.map((property, index) => (
                <Fragment key={`${property.name}-${index}`}>
                    {index > 0 && <Divider/>}
                    <TextBlockField label={property.name} text={property.value}/>
                </Fragment>
            ))}
        </Panel>
    );
}
