import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

// Radix marks elements data-state="open" and "closed". It opens with a short rise, fade and
// grow, and closes a little faster. Reduced-motion users get no movement.
const OVERLAY_MOTION = cn(
    "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] ease-out motion-reduce:animate-none",
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200",
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150"
);

const CONTENT_MOTION = cn(
    "ease-out motion-reduce:animate-none",
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-6 data-[state=open]:duration-250",
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-3 data-[state=closed]:duration-150"
);

export function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

export function DialogContent({
    className,
    children,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
    return (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay
                data-slot="dialog-overlay"
                className={OVERLAY_MOTION}
            />
            <DialogPrimitive.Content
                data-slot="dialog-content"
                className={cn(
                    "bg-background ring-foreground/10 fixed top-1/2 left-1/2 z-50 grid max-h-[90vh] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-xl p-6 text-sm shadow-2xl ring-1 outline-none sm:max-w-md",
                    CONTENT_MOTION,
                    className
                )}
                {...props}
            >
                {children}
                <DialogPrimitive.Close
                    className="hover:bg-muted absolute top-4 right-4 rounded-md p-1.5"
                    aria-label="Close"
                >
                    <X className="size-4" />
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-header"
            className={cn("flex flex-col gap-1.5 pr-8", className)}
            {...props}
        />
    );
}

export function DialogTitle({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot="dialog-title"
            className={cn("text-base leading-none font-semibold", className)}
            {...props}
        />
    );
}

export function DialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            className={cn("text-gray-500 text-sm", className)}
            {...props}
        />
    );
}
