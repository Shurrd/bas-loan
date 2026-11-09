import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Flat bordered surface with an optional titled header row. */
export default function Panel({
    title,
    action,
    children,
    className,
}: {
    title?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn("rounded-md border bg-white", className)}>
            {title && (
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h2 className="text-sm font-medium">{title}</h2>
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}
