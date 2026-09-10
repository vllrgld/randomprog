import { useEffect, useState } from 'react';
import { InfoIcon, SparklesIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import DocumentInfoDialog from './DocumentInfoDialog';
import PdfPreview from './PdfPreview';
import { loadDocumentContext } from '@/lib/documents';
import { getSettings } from '@/lib/settings';

const AI_MODEL_STORAGE_KEY = 'ai.model';

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

export default function DocumentViewer({ document: file, onClose, onDocumentChange }) {
    const open = file != null;
    const [viewed, setViewed] = useState(file);
    const current = file ?? viewed;
    const kind = current ? previewKind(current.mime_type, current.name) : 'other';
    const [infoOpen, setInfoOpen] = useState(false);
    const [text, setText] = useState('');
    const [textError, setTextError] = useState(null);
    const [contextOpen, setContextOpen] = useState(false);
    const [context, setContext] = useState('');
    const [loadingContext, setLoadingContext] = useState(false);
    const [contextError, setContextError] = useState(null);
    const [models, setModels] = useState([]);
    const [model, setModel] = useState('');

    useEffect(() => {
        if (file) {
            setViewed(file);
        }
    }, [file]);

    useEffect(() => {
        let cancelled = false;

        getSettings()
            .then((settings) => {
                if (cancelled) {
                    return;
                }

                const available = Array.isArray(settings.ai_models) ? settings.ai_models : [];
                const stored = localStorage.getItem(AI_MODEL_STORAGE_KEY);
                const nextModel = available.includes(stored)
                    ? stored
                    : available.includes(settings.ai_model)
                      ? settings.ai_model
                      : (available[0] ?? '');

                setModels(available);
                setModel(nextModel);
            })
            .catch(() => {
                if (!cancelled) {
                    setModels([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        setContextOpen(false);
        setContext('');
        setContextError(null);
        setLoadingContext(false);
        setInfoOpen(false);
    }, [current?.id]);

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
        setInfoOpen(false);
        onClose?.();
    }

    function handleModelChange(nextModel) {
        setModel(nextModel);
        localStorage.setItem(AI_MODEL_STORAGE_KEY, nextModel);
        setContext('');
        setContextError(null);

        if (contextOpen) {
            setContextOpen(false);
        }
    }

    async function handleAiContext() {
        if (!current?.ai_url || loadingContext || model === '') {
            return;
        }

        if (contextOpen) {
            setContextOpen(false);

            return;
        }

        setContextOpen(true);

        if (context !== '') {
            return;
        }

        setContextError(null);
        setLoadingContext(true);

        try {
            const payload = await loadDocumentContext(current.ai_url, model);
            setContext(payload.context);

            if (payload.id_metadata) {
                onDocumentChange?.({
                    ...current,
                    id_metadata: payload.id_metadata,
                });
            }
        } catch (caught) {
            setContextError(caught instanceof Error ? caught.message : 'Could not load document context.');
        } finally {
            setLoadingContext(false);
        }
    }

    return (
        <>
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
                    <DialogTitle className={`truncate ${current?.uses_id_metadata ? 'pr-16' : 'pr-8'}`}>{current?.name ?? 'Document'}</DialogTitle>
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
                {contextOpen ? (
                    <div className="max-h-24 overflow-auto rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                        {loadingContext ? (
                            <p className="text-muted-foreground">Reading document context…</p>
                        ) : (
                            <p className={contextError ? 'text-destructive' : 'whitespace-pre-wrap'}>
                                {contextError ?? context}
                            </p>
                        )}
                    </div>
                ) : null}
                <DialogFooter className="flex-row justify-between">
                    {current ? (
                        <>
                            <div className="flex min-w-0 items-center gap-2">
                                <label className="sr-only" htmlFor="ai-model">
                                    AI model
                                </label>
                                <select
                                    id="ai-model"
                                    value={model}
                                    disabled={loadingContext || models.length === 0}
                                    className="border-input h-8 max-w-44 rounded-lg border bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                    onChange={(event) => handleModelChange(event.target.value)}
                                >
                                    {models.map((value) => (
                                        <option key={value} value={value}>
                                            {value}
                                        </option>
                                    ))}
                                </select>
                                <Button
                                    variant={contextOpen ? 'default' : 'outline'}
                                    disabled={!current.ai_url || loadingContext || model === ''}
                                    title={current.ai_url ? 'Show this document’s context' : 'OCR text is not available yet'}
                                    onClick={handleAiContext}
                                >
                                    <SparklesIcon />
                                    AI context
                                </Button>
                            </div>
                            <Button variant="outline" nativeButton={false} render={<a href={current.download_url} />}>
                                Download
                            </Button>
                        </>
                    ) : null}
                </DialogFooter>
                {current?.uses_id_metadata ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-2 right-10 z-50"
                        title="ID info"
                        onClick={() => setInfoOpen(true)}
                    >
                        <InfoIcon />
                        <span className="sr-only">ID info</span>
                    </Button>
                ) : null}
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
        <DocumentInfoDialog
            document={current}
            open={infoOpen}
            onOpenChange={setInfoOpen}
            onDocumentChange={onDocumentChange}
        />
        </>
    );
}
