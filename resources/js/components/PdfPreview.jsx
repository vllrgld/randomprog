import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfPreview({ url }) {
    const frameRef = useRef(null);
    const pagesRef = useRef(null);
    const [width, setWidth] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const frame = frameRef.current;

        if (!frame) {
            return;
        }

        const updateWidth = () => {
            setWidth((current) => {
                const next = frame.clientWidth;

                return Math.abs(current - next) < 8 ? current : next;
            });
        };

        updateWidth();

        const observer = new ResizeObserver(updateWidth);
        observer.observe(frame);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!url || width < 80) {
            return;
        }

        const pagesNode = pagesRef.current;
        let cancelled = false;
        let pdfDocument = null;

        setLoading(true);
        setError(null);
        pagesNode?.replaceChildren();

        const loadingTask = getDocument({
            url,
            withCredentials: true,
        });

        loadingTask.promise
            .then(async (pdf) => {
                pdfDocument = pdf;

                if (cancelled || !pagesNode) {
                    return;
                }

                const availableWidth = Math.max(240, width - 32);
                const dpr = window.devicePixelRatio || 1;

                for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                    const page = await pdf.getPage(pageNumber);

                    if (cancelled) {
                        return;
                    }

                    const unscaled = page.getViewport({ scale: 1 });
                    const scale = availableWidth / unscaled.width;
                    const viewport = page.getViewport({ scale });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');

                    canvas.width = Math.floor(viewport.width * dpr);
                    canvas.height = Math.floor(viewport.height * dpr);
                    canvas.style.width = `${Math.floor(viewport.width)}px`;
                    canvas.style.height = `${Math.floor(viewport.height)}px`;
                    canvas.className = 'mx-auto block bg-white shadow-md';

                    await page.render({
                        canvas,
                        canvasContext: context,
                        viewport,
                        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
                    }).promise;

                    if (cancelled) {
                        return;
                    }

                    pagesNode.append(canvas);
                }

                setLoading(false);
            })
            .catch((caught) => {
                if (!cancelled) {
                    setError(caught instanceof Error ? caught.message : 'Could not preview the PDF.');
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;

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
    }, [url, width]);

    return (
        <div
            ref={frameRef}
            className="flex h-[min(70vh,40rem)] w-full justify-center overflow-x-hidden overflow-y-scroll bg-neutral-200"
        >
            <div className="flex min-h-full w-full flex-col items-center justify-start gap-4 p-4">
                {loading ? <p className="text-muted-foreground text-sm">Loading preview…</p> : null}
                {error ? <p className="text-destructive text-sm">{error}</p> : null}
                <div ref={pagesRef} className="flex w-full flex-col items-center gap-4" />
            </div>
        </div>
    );
}
