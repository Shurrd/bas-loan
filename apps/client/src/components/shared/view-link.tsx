import { Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";

export default function ViewLink({ to, label }: { to: string; label: string }) {
    return (
        <Link
            to={to}
            title={label}
            aria-label={label}
            className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
            <Eye className="size-4" />
        </Link>
    );
}
