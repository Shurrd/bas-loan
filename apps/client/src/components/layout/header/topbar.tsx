import { MenuIcon } from "lucide-react";

export default function Topbar({ onMenu }: { onMenu: () => void }) {
    return (
        <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4">
            <button
                type="button"
                onClick={onMenu}
                aria-label="Open menu"
                className="hover:bg-muted rounded-md p-1.5 md:hidden"
            >
                <MenuIcon className="size-5" />
            </button>
            <span className="text-gray-500 text-sm">Loan origination and repayment</span>
        </div>
    );
}
