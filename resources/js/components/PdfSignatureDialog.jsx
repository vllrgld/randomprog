import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { renderTypedSignature, SIGNATURE_SIZE_MAX, SIGNATURE_SIZE_MIN, SIGNATURE_SIZE_STEP, SIGNATURE_STYLES, clampSignatureSize, signatureStyleById } from '@/lib/pdfSignature';

export default function PdfSignatureDialog({ open, onOpenChange, onApply }) {
    const canvasRef = useRef(null);
    const drawingRef = useRef(false);
    const [mode, setMode] = useState('type');
    const [text, setText] = useState('');
    const [styleId, setStyleId] = useState(SIGNATURE_STYLES[0].id);
    const [sizeScale, setSizeScale] = useState(1);
    const [hasStrokes, setHasStrokes] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }

        setMode('type');
        setText('');
        setHasStrokes(false);
    }, [open]);

    useEffect(() => {
        if (!open || mode !== 'draw') {
            return;
        }

        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if (canvas == null || context == null) {
            return;
        }

        const sizeCanvas = () => {
            const ratio = window.devicePixelRatio || 1;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;

            if (width < 2 || height < 2) {
                return false;
            }

            canvas.width = Math.floor(width * ratio);
            canvas.height = Math.floor(height * ratio);
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.lineWidth = 2.25;
            context.strokeStyle = '#111827';
            setHasStrokes(false);

            return true;
        };

        let frame = 0;
        const waitForSize = () => {
            if (!sizeCanvas()) {
                frame = requestAnimationFrame(waitForSize);
            }
        };

        waitForSize();

        const point = (event) => {
            const box = canvas.getBoundingClientRect();

            return {
                x: event.clientX - box.left,
                y: event.clientY - box.top,
            };
        };

        const start = (event) => {
            event.preventDefault();
            drawingRef.current = true;
            canvas.setPointerCapture(event.pointerId);
            const { x, y } = point(event);
            context.beginPath();
            context.moveTo(x, y);
        };

        const move = (event) => {
            if (!drawingRef.current) {
                return;
            }

            event.preventDefault();
            const { x, y } = point(event);
            context.lineTo(x, y);
            context.stroke();
            setHasStrokes(true);
        };

        const end = (event) => {
            if (!drawingRef.current) {
                return;
            }

            drawingRef.current = false;

            try {
                canvas.releasePointerCapture(event.pointerId);
            } catch {
                // Capture may already be released.
            }
        };

        canvas.addEventListener('pointerdown', start);
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);

        return () => {
            cancelAnimationFrame(frame);
            canvas.removeEventListener('pointerdown', start);
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', end);
            canvas.removeEventListener('pointercancel', end);
        };
    }, [open, mode]);

    function clearDrawing() {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if (canvas == null || context == null) {
            return;
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        const ratio = window.devicePixelRatio || 1;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = 2.25;
        context.strokeStyle = '#111827';
        setHasStrokes(false);
    }

    async function handleApply() {
        if (mode === 'type') {
            const value = text.trim();

            if (value === '') {
                return;
            }

            onApply?.({
                dataUrl: await renderTypedSignature(value, signatureStyleById(styleId).family),
                scale: sizeScale,
            });
            onOpenChange?.(false);

            return;
        }

        const canvas = canvasRef.current;

        if (canvas == null || !hasStrokes) {
            return;
        }

        onApply?.({ dataUrl: canvas.toDataURL('image/png'), scale: sizeScale });
        onOpenChange?.(false);
    }

    const canApply = mode === 'type' ? text.trim() !== '' : hasStrokes;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Sign PDF</DialogTitle>
                    <DialogDescription>
                        Type a name in a script style, or draw with the mouse or touch.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant={mode === 'type' ? 'default' : 'outline'}
                        onClick={() => setMode('type')}
                    >
                        Type
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={mode === 'draw' ? 'default' : 'outline'}
                        onClick={() => setMode('draw')}
                    >
                        Draw
                    </Button>
                    <div className="ml-auto flex items-center gap-1">
                        <span className="text-muted-foreground mr-1 text-xs">Size</span>
                        <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={sizeScale <= SIGNATURE_SIZE_MIN}
                            title="Smaller signature"
                            onClick={() => setSizeScale((current) => clampSignatureSize(current - SIGNATURE_SIZE_STEP))}
                        >
                            A−
                        </Button>
                        <span className="text-muted-foreground w-9 text-center text-xs tabular-nums">
                            {Math.round(sizeScale * 100)}%
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={sizeScale >= SIGNATURE_SIZE_MAX}
                            title="Larger signature"
                            onClick={() => setSizeScale((current) => clampSignatureSize(current + SIGNATURE_SIZE_STEP))}
                        >
                            A+
                        </Button>
                    </div>
                </div>
                {mode === 'type' ? (
                    <div className="grid gap-3">
                        <Input
                            value={text}
                            placeholder="Your name"
                            autoComplete="name"
                            onChange={(event) => setText(event.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-2">
                            {SIGNATURE_STYLES.map((style) => {
                                const selected = style.id === styleId;

                                return (
                                    <button
                                        key={style.id}
                                        type="button"
                                        title={style.label}
                                        className={cn(
                                            'border-input min-h-14 overflow-hidden rounded-lg border px-3 py-2 text-left outline-none transition-shadow',
                                            selected
                                                ? 'border-ring ring-3 ring-ring/50'
                                                : 'hover:bg-muted/50',
                                        )}
                                        onClick={() => setStyleId(style.id)}
                                    >
                                        <span className="text-muted-foreground block text-[0.65rem] leading-none">
                                            {style.label}
                                        </span>
                                        <span
                                            className="mt-1 block truncate leading-tight"
                                            style={{
                                                fontFamily: style.family,
                                                fontSize: `${Math.max(1, 1.5 * sizeScale)}rem`,
                                            }}
                                        >
                                            {text.trim() === '' ? 'Signature' : text}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-2">
                        <canvas
                            ref={canvasRef}
                            className="border-input h-36 w-full touch-none rounded-lg border bg-white"
                        />
                        <Button type="button" variant="outline" size="sm" onClick={clearDrawing}>
                            Clear
                        </Button>
                    </div>
                )}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
                        Cancel
                    </Button>
                    <Button type="button" disabled={!canApply} onClick={handleApply}>
                        Place on PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
