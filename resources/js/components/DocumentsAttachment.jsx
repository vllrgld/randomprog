import { useState } from 'react';
import { Loader2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DOC_TYPES } from '@/lib/doc-types';
import { uploadDocument } from '@/lib/documents';

export default function DocumentsAttachment({ onAttach }) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState(null);
    const [docType, setDocType] = useState('unknown');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function handleAttach() {
        if (!file || busy) {
            return;
        }

        const selected = file;

        setBusy(true);
        setError(null);

        try {
            const document = await uploadDocument(selected, docType);
            onAttach?.(document);
            setFile(null);
            setDocType('unknown');
            setOpen(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not process the document.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (busy) {
                    return;
                }

                setOpen(nextOpen);
                if (!nextOpen) {
                    setFile(null);
                    setDocType('unknown');
                    setError(null);
                }
            }}
        >
            <DialogTrigger render={<Button />}>
                <Paperclip />
                Attach
            </DialogTrigger>
            <DialogContent showCloseButton={!busy} className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{busy ? 'Processing document' : 'Attach document'}</DialogTitle>
                    {busy ? (
                        <DialogDescription>Compressing, then reading text with OCR…</DialogDescription>
                    ) : null}
                </DialogHeader>
                {busy ? (
                    <div className="flex items-center gap-3" role="status" aria-live="polite" aria-busy>
                        <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" aria-hidden />
                        <p className="text-muted-foreground truncate text-xs">{file?.name ?? 'Working…'}</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        <div className="grid gap-2">
                            <Label htmlFor="attachment">File</Label>
                            <Input
                                id="attachment"
                                type="file"
                                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                            />
                            {file ? <p className="text-muted-foreground text-xs">{file.name}</p> : null}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="doc-type">Document type</Label>
                            <select
                                id="doc-type"
                                value={docType}
                                onChange={(event) => setDocType(event.target.value)}
                                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                            >
                                {DOC_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {error ? <p className="text-destructive text-xs">{error}</p> : null}
                    </div>
                )}
                {busy ? null : (
                    <DialogFooter>
                        <DialogClose render={<Button variant="outline" />}>{error ? 'Close' : 'Cancel'}</DialogClose>
                        <Button disabled={!file} onClick={handleAttach}>
                            Attach
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
