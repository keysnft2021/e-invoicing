import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import AppShell from "@/components/layout/AppShell";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Invoices from "@/pages/Invoices";
import NewInvoice from "@/pages/NewInvoice";
import InvoiceDetail from "@/pages/InvoiceDetail";
import Customers from "@/pages/Customers";
import Suppliers from "@/pages/Suppliers";
import Products from "@/pages/Products";
import Companies from "@/pages/Companies";
import Users from "@/pages/Users";
import RolesPage from "@/pages/RolesPage";
import MyTax from "@/pages/MyTax";
import AuditLog from "@/pages/AuditLog";
import Settings from "@/pages/Settings";
import GovConfig from "@/pages/GovConfig";
import SignApprove from "@/pages/SignApprove";
import "@/App.css";

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <BrowserRouter>
                    <Toaster richColors position="top-right" />
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/sign/:sessionId" element={<SignApprove />} />
                        <Route element={<AppShell />}>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/invoices" element={<Invoices />} />
                            <Route path="/invoices/new" element={<NewInvoice />} />
                            <Route path="/invoices/:id" element={<InvoiceDetail />} />
                            <Route path="/customers" element={<Customers />} />
                            <Route path="/suppliers" element={<Suppliers />} />
                            <Route path="/products" element={<Products />} />
                            <Route path="/companies" element={<Companies />} />
                            <Route path="/users" element={<Users />} />
                            <Route path="/roles" element={<RolesPage />} />
                            <Route path="/mytax" element={<MyTax />} />
                            <Route path="/gov-config" element={<GovConfig />} />
                            <Route path="/audit" element={<AuditLog />} />
                            <Route path="/settings" element={<Settings />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </ThemeProvider>
    );
}
