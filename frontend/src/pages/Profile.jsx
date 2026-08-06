import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCompany } from "@/context/CompanyContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Save, X, RefreshCw, Eye, EyeOff } from "lucide-react";

function nowStr() {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
}
function genCode() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function Profile() {
    const { user } = useAuth();
    const { companies, current } = useCompany();

    return (
        <div className="pb-16">
            {/* Section A: Basic Information */}
            <SectionBar title="Section A: Basic Information" />
            <Card>
                <TF l="Account"><Input value={user?.email || ""} disabled data-testid="prof-account" /></TF>
                <TF l="User Name"><Input value={user?.name || user?.email?.split("@")[0] || ""} disabled data-testid="prof-name" /></TF>
                <TF l="Contact Number"><Input value={user?.phone || "0175510666"} disabled data-testid="prof-phone" /></TF>
                <div />
            </Card>

            {/* Section B: My Company */}
            <SectionBar title="Section B: My Company" />
            <div className="mb-4 rounded-b-md border-x border-b border-border bg-card p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => toast.info("Taxpayer's info maintenance opens the company editor in /companies.")}>
                        Taxpayer&apos;s Info Maintenance
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toast.info("User Binding lets you link additional users to this company.")}>
                        User Binding
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toast.info("Contract details opens the LHDN intermediary contract on file.")}>
                        Contract Details
                    </Button>
                </div>
                <div className="overflow-x-auto rounded border border-border">
                    <table className="w-full text-sm">
                        <thead className="bg-primary text-primary-foreground">
                            <tr>
                                <th className="w-10 px-3 py-2" />
                                <Th>NO.</Th><Th>TIN</Th><Th>Name</Th>
                                <Th>Number of Contracts</Th>
                                <Th>Contact Name</Th><Th>Contact Number</Th>
                                <Th>Email</Th><Th>Role Name</Th>
                                <Th>Enable large file download</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {companies.length === 0 ? (
                                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No Company</td></tr>
                            ) : companies.map((c, i) => (
                                <tr key={c.id} className="border-b border-border/50">
                                    <td className="px-3 py-2">
                                        <input type="radio" readOnly checked={current?.id === c.id} />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{c.tin || "—"}</td>
                                    <td className="px-3 py-2">{c.name}</td>
                                    <td className="px-3 py-2 font-mono text-xs">1</td>
                                    <td className="px-3 py-2">{user?.name || "Administrator"}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{c.phone || "0175510666"}</td>
                                    <td className="px-3 py-2 text-xs">{c.email || user?.email || ""}</td>
                                    <td className="px-3 py-2 capitalize">{user?.role === "super_admin" ? "Administrator" : user?.role || "user"}</td>
                                    <td className="px-3 py-2">No</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 flex items-center justify-end gap-3 text-xs text-muted-foreground">
                    1-{companies.length} of {companies.length} items
                </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 flex justify-center gap-3 border-t border-border bg-primary py-3">
                <Button variant="secondary" size="sm" onClick={() => window.history.back()} data-testid="prof-close">
                    <X className="mr-2 h-3.5 w-3.5" /> Close
                </Button>
            </div>
        </div>
    );
}

// ---- Reusable dialog: Modify Password ----
export function ModifyPasswordDialog({ open, onOpenChange }) {
    const [pw, setPw] = useState({ old: "", next: "", confirm: "" });
    const [show, setShow] = useState({ old: false, next: false, confirm: false });
    const submit = () => {
        if (!pw.old) return toast.error("Old password is required");
        const len = pw.next.length;
        if (len < 6 || len > 20) return toast.error("Password must be 6-20 characters");
        if (!/[a-z]/.test(pw.next) || !/[A-Z]/.test(pw.next) || !/\d/.test(pw.next))
            return toast.error("Must contain uppercase, lowercase, and a number");
        if (pw.next !== pw.confirm) return toast.error("Passwords do not match");
        toast.success("Password updated (demo — wire /api/auth/change-password to persist)");
        setPw({ old: "", next: "", confirm: "" });
        onOpenChange(false);
    };
    const rowFor = (k, label) => (
        <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[180px_1fr]">
            <Label>{label} <span className="text-destructive">*</span></Label>
            <PwField k={k} show={show[k]} pw={pw[k]}
                     onChange={(v) => setPw({ ...pw, [k]: v })}
                     onToggle={() => setShow({ ...show, [k]: !show[k] })} />
        </div>
    );
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg p-0" data-testid="mp-modal">
                <div className="border-b border-border px-6 pt-5 pb-3">
                    <DialogHeader>
                        <DialogTitle>Modify Password</DialogTitle>
                        <DialogDescription>Update the password used to sign in.</DialogDescription>
                    </DialogHeader>
                </div>
                <div className="space-y-4 px-6 py-5">
                    {rowFor("old", "Old Password")}
                    {rowFor("next", "New Password")}
                    {rowFor("confirm", "Confirm Password")}
                    <div className="text-xs text-muted-foreground">
                        6-20 digits, with at least 3 types of uppercase and lowercase letters/numbers/special
                        characters. Special characters are not allowed to be entered: /\ &quot;&apos;{"{}"} [],:;
                    </div>
                </div>
                <div className="flex justify-center gap-2 border-t border-border bg-primary py-3">
                    <Button variant="secondary" size="sm" onClick={submit} data-testid="mp-submit">
                        <Save className="mr-2 h-3.5 w-3.5" /> Submit
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} data-testid="mp-cancel">
                        <X className="mr-2 h-3.5 w-3.5" /> Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ---- Reusable dialog: Account Security ----
export function AccountSecurityDialog({ open, onOpenChange }) {
    const [enabled, setEnabled] = useState("yes");
    const [code, setCode] = useState(genCode());
    const [gen, setGen] = useState(nowStr());
    const regen = () => {
        setCode(genCode()); setGen(nowStr());
        toast.success("New authorisation code generated");
    };
    const save = () => {
        toast.success("Account security saved");
        onOpenChange(false);
    };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0" data-testid="as-modal">
                <div className="border-b border-border px-6 pt-5 pb-3">
                    <DialogHeader>
                        <DialogTitle>Account Security</DialogTitle>
                        <DialogDescription>Manage authorised login and rotate your authorisation code.</DialogDescription>
                    </DialogHeader>
                </div>
                <div className="space-y-4 px-6 py-5">
                    <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[220px_1fr]">
                        <Label>Enable Authorized Login</Label>
                        <RadioGroup value={enabled} onValueChange={setEnabled} className="flex gap-6">
                            <label className="flex items-center gap-2 text-sm">
                                <RadioGroupItem value="yes" data-testid="as-yes" /> Yes
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <RadioGroupItem value="no" data-testid="as-no" /> No
                            </label>
                        </RadioGroup>
                    </div>
                    <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[220px_1fr]">
                        <Label>Generate Authorization Code <span className="text-destructive">*</span></Label>
                        <div className="flex gap-2">
                            <Input value={code} disabled className="font-mono text-xs" data-testid="as-code" />
                            <Button variant="outline" size="sm" onClick={regen} data-testid="as-generate">
                                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Generate
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[220px_1fr]">
                        <Label>Generate Time</Label>
                        <Input value={gen} disabled data-testid="as-time" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Click the &apos;Generate&apos; button to regenerate the Authorization Code, and the
                        existing Authorization Code will automatically become invalid.
                    </div>
                </div>
                <div className="flex justify-center gap-2 border-t border-border bg-primary py-3">
                    <Button variant="secondary" size="sm" onClick={save} data-testid="as-save">
                        <Save className="mr-2 h-3.5 w-3.5" /> Save
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} data-testid="as-cancel">
                        <X className="mr-2 h-3.5 w-3.5" /> Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function PwField({ k, show, pw, onChange, onToggle }) {
    return (
        <div className="relative">
            <Input type={show ? "text" : "password"}
                   value={pw}
                   onChange={(e) => onChange(e.target.value)}
                   data-testid={`mp-${k}`} />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={onToggle}>
                {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
        </div>
    );
}

function SectionBar({ title }) {
    return (
        <div className="rounded-t-md bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground">
            {title}
        </div>
    );
}
function Card({ children }) {
    return (
        <div className="mb-4 grid grid-cols-1 gap-x-8 gap-y-4 rounded-b-md border-x border-b border-border bg-card px-6 py-5 md:grid-cols-2">
            {children}
        </div>
    );
}
function TF({ l, children }) {
    return (
        <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[220px_1fr]">
            <Label className="text-sm">{l}</Label>
            <div>{children}</div>
        </div>
    );
}
function Th({ children }) {
    return <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">{children}</th>;
}
