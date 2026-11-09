import Select, { type StylesConfig } from "react-select";
import CreatableSelect from "react-select/creatable";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

type Props = {
    label: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    error?: string;
    hint?: string;
    placeholder?: string;
    /** Lets the officer type a value that is not in the list. */
    allowCustom?: boolean;
    isValidCustom?: (input: string) => boolean;
};

const styles: StylesConfig<SelectOption, false> = {
    control: (base, state) => ({
        ...base,
        minHeight: 41,
        borderRadius: 8,
        borderColor: state.selectProps["aria-invalid"]
            ? "var(--color-danger)"
            : state.isFocused
              ? "var(--primary)"
              : "var(--color-gray-300)",
        boxShadow: "none",
        cursor: "pointer",
        backgroundColor: "var(--background)",
        ":hover": {
            borderColor: state.isFocused ? "var(--primary)" : "var(--color-gray-300)",
        },
    }),
    valueContainer: (base) => ({ ...base, padding: "0 10px" }),
    placeholder: (base) => ({
        ...base,
        color: "var(--color-gray-500)",
        fontSize: 14,
        fontWeight: 300,
    }),
    singleValue: (base) => ({ ...base, color: "var(--foreground)", fontSize: 14 }),
    input: (base) => ({ ...base, fontSize: 14 }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base) => ({
        ...base,
        color: "var(--muted-foreground)",
        padding: "0 8px",
    }),
    menu: (base) => ({
        ...base,
        borderRadius: 6,
        border: "1px solid var(--border)",
        boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
        overflow: "hidden",
    }),
    // A modal dialog turns off pointer events outside itself, and this menu is portaled outside it
    menuPortal: (base) => ({ ...base, zIndex: 999, pointerEvents: "auto" }),
    option: (base, state) => ({
        ...base,
        fontSize: 14,
        cursor: "pointer",
        padding: "8px 12px",
        color: state.isSelected ? "var(--primary)" : "var(--foreground)",
        fontWeight: state.isSelected ? 500 : 400,
        backgroundColor: state.isSelected
            ? "color-mix(in oklab, var(--primary) 8%, transparent)"
            : state.isFocused
              ? "var(--muted)"
              : "transparent",
    }),
};

export default function SelectField({
    label,
    name,
    value,
    onChange,
    options,
    error,
    hint,
    placeholder = "Select or type",
    allowCustom = false,
    isValidCustom = () => true,
}: Props) {
    const id = `field-${name}`;
    const errorId = `${id}-error`;
    const selected =
        options.find((option) => option.value === value) ??
        (value ? { value, label: value } : null);

    const shared = {
        inputId: id,
        instanceId: id,
        options,
        value: selected,
        placeholder,
        styles,
        "aria-invalid": error ? true : undefined,
        "aria-errormessage": error ? errorId : undefined,
        menuPortalTarget: typeof document === "undefined" ? undefined : document.body,
        menuPosition: "fixed" as const,
        onChange: (option: SelectOption | null) => onChange(option?.value ?? ""),
    };

    return (
        <div
            role="group"
            aria-labelledby={`${id}-label`}
            aria-describedby={error ? errorId : undefined}
        >
            <label id={`${id}-label`} htmlFor={id} className="input-label">
                {label}
            </label>
            {allowCustom ? (
                <CreatableSelect<SelectOption, false>
                    {...shared}
                    formatCreateLabel={(input) => `Use ${input}`}
                    isValidNewOption={(input) => isValidCustom(input.trim())}
                    getNewOptionData={(input) => ({
                        value: input.trim(),
                        label: input.trim(),
                    })}
                />
            ) : (
                <Select<SelectOption, false> {...shared} />
            )}
            {hint && !error && <p className="text-gray-500 mt-1 text-xs">{hint}</p>}
            {error && (
                <p id={errorId} className={cn("error-message")}>
                    {error}
                </p>
            )}
        </div>
    );
}
