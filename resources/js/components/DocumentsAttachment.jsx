import { useState } from 'react';
import { Paperclip } from 'lucide-react';
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
import { uploadDocument } from '@/lib/documents';

export default function DocumentsAttachment({ onAttach }) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function handleAttach() {
        if (!file || busy) {
            return;
        }

        setBusy(true);
        setError(null);

        try {
            const document = await uploadDocument(file);
            onAttach?.(document);
            setFile(null);
            setOpen(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not upload the document.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    setFile(null);
                    setError(null);
                }
            }}
        >
            <DialogTrigger render={<Button />}>
                <Paperclip />
                Attach
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Attach document</DialogTitle>
                    <DialogDescription>
                        Files are stored in this project at storage/app/documents.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                    <Label htmlFor="attachment">File</Label>
                    <Input
                        id="attachment"
                        type="file"
                        disabled={busy}
                        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                    {file ? <p className="text-muted-foreground text-xs">{file.name}</p> : null}
                    {error ? <p className="text-destructive text-xs">{error}</p> : null}
                </div>
                <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                    <Button disabled={!file || busy} onClick={handleAttach}>
                        {busy ? 'Uploading…' : 'Attach'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
