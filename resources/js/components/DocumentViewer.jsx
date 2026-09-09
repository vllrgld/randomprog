import { useEffect, useState } from 'react';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import PdfPreview from './PdfPreview';

function previewKind(mimeType, name) {
    const mime = (mimeType ?? '').toLowerCase();
    const filename = (name ?? '').toLowerCase();

    if (mime.includes('pdf') || filename.endsWith('.pdf')) {
        return 'pdf';
    }

    if (mime.startsWith('image/') || /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/.test(filename)) {
        return 'image';
    }

    if (mime.startsWith('text/') || mime.includes('json') || /\.(csv|json|log|md|txt|xml)$/.test(filename)) {
        return 'text';
    }

    return 'other';
}

export default function DocumentViewer({ document: file, onClose }) {
    const open = file != null;
    const [viewed, setViewed] = useState(file);
    const current = file ?? viewed;
    const kind = current ? previewKind(current.mime_type, current.name) : 'other';
    const [text, setText] = useState('');
    const [textError, setTextError] = useState(null);

    useEffect(() => {
        if (file) {
            setViewed(file);
        }
    }, [file]);

    useEffect(() => {
        if (!current || kind !== 'text') {
            setText('');
            setTextError(null);

            return;
        }

        let cancelled = false;

        fetch(current.url, {
            credentials: 'same-origin',
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Could not load the document.');
                }

                return response.text();
            })
            .then((body) => {
                if (!cancelled) {
                    setText(body);
                    setTextError(null);
                }
            })
            .catch((caught) => {
                if (!cancelled) {
                    setTextError(caught instanceof Error ? caught.message : 'Could not load the document.');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [current, kind]);

    function closeViewer() {
        onClose?.();
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    closeViewer();
                }
            }}
            onOpenChangeComplete={(isOpen) => {
                if (!isOpen) {
                    setViewed(null);
                }
            }}
        >
            <DialogContent showCloseButton={false} className="flex max-h-[90vh] sm:max-w-4xl flex-col">
                <DialogHeader>
                    <DialogTitle className="pr-8 truncate">{current?.name ?? 'Document'}</DialogTitle>
                    <DialogDescription className="sr-only">Preview of the selected document.</DialogDescription>
                </DialogHeader>
                {current ? (
                    <div className="min-h-0 overflow-hidden rounded-lg border bg-muted/30">
                        {kind === 'pdf' ? <PdfPreview url={current.url} /> : null}
                        {kind === 'image' ? (
                            <img
                                src={current.url}
                                alt={current.name}
                                className="mx-auto max-h-[min(70vh,40rem)] w-full object-contain"
                            />
                        ) : null}
                        {kind === 'text' ? (
                            <pre className="max-h-[min(70vh,40rem)] overflow-auto p-3 text-xs whitespace-pre-wrap">
                                {textError ?? (text === '' ? 'Loading…' : text)}
                            </pre>
                        ) : null}
                        {kind === 'other' ? (
                            <p className="text-muted-foreground p-4 text-sm">
                                This file type can’t be previewed. Download it to open it.
                            </p>
                        ) : null}
                    </div>
                ) : null}
                <DialogFooter>
                    {current ? (
                        <Button variant="outline" nativeButton={false} render={<a href={current.download_url} />}>
                            Download
                        </Button>
                    ) : null}
                </DialogFooter>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-2 right-2 z-50"
                    onClick={closeViewer}
                >
                    <XIcon />
                    <span className="sr-only">Close</span>
                </Button>
            </DialogContent>
        </Dialog>
    );
}
