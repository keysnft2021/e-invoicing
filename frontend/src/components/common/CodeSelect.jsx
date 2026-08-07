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

/**
 * Generic searchable code + description combobox.
 *
 * Props:
 *  - options: [{ code, description }] — required
 *  - value: currently selected code (string) | null
 *  - onChange: (code, description) => void
 *  - placeholder: string
 *  - testid: data-testid for the trigger button
 *  - className: pass-through className
 *  - popoverWidth: string width for the popover (default 520px)
 */
export default function CodeSelect({
    options = [],
    value,
    onChange,
    placeholder = "Please Select",
    testid = "code-select",
    className = "",
    popoverWidth = "520px",
}) {
    const [open, setOpen] = useState(false);
    const selected = useMemo(
        () => options.find((m) => m.code === value),
        [options, value],
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
                    <span className={`truncate text-left ${!selected ? "text-muted-foreground" : ""}`}>
                        {label}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="p-0"
                style={{ width: popoverWidth }}
                align="start"
            >
                <Command
                    filter={(itemValue, search) => {
                        return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                    }}
                >
                    <CommandInput
                        placeholder="Please Select"
                        data-testid={`${testid}-search`}
                    />
                    <CommandList className="max-h-[320px]">
                        <CommandEmpty>No option found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((m) => {
                                const key = `(${m.code}) ${m.description}`;
                                return (
                                    <CommandItem
                                        key={m.code}
                                        value={key}
                                        onSelect={() => {
                                            onChange?.(m.code, m.description);
                                            setOpen(false);
                                        }}
                                        data-testid={`${testid}-option-${m.code}`}
                                    >
                                        <Check
                                            className={`mr-2 h-4 w-4 ${
                                                value === m.code ? "opacity-100" : "opacity-0"
                                            }`}
                                        />
                                        <span className="font-mono text-xs text-muted-foreground mr-2">
                                            ({m.code})
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
