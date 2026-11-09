import {
    CircleAlert,
    CircleCheck,
    Info,
    LoaderCircle,
    TriangleAlert,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
    return (
        <Sonner
            theme="light"
            className="toaster group"
            icons={{
                success: <CircleCheck className="size-4" />,
                info: <Info className="size-4" />,
                warning: <TriangleAlert className="size-4" />,
                error: <CircleAlert className="size-4" />,
                loading: <LoaderCircle className="size-4 animate-spin" />,
            }}
            style={
                {
                    "--normal-bg": "var(--popover)",
                    "--normal-text": "var(--popover-foreground)",
                    "--normal-border": "var(--border)",
                    "--border-radius": "var(--radius)",
                } as React.CSSProperties
            }
            {...props}
        />
    );
}
