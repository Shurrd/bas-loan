import Logo from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import Menu from "./menu";
import { NavItems } from "./nav-items";

export default function AppSidebar({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    return (
        <>
            {open && (
                <div
                    className="fixed inset-0 z-20 bg-black/30 md:hidden"
                    onClick={onClose}
                    aria-hidden
                />
            )}
            <aside
                className={cn(
                    "bg-sidebar fixed inset-y-0 left-0 z-30 flex w-58 flex-col border-r transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0",
                    open ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex h-14 items-center border-b px-4">
                    <Logo />
                </div>
                <nav className="flex flex-1 flex-col gap-4 px-3 py-4">
                    <div>
                        <p className="nav-link-label">Portfolio</p>
                        <div className="flex flex-col gap-1">
                            {NavItems.portfolio.map((item) => (
                                <Menu key={item.path} item={item} onNavigate={onClose} />
                            ))}
                        </div>
                    </div>
                </nav>
            </aside>
        </>
    );
}
