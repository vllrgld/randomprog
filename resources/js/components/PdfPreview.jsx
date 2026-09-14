import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AnnotationMode, getDocument, GlobalWorkerOptions, PixelsPerInch } from 'pdfjs-dist';
import { EventBus, PDFLinkService, PDFPageView } from 'pdfjs-dist/web/pdf_viewer.mjs';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { stampSignaturesOnPdf } from '@/lib/pdfSignature';
import '../../css/pdf-preview.css';

GlobalWorkerOptions.workerSrc = workerUrl;

export const FORM_FONT_MIN = 0.75;
export const FORM_FONT_MAX = 2;
export const FORM_FONT_STEP = 0.25;

const FORM_TEXT_SELECTOR = '.textWidgetAnnotation :is(input, textarea), .choiceWidgetAnnotation select';

function clampFormFontScale(scale) {
    return Math.min(FORM_FONT_MAX, Math.max(FORM_FONT_MIN, Math.round(scale * 100) / 100));
}

function formFieldId(element) {
    if (!(element instanceof HTMLElement)) {
        return null;
    }

    return element.getAttribute('data-element-id')
        ?? element.closest('[data-element-id]')?.getAttribute('data-element-id')
        ?? null;
}

function formTextControl(target) {
    if (!(target instanceof HTMLElement)) {
        return null;
    }

    return target.matches(FORM_TEXT_SELECTOR) ? target : target.closest(FORM_TEXT_SELECTOR);
}

function scaleForField(fieldFontScales, id) {
    if (id == null) {
        return 1;
    }

    return fieldFontScales.get(id) ?? 1;
}

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

function scaleForView(page, availableWidth, viewScale) {
    if (viewScale === 'fit') {
        return scaleForWidth(page, availableWidth);
    }

    const percent = Number(viewScale);

    if (!Number.isFinite(percent) || percent <= 0) {
        return scaleForWidth(page, availableWidth);
    }

    return percent / 100;
}

function scaleFromRenderedView(firstView, availableWidth, viewScale) {
    if (viewScale === 'fit') {
        return Math.max(240, availableWidth) / (firstView.viewport.width / firstView.scale);
    }

    const percent = Number(viewScale);

    if (!Number.isFinite(percent) || percent <= 0) {
        return Math.max(240, availableWidth) / (firstView.viewport.width / firstView.scale);
    }

    return percent / 100;
}

function applyPageScale(pageViews, pagesNode, scale) {
    if (pageViews.length === 0 || pagesNode == null) {
        return Promise.resolve();
    }

    pagesNode.style.setProperty('--scale-factor', String(scale * PixelsPerInch.PDF_TO_CSS_UNITS));

    const redraws = [];

    for (const view of pageViews) {
        view.update({ scale });

        if (view.renderingState === 0) {
            redraws.push(Promise.resolve(view.draw()).catch(() => {}));
        }
    }

    return Promise.all(redraws);
}

