import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isServerProblem, serverProblemMessage } from "@/lib/errors";

// Every failed request to a down or broken server becomes one toast, wherever it came from
const notifyServerProblem = (error: unknown) => {
    if (isServerProblem(error))
        toast.error(serverProblemMessage(error), { id: "server-problem" });
};

export const createQueryClient = (retry: number | false) =>
    new QueryClient({
        queryCache: new QueryCache({ onError: notifyServerProblem }),
        mutationCache: new MutationCache({ onError: notifyServerProblem }),
        defaultOptions: {
            queries: { retry, refetchOnWindowFocus: false },
            mutations: { retry: false },
        },
    });
