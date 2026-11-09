import { NumericFormat } from "react-number-format";
import { cn } from "@/lib/utils";

type Props = Omit<
    React.ComponentProps<"input">,
    "onChange" | "value" | "defaultValue" | "ref" | "size"
> & {
    label: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    hint?: string;
    /** Shows thousands separators as the officer types. The value stays a plain digit string. */
    amount?: boolean;
};

export default function TextField({
    label,
    name,
    value,
    onChange,
    error,
    hint,
    amount = false,
    className,
    type = "text",
    ...rest
}: Props) {
    const id = `field-${name}`;
    const errorId = `${id}-error`;

    const inputProps = {
        id,
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : undefined,
        className: cn(
            "input-control placeholder:text-sm placeholder:font-light placeholder:text-gray-500",
            error && "error-style",
            className
        ),
        ...rest,
    };

    return (
        <div>
            <label htmlFor={id} className="input-label">
                {label}
            </label>
            {amount ? (
                <NumericFormat
                    {...inputProps}
                    value={value}
                    thousandSeparator=","
                    allowNegative={false}
                    valueIsNumericString
                    onValueChange={(values, source) => {
                        // A value set by the parent is not a keystroke, so it must not look like an edit
                        if (source.source === "event") onChange(values.value);
                    }}
                />
            ) : (
                <input
                    {...inputProps}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}
            {hint && !error && <p className="text-gray-500 mt-1 text-xs">{hint}</p>}
            {error && (
                <p id={errorId} className="error-message">
                    {error}
                </p>
            )}
        </div>
    );
}
