import { useState } from "react";
import { Outlet } from "react-router-dom";
import Topbar from "./header/topbar";
import AppSidebar from "./sidebar/app-sidebar";

export default function DashboardLayout() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="flex min-h-screen">
            <AppSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
            <div className="bg-cloud flex min-w-0 flex-1 flex-col">
                <Topbar onMenu={() => setMenuOpen(true)} />
                <main className="mx-auto w-full max-w-350 flex-1 px-6 py-6">
                    <Outlet />
                </main>
                <footer className="text-gray-500 px-6 pb-5 text-xs">
                    Lending © {new Date().getFullYear()}
                </footer>
            </div>
        </div>
    );
}