function fitTextWidgetFont(element, formFontScale) {
    if (element.classList.contains('comb') || element.closest('.comb')) {
        return;
    }

    const specified = element.dataset.baseFontSize || element.style.fontSize;

    if (!element.dataset.baseFontSize && specified) {
        element.dataset.baseFontSize = specified;
    }

    const match = (element.dataset.baseFontSize || '').match(/calc\(([0-9.]+)px/i);

    if (!match) {
        return;
    }

    const base = Number(match[1]) * formFontScale;
    const applySize = (size) => {
        element.style.setProperty(
            'font-size',
            `calc(${size}px * var(--total-scale-factor))`,
            'important',
        );
    };

    applySize(base);

    if (element.value === '' || element.clientWidth <= 0) {
        return;
    }

    const overflow = () => (
        element instanceof HTMLTextAreaElement
            ? element.scrollHeight > element.clientHeight + 1
            : element.scrollWidth > element.clientWidth + 1
    );

    let size = base;

    for (let step = 0; step < 12 && overflow(); step += 1) {
        const current = element instanceof HTMLTextAreaElement ? element.scrollHeight : element.scrollWidth;
        const available = element instanceof HTMLTextAreaElement ? element.clientHeight : element.clientWidth;
        const ratio = available / current;

        size = Math.max(0.5, Math.floor(size * ratio * 100) / 100);
        applySize(size);
    }
}

function applyFormFontToInputs(root, fieldFontScales) {
    if (root == null) {
        return;
    }

    for (const element of root.querySelectorAll(FORM_TEXT_SELECTOR)) {
        fitTextWidgetFont(element, scaleForField(fieldFontScales, formFieldId(element)));
    }
}

function applyFormFontToField(root, fieldFontScales, id) {
    if (root == null || id == null) {
        return;
    }

    const element = root.querySelector(`[data-element-id="${CSS.escape(id)}"]`);

    if (element == null) {
        return;
    }

    fitTextWidgetFont(element, scaleForField(fieldFontScales, id));
}

function applyFormFontToStorage(pdf, fieldObjects, fieldFontScales) {
    if (pdf == null || !(fieldObjects instanceof Map)) {
        return;
    }

    const minSize = 0.5;

    for (const [, widgets] of fieldObjects) {
        if (!Array.isArray(widgets)) {
            continue;
        }

        for (const widget of widgets) {
            const type = String(widget?.type ?? '').toLowerCase();

            if (['button', 'btn', 'checkbox', 'radiobutton', 'radio', 'signature', 'sig'].includes(type)) {
                continue;
            }

            if (widget?.id == null) {
                continue;
            }

            const stored = pdf.annotationStorage.getValue(widget.id, {
                value: widget.value,
            });
            const value = stored?.value;

            if (value == null || value === '') {
                continue;
            }

            let fitted = 9 * scaleForField(fieldFontScales, widget.id);

            if (Array.isArray(widget.rect) && widget.rect.length === 4) {
                const height = Math.abs(widget.rect[3] - widget.rect[1] - 2);
                const width = Math.abs(widget.rect[2] - widget.rect[0] - 4);
                const textWidth = Math.max(String(value).length * 0.5, 1);

                fitted = Math.min(fitted, height / 1.35, width / textWidth);
            }

            pdf.annotationStorage.setValue(widget.id, {
                value,
                fontSize: Math.max(minSize, Math.round(fitted * 100) / 100),
            });
        }
    }
}

function signatureOverlayBox(view, stamp) {
    const [x1, y1] = view.viewport.convertToViewportPoint(stamp.pdfX, stamp.pdfY + stamp.pdfHeight);
    const [x2, y2] = view.viewport.convertToViewportPoint(stamp.pdfX + stamp.pdfWidth, stamp.pdfY);

    return {
        left: `${Math.min(x1, x2)}px`,
        top: `${Math.min(y1, y2)}px`,
        width: `${Math.abs(x2 - x1)}px`,
        height: `${Math.abs(y2 - y1)}px`,
    };
}

function paintSignatureOverlays(pagesNode, pageViews, stamps) {
    if (pagesNode == null) {
        return;
    }

    for (const element of pagesNode.querySelectorAll('[data-pdf-signature]')) {
        element.remove();
    }

    for (const stamp of stamps) {
        const view = pageViews[stamp.pageIndex];
        const page = pagesNode.querySelector(`.page[data-page-number="${stamp.pageIndex + 1}"]`);

        if (view == null || page == null) {
            continue;
        }

        const image = document.createElement('img');

        image.dataset.pdfSignature = stamp.id;
        image.src = stamp.dataUrl;
        image.alt = 'Signature';
        image.draggable = false;
        Object.assign(image.style, {
            position: 'absolute',
            pointerEvents: 'none',
            zIndex: '6',
            ...signatureOverlayBox(view, stamp),
        });
        page.append(image);
    }
}

export default forwardRef(function PdfPreview({ url, onFormStateChange, onSelectedFormFontChange, viewScale = 'fit' }, ref) {
    const frameRef = useRef(null);
    const pagesRef = useRef(null);
    const pdfRef = useRef(null);
    const onFormStateChangeRef = useRef(onFormStateChange);
    const onSelectedFormFontChangeRef = useRef(onSelectedFormFontChange);
    const fieldObjectsRef = useRef(null);
    const pageViewsRef = useRef([]);
    const widthRef = useRef(0);
    const fieldFontScalesRef = useRef(new Map());
    const selectedFieldIdRef = useRef(null);
    const stampsRef = useRef([]);
    const pendingStampRef = useRef(null);
    const fillableRef = useRef(false);
    const viewScaleRef = useRef(viewScale);
    const [placingSignature, setPlacingSignature] = useState(false);
    const [width, setWidth] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const readyUrl = url && width >= 80 ? url : '';

    onFormStateChangeRef.current = onFormStateChange;
    onSelectedFormFontChangeRef.current = onSelectedFormFontChange;
    widthRef.current = width;
    viewScaleRef.current = viewScale;

    function reportSelectedFormFont(id) {
        onSelectedFormFontChangeRef.current?.({
            id,
            scale: scaleForField(fieldFontScalesRef.current, id),
        });
    }

    useImperativeHandle(ref, () => ({
        async saveFilled() {
            const pdf = pdfRef.current;

            if (!pdf) {
                throw new Error('The PDF is not loaded yet.');
            }

            let data;

            if (fillableRef.current) {
                applyFormFontToStorage(pdf, fieldObjectsRef.current, fieldFontScalesRef.current);

                try {
                    data = await pdf.saveDocument();
                } catch {
                    data = await pdf.getData();
                }
            } else {
                data = await pdf.getData();
            }

            return stampSignaturesOnPdf(data, stampsRef.current);
        },
        resetFormModified() {
            pdfRef.current?.annotationStorage.resetModified();
        },
        placeSignature(signature) {
            pendingStampRef.current = signature;
            setPlacingSignature(true);
        },
        cancelSignature() {
            pendingStampRef.current = null;
            setPlacingSignature(false);
        },
        nudgeSelectedFormFont(step) {
            const id = selectedFieldIdRef.current;

            if (id == null) {
                return;
            }

            const next = clampFormFontScale((fieldFontScalesRef.current.get(id) ?? 1) + step);

            fieldFontScalesRef.current.set(id, next);
            applyFormFontToField(pagesRef.current, fieldFontScalesRef.current, id);
            reportSelectedFormFont(id);
            onFormStateChangeRef.current?.({ fillable: fillableRef.current, dirty: true });
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
        const pagesNode = pagesRef.current;

        if (!pagesNode) {
            return;
        }

        const fitTarget = (event) => {
            const element = formTextControl(event.target);

            if (element == null) {
                return;
            }

            fitTextWidgetFont(element, scaleForField(fieldFontScalesRef.current, formFieldId(element)));
        };

        const selectField = (event) => {
            const id = formFieldId(formTextControl(event.target));

            if (id == null) {
                return;
            }

            selectedFieldIdRef.current = id;
            reportSelectedFormFont(id);
        };

        pagesNode.addEventListener('input', fitTarget);
        pagesNode.addEventListener('focusin', selectField);

        return () => {
            pagesNode.removeEventListener('input', fitTarget);
            pagesNode.removeEventListener('focusin', selectField);
        };
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
        stampsRef.current = [];
        pendingStampRef.current = null;
        fillableRef.current = false;
        fieldFontScalesRef.current = new Map();
        selectedFieldIdRef.current = null;
        setPlacingSignature(false);
        onFormStateChangeRef.current?.({ fillable: false, dirty: false });
        reportSelectedFormFont(null);

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
                fillableRef.current = fillable;

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

                const scale = scaleForView(firstPage, Math.max(240, widthRef.current - 32), viewScaleRef.current);

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
                    const latestScale = scaleForView(firstPage, Math.max(240, widthRef.current - 32), viewScaleRef.current);

                    if (Math.abs(latestScale - scale) >= 0.02) {
                        await applyPageScale(pageViews, pagesNode, latestScale);
                    }

                    applyFormFontToInputs(pagesNode, fieldFontScalesRef.current);
                    paintSignatureOverlays(pagesNode, pageViews, stampsRef.current);
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

        const nextScale = scaleFromRenderedView(firstView, width - 32, viewScale);

        if (!Number.isFinite(nextScale) || nextScale <= 0) {
            return;
        }

        if (Math.abs(nextScale - firstView.scale) < 0.02) {
            return;
        }

        let cancelled = false;

        applyPageScale(pageViews, pagesNode, nextScale).then(() => {
            if (cancelled) {
                return;
            }

            applyFormFontToInputs(pagesNode, fieldFontScalesRef.current);
            paintSignatureOverlays(pagesNode, pageViews, stampsRef.current);
        });

        return () => {
            cancelled = true;
        };
    }, [width, loading, viewScale]);

    useEffect(() => {
        const pagesNode = pagesRef.current;

        if (pagesNode == null || !placingSignature) {
            return;
        }

        const place = (event) => {
            const pending = pendingStampRef.current;
            const page = event.target.closest?.('.page');

            if (pending == null || page == null) {
                return;
            }

            const pageNumber = Number(page.dataset.pageNumber);
            const view = pageViewsRef.current[pageNumber - 1];

            if (view == null || !Number.isFinite(pageNumber)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            pendingStampRef.current = null;
            setPlacingSignature(false);

            const box = page.getBoundingClientRect();
            const image = new Image();

            image.onload = () => {
                const baseWidth = Math.min(220, box.width * 0.45);
                const cssWidth = Math.min(box.width * 0.9, baseWidth * (pending.scale ?? 1));
                const ratio = image.height / Math.max(image.width, 1);
                const cssHeight = cssWidth * ratio;
                const x = event.clientX - box.left - cssWidth / 2;
                const y = event.clientY - box.top - cssHeight / 2;
                const [x1, y1] = view.viewport.convertToPdfPoint(x, y);
                const [x2, y2] = view.viewport.convertToPdfPoint(x + cssWidth, y + cssHeight);
                const stamp = {
                    id: `sig-${Date.now()}`,
                    pageIndex: pageNumber - 1,
                    dataUrl: pending.dataUrl,
                    pdfX: Math.min(x1, x2),
                    pdfY: Math.min(y1, y2),
                    pdfWidth: Math.abs(x2 - x1),
                    pdfHeight: Math.abs(y2 - y1),
                };

                stampsRef.current = [...stampsRef.current, stamp];
                paintSignatureOverlays(pagesRef.current, pageViewsRef.current, stampsRef.current);
                onFormStateChangeRef.current?.({ fillable: fillableRef.current, dirty: true });
            };

            image.src = pending.dataUrl;
        };

        const cancel = (event) => {
            if (event.key === 'Escape') {
                pendingStampRef.current = null;
                setPlacingSignature(false);
            }
        };

        pagesNode.addEventListener('click', place, true);
        window.addEventListener('keydown', cancel);

        return () => {
            pagesNode.removeEventListener('click', place, true);
            window.removeEventListener('keydown', cancel);
        };
    }, [placingSignature]);

    return (
        <div
            ref={frameRef}
            className={`relative flex h-[min(70vh,40rem)] w-full overflow-y-auto bg-neutral-200 [scrollbar-gutter:stable] xl:h-full ${viewScale === 'fit' ? 'justify-center overflow-x-hidden' : 'justify-start overflow-x-auto'} ${placingSignature ? 'cursor-crosshair' : ''}`}
            data-placing-signature={placingSignature ? 'true' : undefined}
        >
            {loading ? (
                <p className="text-muted-foreground pointer-events-none absolute inset-x-0 top-4 z-10 text-center text-sm">
                    Loading preview…
                </p>
            ) : null}
            {error ? (
                <p className="text-destructive pointer-events-none absolute inset-x-0 top-4 z-10 text-center text-sm">{error}</p>
            ) : null}
            {placingSignature ? (
                <p className="text-muted-foreground pointer-events-none absolute inset-x-0 top-4 z-10 text-center text-sm">
                    Click the page to place the signature. Esc to cancel.
                </p>
            ) : null}
            <div className="flex min-h-full w-full flex-col items-center p-4">
                <div ref={pagesRef} className="pdfViewer w-full" />
            </div>
        </div>
    );
});
