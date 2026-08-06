import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import AppShell from "@/components/layout/AppShell";
import Login from "@/pages/Login";
import "@/App.css";

// Lazy-load every authenticated page — smaller initial bundle, faster login.
const DebitNotes         = lazy(() => import("@/pages/DebitNotes"));
const OperationLogReport = lazy(() => import("@/pages/OperationLogReport"));
const Profile            = lazy(() => import("@/pages/Profile"));
const Dashboard        = lazy(() => import("@/pages/Dashboard"));
const Invoices         = lazy(() => import("@/pages/Invoices"));
const NewInvoice       = lazy(() => import("@/pages/NewInvoice"));
const InvoiceDetail    = lazy(() => import("@/pages/InvoiceDetail"));
const Customers        = lazy(() => import("@/pages/Customers"));
const Suppliers        = lazy(() => import("@/pages/Suppliers"));
const Products         = lazy(() => import("@/pages/Products"));
const Companies        = lazy(() => import("@/pages/Companies"));
const Users            = lazy(() => import("@/pages/Users"));
const RolesPage        = lazy(() => import("@/pages/RolesPage"));
const MyTax            = lazy(() => import("@/pages/MyTax"));
const AuditLog         = lazy(() => import("@/pages/AuditLog"));
const Settings         = lazy(() => import("@/pages/Settings"));
const GovConfig        = lazy(() => import("@/pages/GovConfig"));
const SignApprove      = lazy(() => import("@/pages/SignApprove"));
const ApiClients       = lazy(() => import("@/pages/ApiClients"));
const IcsLayout        = lazy(() => import("@/pages/ics/IcsLayout"));
const IcsDashboard     = lazy(() => import("@/pages/ics/IcsDashboard"));
const IcsTransactions  = lazy(() => import("@/pages/ics/IcsTransactions"));
const IcsConsolidated  = lazy(() => import("@/pages/ics/IcsConsolidated"));
const IcsFiscalDocument = lazy(() => import("@/pages/ics/IcsFiscalDocument"));
const IcsReports       = lazy(() => import("@/pages/ics/IcsReports"));
const IcsBasicInfo     = lazy(() => import("@/pages/ics/IcsBasicInfo"));

function PageFallback() {
    return (
        <div className="flex h-64 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <BrowserRouter>
                    <Toaster richColors position="top-right" />
                    <Suspense fallback={<PageFallback />}>
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
                                <Route path="/api-clients" element={<ApiClients />} />
                                <Route path="/ics" element={<IcsLayout />}>
                                    <Route index element={<IcsDashboard />} />
                                    <Route path="my-transaction" element={<IcsTransactions />} />
                                    <Route path="consolidated" element={<IcsConsolidated />} />
                                    <Route path="fiscal-document" element={<IcsFiscalDocument />} />
                                    <Route path="reports" element={<IcsReports />} />
                                    <Route path="basic-info" element={<IcsBasicInfo />} />
                                </Route>
                                <Route path="/audit" element={<AuditLog />} />
                                <Route path="/debit-notes" element={<DebitNotes />} />
                                <Route path="/operation-log" element={<OperationLogReport />} />
                                <Route path="/profile" element={<Profile />} />
                                <Route path="/settings" element={<Settings />} />
                            </Route>
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Suspense>
                </BrowserRouter>
            </AuthProvider>
        </ThemeProvider>
    );
}
