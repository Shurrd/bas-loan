import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { createQueryClient } from "@/lib/query-client";

export const renderWithProviders = (ui: ReactElement, route = "/") => {
    const client = createQueryClient(false);
    const result = render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </QueryClientProvider>
    );
    return { ...result, client };
};
