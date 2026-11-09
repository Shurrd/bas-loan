import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
    return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

export function PopoverTrigger(
    props: React.ComponentProps<typeof PopoverPrimitive.Trigger>
) {
    return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

export function PopoverContent({
    className,
    align = "center",
    sideOffset = 4,
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                data-slot="popover-content"
                align={align}
                sideOffset={sideOffset}
                className={cn(
                    "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-1 motion-reduce:animate-none ring-foreground/10 z-50 flex w-72 origin-(--radix-popover-content-transform-origin) flex-col gap-4 rounded-md p-4 text-sm shadow-md ring-1 outline-hidden duration-150",
                    className
                )}
                {...props}
            />
        </PopoverPrimitive.Portal>
    );
}
