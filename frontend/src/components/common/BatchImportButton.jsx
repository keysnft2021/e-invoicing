import { useRef, useState } from "react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileDown } from "lucide-react";

/**
 * Batch Import dialog + trigger button.
 *
 * Props:
 *  - entity: "products" | "customers" | "suppliers"
 *  - onDone: () => void
 */
export default function BatchImportButton({ entity, onDone }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const fileRef = useRef(null);

    const downloadTemplate = async () => {
        try {
            const res = await api.get(`/batch-import/${entity}/template`,
                                          { responseType: "blob" });
            const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `${entity}_import_template.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Template downloaded");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const upload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBusy(true); setResult(null);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const { data } = await api.post(`/batch-import/${entity}`, fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setResult(data);
            const s = data.summary;
            toast.success(`Imported ${s.created} new, ${s.updated} updated, ${s.errors} errors`);
            onDone?.();
        } catch (err) { toast.error(formatApiError(err)); }
        finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    return (
        <>
            <Button variant="outline" size="sm"
                    onClick={() => { setOpen(true); setResult(null); }}
                    data-testid="op-import">
                <Upload className="mr-2 h-3.5 w-3.5" /> Batch Import
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent data-testid="batch-import-dialog">
                    <DialogHeader>
                        <DialogTitle>Batch Import {entity}</DialogTitle>
                        <DialogDescription>
                            Download the CSV template, fill it in, and upload. Existing rows are matched by
                            {entity === "products" ? " SKU" : " TIN"} and updated in place; new rows are inserted.
                            Required columns are marked with a <code>*</code> in the header.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <Button variant="outline" size="sm" onClick={downloadTemplate}
                                data-testid="import-template-btn">
                            <FileDown className="mr-2 h-3.5 w-3.5" /> Download CSV template
                        </Button>
                        <div className="rounded-md border-2 border-dashed border-border p-6 text-center">
                            <input ref={fileRef} type="file" accept=".csv" onChange={upload}
                                   className="hidden" data-testid="import-file-input" />
                            <Button size="sm" onClick={() => fileRef.current?.click()}
                                    disabled={busy} data-testid="import-select-btn">
                                <Upload className="mr-2 h-3.5 w-3.5" />
                                {busy ? "Uploading…" : "Select CSV to upload"}
                            </Button>
                        </div>

                        {result && (
                            <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
                                <div className="mb-2 font-medium">
                                    Import complete —
                                    <span className="ml-2 text-emerald-600">
                                        {result.summary.created} created
                                    </span>,
                                    <span className="ml-2 text-blue-600">
                                        {result.summary.updated} updated
                                    </span>,
                                    <span className="ml-2 text-destructive">
                                        {result.summary.errors} errors
                                    </span>
                                </div>
                                {result.errors?.length > 0 && (
                                    <div className="max-h-40 overflow-y-auto rounded bg-background p-2 text-xs">
                                        {result.errors.map((e, i) => (
                                            <div key={i} className="text-destructive">
                                                Row {e.row}: {e.error}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
