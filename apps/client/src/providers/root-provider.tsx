import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { createQueryClient } from "@/lib/query-client";

const queryClient = createQueryClient(1);

export default function RootProvider({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>{children}</BrowserRouter>
            <Toaster position="top-right" closeButton />
        </QueryClientProvider>
    );
}
