import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
    label: string;
    name: string;
    /** YYYY-MM-DD. Kept as a string so a time zone can never shift the day. */
    value: string;
    onChange: (value: string) => void;
    error?: string;
    placeholder?: string;
};

const START = new Date(2000, 0, 1);
const END = new Date(2100, 11, 31);

const toDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return year && month && day ? new Date(year, month - 1, day) : undefined;
};

const toValue = (date: Date) => format(date, "yyyy-MM-dd");

export default function DatePicker({
    label,
    name,
    value,
    onChange,
    error,
    placeholder = "Select date",
}: Props) {
    const [open, setOpen] = useState(false);
    const id = `field-${name}`;
    const errorId = `${id}-error`;
    const selected = toDate(value);

    return (
        <div>
            <label htmlFor={id} className="input-label">
                {label}
            </label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        id={id}
                        type="button"
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        className={cn(
                            "bg-background flex min-h-10.25 w-full items-center justify-between rounded-md border border-gray-300 px-2 py-2 text-sm shadow-xs",
                            "focus-visible:border-primary outline-none",
                            !selected && "text-muted-foreground",
                            error && "error-style"
                        )}
                    >
                        <span className="truncate">
                            {selected ? format(selected, "dd/MM/yyyy") : placeholder}
                        </span>
                        <CalendarIcon className="size-4 opacity-50" />
                    </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={selected}
                        defaultMonth={selected}
                        startMonth={START}
                        endMonth={END}
                        captionLayout="dropdown"
                        onSelect={(date) => {
                            if (!date) return;
                            onChange(toValue(date));
                            setOpen(false);
                        }}
                    />
                </PopoverContent>
            </Popover>
            {error && (
                <p id={errorId} className="error-message">
                    {error}
                </p>
            )}
        </div>
    );
}
