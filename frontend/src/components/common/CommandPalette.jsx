import { useNavigate } from "react-router-dom";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    LayoutDashboard,
    FileText,
    Users,
    Package,
    Landmark,
    ShieldCheck,
    Plus,
} from "lucide-react";

export default function CommandPalette({ open, onOpenChange }) {
    const nav = useNavigate();
    const go = (to) => {
        onOpenChange(false);
        nav(to);
    };
    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput data-testid="cmd-input" placeholder="Type a command or search…" />
            <CommandList>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="Actions">
                    <CommandItem data-testid="cmd-new-invoice" onSelect={() => go("/invoices/new")}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create invoice
                    </CommandItem>
                    <CommandItem data-testid="cmd-new-customer" onSelect={() => go("/customers")}>
                        <Users className="mr-2 h-4 w-4" />
                        Add customer
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Navigate">
                    <CommandItem onSelect={() => go("/")}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                    </CommandItem>
                    <CommandItem onSelect={() => go("/ics/my-transaction")}>
                        <FileText className="mr-2 h-4 w-4" />
                        My Transactions (ICS)
                    </CommandItem>
                    <CommandItem onSelect={() => go("/products")}>
                        <Package className="mr-2 h-4 w-4" />
                        Products
                    </CommandItem>
                    <CommandItem onSelect={() => go("/mytax")}>
                        <Landmark className="mr-2 h-4 w-4" />
                        MyTax / MyInvois
                    </CommandItem>
                    <CommandItem onSelect={() => go("/roles")}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Roles & RBAC
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
