import { format } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    captionLayout = "label",
    components,
    ...props
}: React.ComponentProps<typeof DayPicker>) {
    const defaults = getDefaultClassNames();

    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            captionLayout={captionLayout}
            className={cn(
                "group/calendar bg-background p-3 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(8)] in-data-[slot=popover-content]:bg-transparent",
                className
            )}
            classNames={{
                root: cn("w-fit", defaults.root),
                months: cn("relative flex flex-col gap-4 md:flex-row", defaults.months),
                month: cn("flex w-full flex-col gap-4", defaults.month),
                nav: cn(
                    "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
                    defaults.nav
                ),
                button_previous: cn(
                    buttonVariants({ variant: "ghost" }),
                    "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
                    defaults.button_previous
                ),
                button_next: cn(
                    buttonVariants({ variant: "ghost" }),
                    "size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
                    defaults.button_next
                ),
                month_caption: cn(
                    "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
                    defaults.month_caption
                ),
                dropdowns: cn(
                    "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
                    defaults.dropdowns
                ),
                dropdown_root: cn(
                    "relative rounded-(--cell-radius)",
                    defaults.dropdown_root
                ),
                dropdown: cn("absolute inset-0 bg-popover opacity-0", defaults.dropdown),
                caption_label: cn(
                    "font-medium select-none",
                    captionLayout === "label"
                        ? "text-sm"
                        : "flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
                    defaults.caption_label
                ),
                table: "w-full border-collapse",
                weekdays: cn("flex", defaults.weekdays),
                weekday: cn(
                    "flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none",
                    defaults.weekday
                ),
                week: cn("mt-2 flex w-full", defaults.week),
                day: cn(
                    "group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none",
                    defaults.day
                ),
                today: cn(
                    "rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none",
                    defaults.today
                ),
                outside: cn(
                    "text-muted-foreground aria-selected:text-muted-foreground",
                    defaults.outside
                ),
                disabled: cn("text-muted-foreground opacity-50", defaults.disabled),
                hidden: cn("invisible", defaults.hidden),
                ...classNames,
            }}
            components={{
                Root: ({ className, rootRef, ...rest }) => (
                    <div
                        data-slot="calendar"
                        ref={rootRef}
                        className={cn(className)}
                        {...rest}
                    />
                ),
                Chevron: ({ className, orientation, ...rest }) => {
                    if (orientation === "left") {
                        return (
                            <ChevronLeft className={cn("size-4", className)} {...rest} />
                        );
                    }
                    if (orientation === "right") {
                        return (
                            <ChevronRight className={cn("size-4", className)} {...rest} />
                        );
                    }
                    return <ChevronDown className={cn("size-4", className)} {...rest} />;
                },
                DayButton: CalendarDayButton,
                ...components,
            }}
            {...props}
        />
    );
}

function CalendarDayButton({
    className,
    day,
    modifiers,
    ...props
}: React.ComponentProps<typeof DayButton>) {
    const ref = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (modifiers.focused) ref.current?.focus();
    }, [modifiers.focused]);

    return (
        <Button
            ref={ref}
            variant="ghost"
            size="icon"
            data-day={format(day.date, "yyyy-MM-dd")}
            data-selected-single={modifiers.selected}
            className={cn(
                "relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
                className
            )}
            {...props}
        />
    );
}
