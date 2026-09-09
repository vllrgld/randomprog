import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getSettings, updateSettings } from '@/lib/settings';

export default function Settings() {
    const [quality, setQuality] = useState(null);
    const [pendingQuality, setPendingQuality] = useState(null);
    const [options, setOptions] = useState([]);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;

        getSettings()
            .then((settings) => {
                if (!cancelled) {
                    setQuality(settings.pdf_quality);
                    setOptions(settings.pdf_qualities);
                    setError(null);
                }
            })
            .catch((caught) => {
                if (!cancelled) {
                    setError(caught instanceof Error ? caught.message : 'Could not load settings.');
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const pendingOption = options.find((option) => option.value === pendingQuality);

    async function confirmChange() {
        if (busy || pendingQuality == null || pendingQuality === quality) {
            setPendingQuality(null);

            return;
        }

        setBusy(true);
        setError(null);
        setStatus(null);

        try {
            const settings = await updateSettings(pendingQuality);
            setQuality(settings.pdf_quality);
            setPendingQuality(null);
            setStatus('Saved. New uploads will use this quality.');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not save settings.');
        } finally {
            setBusy(false);
        }
    }

    if (error && options.length === 0) {
        return <p className="text-destructive">{error}</p>;
    }

    return (
        <div className="grid max-w-xl gap-4">
            <div className="grid gap-1">
                <h2 className="text-sm font-medium">PDF compression quality</h2>
                <p className="text-muted-foreground text-sm">
                    Applied when a PDF is attached. Smaller presets make smaller files.
                </p>
            </div>
            <fieldset className="grid gap-2" disabled={busy || quality == null}>
                <legend className="sr-only">PDF compression quality</legend>
                {options.map((option) => (
                    <Label
                        key={option.value}
                        className="hover:bg-muted/50 has-[:checked]:bg-muted/70 has-[:checked]:ring-ring/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:ring-1"
                    >
                        <input
                            type="radio"
                            name="pdf_quality"
                            value={option.value}
                            checked={quality === option.value}
                            onChange={() => {
                                if (option.value === quality) {
                                    return;
                                }

                                setStatus(null);
                                setPendingQuality(option.value);
                            }}
                            className="mt-0.5"
                        />
                        <span className="grid gap-1">
                            <span>{option.label}</span>
                            <span className="text-muted-foreground text-xs font-normal">{option.description}</span>
                        </span>
                    </Label>
                ))}
            </fieldset>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            {status ? <p className="text-muted-foreground text-sm">{status}</p> : null}

            <Dialog
                open={pendingQuality != null}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen && !busy) {
                        setPendingQuality(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Change compression quality?</DialogTitle>
                        <DialogDescription>
                            {pendingOption
                                ? `New PDF uploads will use ${pendingOption.label}: ${pendingOption.description}`
                                : 'New PDF uploads will use the selected quality.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose render={<Button variant="outline" disabled={busy} />}>Cancel</DialogClose>
                        <Button disabled={busy} onClick={confirmChange}>
                            {busy ? 'Saving…' : 'Confirm'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
