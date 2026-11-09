import { cn } from "@/lib/utils";

export default function Container({
    children,
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="container"
            className={cn("flex w-full flex-col", className)}
            {...props}
        >
            {children}
        </div>
    );
}
