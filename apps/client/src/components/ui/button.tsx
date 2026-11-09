import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const buttonVariants = cva(
    "focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-3 inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none select-none",
    {
        variants: {
            variant: {
                primary: "bg-primary text-primary-foreground hover:bg-primary/90",
                outline:
                    "border-border bg-background hover:bg-muted hover:text-foreground shadow-xs",
                ghost: "hover:bg-muted hover:text-foreground",
            },
            size: {
                sm: "h-8 gap-1 px-2.5",
                md: "h-10.25 gap-1 px-3",
                icon: "size-9",
            },
        },
        defaultVariants: { variant: "primary", size: "md" },
    }
);

export { buttonVariants };

type ButtonProps = React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        label?: string;
        isLoading?: boolean;
        loadingText?: string;
    };

export function Button({
    className,
    variant,
    size,
    label,
    isLoading = false,
    loadingText = "Please wait",
    children,
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            data-slot="button"
            className={cn(buttonVariants({ variant, size }), className)}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    {loadingText}
                </span>
            ) : (
                (children ?? label)
            )}
        </button>
    );
}
