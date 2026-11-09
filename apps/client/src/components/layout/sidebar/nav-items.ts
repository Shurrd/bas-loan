import { FileText, Landmark, type LucideIcon } from "lucide-react";

export type MenuList = {
    title: string;
    path: string;
    icon?: LucideIcon;
};

export const NavItems = {
    portfolio: [
        { title: "Loans", path: "/loans", icon: Landmark },
        { title: "Invoices", path: "/invoices", icon: FileText },
    ],
} satisfies Record<string, MenuList[]>;
