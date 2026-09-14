import { useEffect, useRef, useState } from 'react';
import { HistoryIcon, InfoIcon, PenLineIcon, SparklesIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import DocumentHistoryDialog from './DocumentHistoryDialog';
import DocumentInfoDialog from './DocumentInfoDialog';
import PdfPreview, { FORM_FONT_MAX, FORM_FONT_MIN, FORM_FONT_STEP } from './PdfPreview';
import PdfSignatureDialog from './PdfSignatureDialog';
import { compressDocumentDownload, loadDocumentContext, saveDocumentFile } from '@/lib/documents';
import { getSettings } from '@/lib/settings';

const AI_MODEL_STORAGE_KEY = 'ai.model';
const COMPRESS_DOWNLOAD_STORAGE_KEY = 'pdf.fillableDownloadQuality';
const VIEW_SCALE_STORAGE_KEY = 'pdf.viewScale';
const DOWNLOAD_QUALITIES = [
    { value: '', label: 'Original' },
    { value: 'ebook', label: 'Ebook' },
    { value: 'screen', label: 'Screen' },
];
const VIEW_SCALES = [
    { value: 'fit', label: 'Fit width' },
    { value: '50', label: '50%' },
    { value: '75', label: '75%' },
    { value: '100', label: '100%' },
    { value: '125', label: '125%' },
    { value: '150', label: '150%' },
    { value: '200', label: '200%' },
];

function readDownloadQuality() {
    const stored = localStorage.getItem(COMPRESS_DOWNLOAD_STORAGE_KEY) ?? '';

    return DOWNLOAD_QUALITIES.some((option) => option.value === stored) ? stored : '';
}

function readViewScale() {
    const stored = localStorage.getItem(VIEW_SCALE_STORAGE_KEY) ?? 'fit';

    return VIEW_SCALES.some((option) => option.value === stored) ? stored : 'fit';
}

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
    const [historyOpen, setHistoryOpen] = useState(false);
    const [text, setText] = useState('');
    const [textError, setTextError] = useState(null);
    const [contextOpen, setContextOpen] = useState(false);
    const [context, setContext] = useState('');
    const [loadingContext, setLoadingContext] = useState(false);
    const [contextError, setContextError] = useState(null);
    const [models, setModels] = useState([]);
    const [model, setModel] = useState('');
    const [pdfForm, setPdfForm] = useState({ fillable: false, dirty: false });
    const [selectedFormFont, setSelectedFormFont] = useState({ id: null, scale: 1 });
    const [savingPdf, setSavingPdf] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [pdfSaveError, setPdfSaveError] = useState(null);
    const [downloadQuality, setDownloadQuality] = useState(readDownloadQuality);
    const [viewScale, setViewScale] = useState(readViewScale);
    const [signOpen, setSignOpen] = useState(false);
    const pdfPreviewRef = useRef(null);

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
        setHistoryOpen(false);
        setPdfForm({ fillable: false, dirty: false });
        setSavingPdf(false);
        setDownloadingPdf(false);
        setPdfSaveError(null);
        setSignOpen(false);
        setSelectedFormFont({ id: null, scale: 1 });
    }, [current?.id, current?.file_size]);

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
        setHistoryOpen(false);
        setContextOpen(false);
        setSignOpen(false);
        pdfPreviewRef.current?.cancelSignature?.();
        onClose?.();
    }

    function handleModelChange(nextModel) {
        setModel(nextModel);
        localStorage.setItem(AI_MODEL_STORAGE_KEY, nextModel);
        setContext('');
        setContextError(null);
    }

    async function handleAiContext() {
        const canAskAi = Boolean(current?.ai_url) && (current.ocr_url != null || pdfForm.fillable);

        if (!current || !canAskAi || loadingContext || model === '') {
            return;
        }

        setContextOpen(true);

        if (context !== '' && !pdfForm.fillable) {
            return;
        }

        setContextError(null);
        setLoadingContext(true);

        try {
            let formText = '';
            let pageText = '';

            if (kind === 'pdf' && pdfPreviewRef.current) {
                formText = pdfPreviewRef.current.formText?.() ?? '';
                pageText = (await pdfPreviewRef.current.pageText?.()) ?? '';
            }

            const payload = await loadDocumentContext(current.ai_url, model, formText, pageText);
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

    async function downloadFilledPdf() {
        const shouldPersist = pdfForm.dirty;
        const shouldCompress = downloadQuality === 'ebook' || downloadQuality === 'screen';
        const data = await pdfPreviewRef.current.saveFilled();
        let blob = new Blob([data], { type: 'application/pdf' });
        const filename = current.name ?? 'document.pdf';

        if (shouldPersist) {
            const updated = await saveDocumentFile(current.id, blob, filename);

            onDocumentChange?.(updated);
        }

        pdfPreviewRef.current.resetFormModified?.();
        setPdfForm((current) => ({ fillable: current.fillable, dirty: false }));

        if (shouldCompress) {
            blob = await compressDocumentDownload(current.id, blob, filename, downloadQuality);
        }

        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = objectUrl;
        link.download = filename;
        link.rel = 'noopener';
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
    }

    async function handleDownload(event) {
        if (kind !== 'pdf' || !pdfForm.fillable || !pdfPreviewRef.current) {
            return;
        }

        event.preventDefault();

        if (savingPdf || downloadingPdf) {
            return;
        }

        setDownloadingPdf(true);
        setPdfSaveError(null);

        try {
            await downloadFilledPdf();
        } catch (caught) {
            setPdfSaveError(caught instanceof Error ? caught.message : 'Could not download the filled PDF.');
        } finally {
            setDownloadingPdf(false);
        }
    }

    async function handleSaveFilledPdf() {
        if (!current || savingPdf || !pdfForm.dirty) {
            return;
        }

        setSavingPdf(true);
        setPdfSaveError(null);

        try {
            const data = await pdfPreviewRef.current.saveFilled();
            const blob = new Blob([data], { type: 'application/pdf' });
            const updated = await saveDocumentFile(current.id, blob, current.name ?? 'document.pdf');

            pdfPreviewRef.current.resetFormModified?.();
            onDocumentChange?.(updated);
            setPdfForm((current) => ({ fillable: current.fillable, dirty: false }));
        } catch (caught) {
            setPdfSaveError(caught instanceof Error ? caught.message : 'Could not save the filled PDF.');
        } finally {
            setSavingPdf(false);
        }
    }

    return (
        <>
        <Dialog
            open={open}
            onOpenChange={(nextOpen, eventDetails) => {
                if (!nextOpen) {
                    const target = eventDetails?.event?.target;

                    if (target instanceof Element && target.closest('[data-pdf-thumbs]')) {
                        eventDetails.cancel();

                        return;
                    }

                    if (signOpen) {
                        setSignOpen(false);

                        return;
                    }

                    if (historyOpen) {
                        setHistoryOpen(false);

                        return;
                    }

                    closeViewer();
                }
            }}
            onOpenChangeComplete={(isOpen) => {
                if (!isOpen) {
                    setViewed(null);
                }
            }}
        >
            <DialogContent showCloseButton={false} className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col overflow-visible sm:max-w-4xl xl:h-[90vh] xl:max-w-6xl 2xl:max-w-7xl">
                <DialogHeader className="shrink-0 pr-8">
                    <div className="flex min-w-0 items-center gap-2">
                        <DialogTitle className="min-w-0 flex-1 truncate">{current?.name ?? 'Document'}</DialogTitle>
                        {kind === 'pdf' ? (
                            <div className="flex shrink-0 items-center gap-2">
                                <label className="sr-only" htmlFor="view-scale">
                                    View scale
                                </label>
                                <select
                                    id="view-scale"
                                    value={viewScale}
                                    title="PDF view scale"
                                    className="border-input h-6 max-w-24 rounded-lg border bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                    onChange={(event) => {
                                        const next = event.target.value;

                                        setViewScale(next);
                                        localStorage.setItem(VIEW_SCALE_STORAGE_KEY, next);
                                    }}
                                >
                                    {VIEW_SCALES.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                {pdfForm.fillable ? (
                                    <>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="xs"
                                                disabled={selectedFormFont.id == null || selectedFormFont.scale <= FORM_FONT_MIN}
                                                title={selectedFormFont.id == null ? 'Click a form field first' : 'Smaller text in the selected field'}
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => pdfPreviewRef.current?.nudgeSelectedFormFont?.(-FORM_FONT_STEP)}
                                            >
                                                A−
                                            </Button>
                                            <span className="text-muted-foreground w-9 text-center text-xs tabular-nums">
                                                {selectedFormFont.id == null ? '—' : `${Math.round(selectedFormFont.scale * 100)}%`}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="xs"
                                                disabled={selectedFormFont.id == null || selectedFormFont.scale >= FORM_FONT_MAX}
                                                title={selectedFormFont.id == null ? 'Click a form field first' : 'Larger text in the selected field'}
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => pdfPreviewRef.current?.nudgeSelectedFormFont?.(FORM_FONT_STEP)}
                                            >
                                                A+
                                            </Button>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon-xs"
                                            title="Sign PDF"
                                            onClick={() => setSignOpen(true)}
                                        >
                                            <PenLineIcon />
                                            <span className="sr-only">Sign</span>
                                        </Button>
                                        {pdfSaveError ? <p className="text-destructive max-w-28 truncate text-xs">{pdfSaveError}</p> : null}
                                        <Button
                                            size="xs"
                                            disabled={!pdfForm.dirty || savingPdf || downloadingPdf}
                                            title={pdfForm.dirty ? 'Save form fields and signatures' : 'Fill a field or add a signature to save'}
                                            onClick={handleSaveFilledPdf}
                                        >
                                            {savingPdf ? 'Saving…' : 'Save fields'}
                                        </Button>
                                    </>
                                ) : null}
                            </div>
                        ) : null}
                        {kind === 'pdf' ? (
                            <Button
                                type="button"
                                variant={historyOpen ? 'secondary' : 'ghost'}
                                size="icon-sm"
                                title="Document history"
                                onClick={() => setHistoryOpen((current) => !current)}
                            >
                                <HistoryIcon />
                                <span className="sr-only">Document history</span>
                            </Button>
                        ) : null}
                        {current?.uses_id_metadata ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                title="ID info"
                                onClick={() => setInfoOpen(true)}
                            >
                                <InfoIcon />
                                <span className="sr-only">ID info</span>
                            </Button>
                        ) : null}
                    </div>
                    <DialogDescription className="sr-only">Preview of the selected document.</DialogDescription>
                </DialogHeader>
                {current ? (
                    <div className="flex min-h-0 flex-1 justify-center overflow-hidden rounded-lg border bg-muted/30">
                        {kind === 'pdf' ? (
                            <PdfPreview
                                ref={pdfPreviewRef}
                                url={`${current.url}?t=${current.file_size}`}
                                viewScale={viewScale}
                                onFormStateChange={setPdfForm}
                                onSelectedFormFontChange={setSelectedFormFont}
                            />
                        ) : null}
                        {kind === 'image' ? (
                            <img
                                src={current.url}
                                alt={current.name}
                                className="mx-auto max-h-[min(70vh,40rem)] max-w-full object-contain xl:max-h-full"
                            />
                        ) : null}
                        {kind === 'text' ? (
                            <pre className="max-h-[min(70vh,40rem)] overflow-auto p-3 text-xs whitespace-pre-wrap xl:max-h-full">
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
                <DialogFooter className="shrink-0 flex-row justify-between">
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
                                    disabled={loadingContext || model === '' || (current.ocr_url == null && !pdfForm.fillable)}
                                    title={
                                        current.ocr_url != null || pdfForm.fillable
                                            ? 'Show this document’s context'
                                            : 'OCR text or form fields are not available yet'
                                    }
                                    onClick={handleAiContext}
                                >
                                    <SparklesIcon />
                                    AI Context
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                {kind === 'pdf' && pdfForm.fillable ? (
                                    <>
                                        <label className="sr-only" htmlFor="download-quality">
                                            Download compression
                                        </label>
                                        <select
                                            id="download-quality"
                                            value={downloadQuality}
                                            disabled={downloadingPdf || savingPdf}
                                            title="Shrink this download. Form fields may be flattened."
                                            className="border-input h-8 max-w-32 rounded-lg border bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                            onChange={(event) => {
                                                const next = event.target.value;

                                                setDownloadQuality(next);
                                                localStorage.setItem(COMPRESS_DOWNLOAD_STORAGE_KEY, next);
                                            }}
                                        >
                                            {DOWNLOAD_QUALITIES.map((option) => (
                                                <option key={option.value || 'none'} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        <Button
                                            variant="outline"
                                            disabled={downloadingPdf || savingPdf}
                                            title="Download the filled PDF"
                                            onClick={handleDownload}
                                        >
                                            {downloadingPdf
                                                ? downloadQuality === 'ebook' || downloadQuality === 'screen'
                                                    ? 'Compressing…'
                                                    : 'Downloading…'
                                                : 'Download'}
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="outline" nativeButton={false} render={<a href={`${current.download_url}?t=${current.file_size}`} />}>
                                        Download
                                    </Button>
                                )}
                            </div>
                        </>
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
        <DocumentHistoryDialog
            document={current}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
        />
        <DocumentInfoDialog
            document={current}
            open={infoOpen}
            onOpenChange={setInfoOpen}
            onDocumentChange={onDocumentChange}
        />
        <PdfSignatureDialog
            open={signOpen}
            onOpenChange={setSignOpen}
            onApply={(signature) => pdfPreviewRef.current?.placeSignature?.(signature)}
        />
        <Dialog open={contextOpen} onOpenChange={setContextOpen}>
            <DialogContent className="flex max-h-[80vh] sm:max-w-lg flex-col">
                <DialogHeader>
                    <DialogTitle>AI context</DialogTitle>
                    <DialogDescription>
                        {model !== '' ? `Summary from ${model}.` : 'Summary of this document.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-auto text-sm">
                    {loadingContext ? (
                        <p className="text-muted-foreground">Reading document context…</p>
                    ) : (
                        <p className={contextError ? 'text-destructive' : 'whitespace-pre-wrap'}>
                            {contextError ?? context}
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
