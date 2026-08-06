import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is considered fresh for 60s → no refetch on remount/focus.
            staleTime: 60_000,
            // Keep pages responsive when re-entering — instant back/forward.
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: (failureCount, error) => {
                if (error?.response?.status === 401) return false;
                if (error?.response?.status === 404) return false;
                return failureCount < 2;
            },
        },
        mutations: {
            retry: 0,
        },
    },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </React.StrictMode>,
);
