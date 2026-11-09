import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { MenuList } from "./nav-items";

const menuClass = (active: boolean) =>
    active
        ? "relative bg-primary/8 text-primary font-medium before:absolute before:top-2 before:bottom-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
        : "text-cloud-600 hover:text-foreground";

export default function Menu({
    item,
    onNavigate,
}: {
    item: MenuList;
    onNavigate?: () => void;
}) {
    const Icon = item.icon;

    return (
        <NavLink
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
                cn(
                    "flex h-9 items-center gap-3 rounded-md px-3 text-sm",
                    menuClass(isActive)
                )
            }
        >
            {Icon && <Icon className="size-4" />}
            <span>{item.title}</span>
        </NavLink>
    );
}
