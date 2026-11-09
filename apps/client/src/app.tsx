import { Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "@/components/layout";
import InvoiceDetailPage from "@/pages/invoices/detail/page";
import InvoicesPage from "@/pages/invoices/list/page";
import LoanDetailPage from "@/pages/loans/detail/page";
import LoansPage from "@/pages/loans/list/page";
import StatementPage from "@/pages/loans/statement/page";

export default function App() {
    return (
        <Routes>
            <Route element={<DashboardLayout />}>
                <Route index element={<Navigate to="/loans" replace />} />
                <Route path="/loans" element={<LoansPage />} />
                <Route path="/loans/:id" element={<LoanDetailPage />} />
                <Route path="/loans/:id/statement" element={<StatementPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            </Route>
        </Routes>
    );
}
