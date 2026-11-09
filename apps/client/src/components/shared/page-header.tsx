import type { ReactNode } from "react";

const Root = ({ children }: { children: ReactNode }) => (
    <header className="flex flex-wrap items-start justify-between gap-4 pb-6">
        {children}
    </header>
);

const Title = ({ title, subtitle }: { title?: string; subtitle?: string }) => (
    <div className="min-w-0">
        {title && (
            <h1 className="text-foreground truncate text-xl font-semibold">{title}</h1>
        )}
        {subtitle && <p className="text-gray-500 mt-0.5 text-sm">{subtitle}</p>}
    </div>
);

const Actions = ({ children }: { children: ReactNode }) => (
    <div className="flex shrink-0 items-center gap-2">{children}</div>
);

export const TopHeader = Object.assign(Root, { Title, Actions });
