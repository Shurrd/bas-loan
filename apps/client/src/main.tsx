import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import RootProvider from "./providers/root-provider";
import "@fontsource-variable/geist";
import "./assets/styles/globals.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <RootProvider>
            <App />
        </RootProvider>
    </StrictMode>
);
