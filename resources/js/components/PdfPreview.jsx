import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AnnotationMode, getDocument, GlobalWorkerOptions, PixelsPerInch } from 'pdfjs-dist';
import { EventBus, PDFLinkService, PDFPageView } from 'pdfjs-dist/web/pdf_viewer.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import '../../css/pdf-preview.css';

GlobalWorkerOptions.workerSrc = workerUrl;

function formatFormFieldValue(value) {
    if (value == null) {
        return '';
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    if (typeof value === 'number') {
        return String(value);
    }

    if (Array.isArray(value)) {
        return value.map((item) => formatFormFieldValue(item)).filter((item) => item !== '').join(', ');
    }

    if (typeof value !== 'string') {
        return '';
    }

    const text = value.trim();

    return text === 'Off' ? '' : text;
}

function isTableOrChecklistField(name, widget) {
    const type = String(widget?.type ?? '').toLowerCase();

    if (['button', 'btn', 'checkbox', 'radiobutton', 'radio', 'signature', 'sig', 'listbox'].includes(type)) {
        return true;
    }

    const label = String(name ?? widget?.name ?? '');

    return /check\s*box|checkbox|chkbox|\bchk[\s._-]?\d|\bradiobutton|\bradiobtn|checklist|table\[\d+|row\[\d+|col\[\d+|cell\[\d+|row\s*\d+|col(?:umn)?\s*\d+|cell\s*\d+/i.test(label);
}

function formatPdfFormText(pdf, fieldObjects) {
    if (pdf == null) {
        return '';
    }

    const lines = [];

    if (fieldObjects instanceof Map) {
        for (const [name, widgets] of fieldObjects) {
            if (!Array.isArray(widgets) || widgets.length === 0) {
                continue;
            }

            const widget = widgets[0];

            if (isTableOrChecklistField(name, widget)) {
                continue;
            }

            const label = String(name ?? widget?.name ?? '').trim();

            if (label === '') {
                continue;
            }

            if (widget?.password) {
                lines.push(`${label}:`);

                continue;
            }

            const stored = pdf.annotationStorage.getValue(widget.id, {
                value: widget.value,
            });
            const formatted = formatFormFieldValue(stored?.value ?? widget.value);

            lines.push(`${label}: ${formatted}`.trimEnd());
        }
    }

    return lines.join('\n');
}

function textFromPdfContent(content) {
    const lines = [];
    let line = '';
    let lastY;

    for (const item of content.items) {
        if (typeof item?.str !== 'string' || item.str === '') {
            continue;
        }

        const y = item.transform?.[5];
        const sameLine = lastY === undefined || (typeof y === 'number' && Math.abs(lastY - y) <= 4);

        if (!sameLine && line !== '') {
            lines.push(line);
            line = item.str;
        } else {
            line = line === '' || item.str.startsWith(' ') || line.endsWith(' ')
                ? `${line}${item.str}`
                : `${line} ${item.str}`;
        }

        lastY = y;

        if (item.hasEOL) {
            lines.push(line);
            line = '';
            lastY = undefined;
        }
    }

    if (line !== '') {
        lines.push(line);
    }

    return lines.join('\n').trim();
}

function scaleForWidth(page, availableWidth) {
    return availableWidth / (page.getViewport({ scale: 1 }).width * PixelsPerInch.PDF_TO_CSS_UNITS);
}

function applyPageScale(pageViews, pagesNode, scale) {
    if (pageViews.length === 0 || pagesNode == null) {
        return;
    }

    pagesNode.style.setProperty('--scale-factor', String(scale * PixelsPerInch.PDF_TO_CSS_UNITS));

    for (const view of pageViews) {
        view.update({ scale });
    }
}

export default forwardRef(function PdfPreview({ url, onFormStateChange }, ref) {
    const frameRef = useRef(null);
    const pagesRef = useRef(null);
    const pdfRef = useRef(null);
    const onFormStateChangeRef = useRef(onFormStateChange);
    const fieldObjectsRef = useRef(null);
    const pageViewsRef = useRef([]);
    const widthRef = useRef(0);
    const [width, setWidth] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const readyUrl = url && width >= 80 ? url : '';

    onFormStateChangeRef.current = onFormStateChange;
    widthRef.current = width;

    useImperativeHandle(ref, () => ({
        async saveFilled() {
            const pdf = pdfRef.current;

            if (!pdf) {
                throw new Error('The PDF is not loaded yet.');
            }

            const data = await pdf.saveDocument();

            pdf.annotationStorage.resetModified();

            return data;
        },
        formText() {
            return formatPdfFormText(pdfRef.current, fieldObjectsRef.current);
        },
        async pageText() {
            const pdf = pdfRef.current;

            if (!pdf) {
                return '';
            }

            try {
                const pages = [];

                for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                    const page = await pdf.getPage(pageNumber);
                    const content = await page.getTextContent();

                    pages.push(textFromPdfContent(content));
                }

                return pages.filter((text) => text !== '').join('\n\n');
            } catch {
                return '';
            }
        },
    }), []);

    useEffect(() => {
        const frame = frameRef.current;

        if (!frame) {
            return;
        }

        const updateWidth = () => {
            setWidth((current) => {
                const next = frame.clientWidth;

                return Math.abs(current - next) < 16 ? current : next;
            });
        };

        updateWidth();

        const observer = new ResizeObserver(updateWidth);
        observer.observe(frame);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!readyUrl) {
            return;
        }

        const pagesNode = pagesRef.current;
        let cancelled = false;
        let pdfDocument = null;
        const pageViews = [];

        pageViewsRef.current = [];
        setLoading(true);
        setError(null);
        pagesNode?.replaceChildren();
        pdfRef.current = null;
        fieldObjectsRef.current = null;
        onFormStateChangeRef.current?.({ fillable: false, dirty: false });

        const loadingTask = getDocument({
            url: readyUrl,
            withCredentials: true,
        });

        loadingTask.promise
            .then(async (pdf) => {
                pdfDocument = pdf;
                pdfRef.current = pdf;

                if (cancelled || !pagesNode) {
                    return;
                }

                const eventBus = new EventBus();
                const linkService = new PDFLinkService({ eventBus });
                linkService.setDocument(pdf);

                const fieldObjects = await pdf.getFieldObjects();
                const fillable = pdf.isPureXfa || (fieldObjects != null && fieldObjects.size > 0);

                fieldObjectsRef.current = fieldObjects;

                pdf.annotationStorage.onSetModified = () => {
                    if (!cancelled) {
                        onFormStateChangeRef.current?.({ fillable: true, dirty: true });
                    }
                };
                pdf.annotationStorage.onResetModified = () => {
                    if (!cancelled) {
                        onFormStateChangeRef.current?.({ fillable, dirty: false });
                    }
                };

                if (!cancelled) {
                    onFormStateChangeRef.current?.({ fillable, dirty: false });
                }

                const firstPage = await pdf.getPage(1);

                if (cancelled) {
                    return;
                }

                const scale = scaleForWidth(firstPage, Math.max(240, widthRef.current - 32));

                pagesNode.style.setProperty('--scale-factor', String(scale * PixelsPerInch.PDF_TO_CSS_UNITS));

                for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                    const page = pageNumber === 1 ? firstPage : await pdf.getPage(pageNumber);

                    if (cancelled) {
                        return;
                    }

                    const pdfPageView = new PDFPageView({
                        container: pagesNode,
                        eventBus,
                        id: pageNumber,
                        scale,
                        defaultViewport: page.getViewport({
                            scale: scale * PixelsPerInch.PDF_TO_CSS_UNITS,
                        }),
                        annotationMode: AnnotationMode.ENABLE_FORMS,
                        textLayerMode: 0,
                        layerProperties: {
                            annotationStorage: pdf.annotationStorage,
                            downloadManager: null,
                            enableScripting: false,
                            fieldObjectsPromise: Promise.resolve(fieldObjects),
                            hasJSActionsPromise: pdf.hasJSActions(),
                            linkService,
                        },
                    });

                    pdfPageView.setPdfPage(page);

                    if (pageNumber === 1) {
                        pagesNode.style.setProperty('--scale-factor', String(pdfPageView.viewport.scale));
                    }

                    pageViews.push(pdfPageView);
                    await pdfPageView.draw();
                }

                if (!cancelled) {
                    pageViewsRef.current = pageViews;
                    const latestScale = scaleForWidth(firstPage, Math.max(240, widthRef.current - 32));

                    if (Math.abs(latestScale - scale) >= 0.02) {
                        applyPageScale(pageViews, pagesNode, latestScale);
                    }

                    setLoading(false);
                }
            })
            .catch((caught) => {
                if (!cancelled) {
                    setError(caught instanceof Error ? caught.message : 'Could not preview the PDF.');
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
            pageViewsRef.current = [];
            pdfRef.current = null;
            fieldObjectsRef.current = null;
            onFormStateChangeRef.current?.({ fillable: false, dirty: false });

            for (const view of pageViews) {
                try {
                    view.destroy();
                } catch {
                    // Ignore duplicate destroy while unmounting.
                }
            }

            try {
                Promise.resolve(loadingTask.destroy()).catch(() => {});
            } catch {
                // The worker may already be torn down while the dialog is closing.
            }

            try {
                pdfDocument?.destroy();
            } catch {
                // Ignore duplicate destroy while unmounting.
            }
        };
    }, [readyUrl]);

    useEffect(() => {
        const pageViews = pageViewsRef.current;
        const pagesNode = pagesRef.current;
        const firstView = pageViews[0];

        if (loading || width < 80 || firstView == null || pagesNode == null) {
            return;
        }

        const nextScale = Math.max(240, width - 32) / (firstView.viewport.width / firstView.scale);

        if (Math.abs(nextScale - firstView.scale) < 0.02) {
            return;
        }

        applyPageScale(pageViews, pagesNode, nextScale);
    }, [width, loading]);

    return (
        <div
            ref={frameRef}
            className="relative flex h-[min(70vh,40rem)] w-full justify-center overflow-x-hidden overflow-y-auto bg-neutral-200 [scrollbar-gutter:stable]"
        >
            {loading ? (
                <p className="text-muted-foreground pointer-events-none absolute inset-x-0 top-4 z-10 text-center text-sm">
                    Loading preview…
                </p>
            ) : null}
            {error ? (
                <p className="text-destructive pointer-events-none absolute inset-x-0 top-4 z-10 text-center text-sm">{error}</p>
            ) : null}
            <div className="flex min-h-full w-full flex-col items-center p-4">
                <div ref={pagesRef} className="pdfViewer w-full" />
            </div>
        </div>
    );
});
