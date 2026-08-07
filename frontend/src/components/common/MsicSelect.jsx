import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MSIC_CODES } from "@/lib/msic";

/**
 * Searchable MSIC (Malaysia Standard Industrial Classification) combobox.
 *
 * Props:
 *  - value: current MSIC code string (e.g. "86201")
 *  - onChange: (code, description) => void
 *  - placeholder: string
 *  - testid: data-testid for the trigger button
 *  - className: pass-through className for trigger
 */
export default function MsicSelect({
    value,
    onChange,
    placeholder = "Select MSIC code…",
    testid = "msic-select",
    className = "",
}) {
    const [open, setOpen] = useState(false);
    const selected = useMemo(
        () => MSIC_CODES.find((m) => m.code === value),
        [value],
    );
    const label = selected
        ? `(${selected.code}) ${selected.description}`
        : placeholder;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    data-testid={testid}
                    className={`w-full justify-between font-normal ${className}`}
                    title={label}
                >
                    <span className="truncate text-left">{label}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[520px] p-0" align="start">
                <Command
                    filter={(itemValue, search) => {
                        // Normalize both sides — cmdk does NOT always lowercase itemValue
                        return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                    }}
                >
                    <CommandInput
                        placeholder="Search code or description…"
                        data-testid={`${testid}-search`}
                    />
                    <CommandList className="max-h-[320px]">
                        <CommandEmpty>No MSIC code found.</CommandEmpty>
                        <CommandGroup>
                            {MSIC_CODES.map((m) => {
                                const key = `(${m.code}) ${m.description}`;
                                return (
                                    <CommandItem
                                        key={m.code}
                                        value={key}
                                        onSelect={() => {
                                            onChange?.(m.code, m.description);
                                            setOpen(false);
                                        }}
                                        data-testid={`msic-option-${m.code}`}
                                    >
                                        <Check
                                            className={`mr-2 h-4 w-4 ${
                                                value === m.code ? "opacity-100" : "opacity-0"
                                            }`}
                                        />
                                        <span className="font-mono text-xs text-muted-foreground mr-2">
                                            {m.code}
                                        </span>
                                        <span className="truncate">{m.description}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
