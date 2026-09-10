import { useEffect, useState } from 'react';
import { PencilIcon } from 'lucide-react';
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
import { updateIdMetadata } from '@/lib/documents';

const ID_FIELDS = [
    ['first_name', 'First name', 'text'],
    ['middle_name', 'Middle name', 'text'],
    ['last_name', 'Last name', 'text'],
    ['suffix', 'Suffix', 'text'],
    ['id_number', 'ID number', 'text'],
    ['sex', 'Sex', 'text'],
    ['civil_status', 'Civil status', 'text'],
    ['blood_type', 'Blood type', 'text'],
    ['birthday', 'Birthday', 'date'],
    ['place_of_birth', 'Place of birth', 'text'],
    ['address', 'Address', 'text'],
    ['issued_on', 'Issued on', 'date'],
];

function emptyDraft() {
    return Object.fromEntries(ID_FIELDS.map(([key]) => [key, '']));
}

function draftFromIdentity(identity) {
    return Object.fromEntries(
        ID_FIELDS.map(([key]) => [key, identity?.[key] == null ? '' : String(identity[key])]),
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1 py-1.5 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value === null || value === undefined || value === '' ? '—' : String(value)}</dd>
        </div>
    );
}

export default function DocumentInfoDialog({ document: file, open, onOpenChange, onDocumentChange }) {
    const identity = file?.id_metadata ?? null;
    const isId = file?.uses_id_metadata === true;
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(emptyDraft);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open) {
            setEditing(false);
            setError(null);
            setSaving(false);

            return;
        }

        setDraft(draftFromIdentity(identity));
    }, [open, identity]);

    async function handleSave() {
        if (!file?.id || saving) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const updated = await updateIdMetadata(file.id, draft);
            onDocumentChange?.(updated);
            setEditing(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not save ID info.');
        } finally {
            setSaving(false);
        }
    }

    function handleCancel() {
        setDraft(draftFromIdentity(identity));
        setEditing(false);
        setError(null);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className={isId && identity != null ? 'pr-8' : undefined}>ID info</DialogTitle>
                    <DialogDescription className="sr-only">Identity details extracted from this ID.</DialogDescription>
                </DialogHeader>
                {isId && identity == null ? (
                    <p className="text-muted-foreground text-sm">
                        Click <span className="font-medium text-foreground">AI context</span> first to extract and save the ID details from this document.
                    </p>
                ) : null}
                {isId && identity != null && !editing ? (
                    <dl>
                        {ID_FIELDS.map(([key, label]) => (
                            <InfoRow key={key} label={label} value={identity[key]} />
                        ))}
                    </dl>
                ) : null}
                {isId && identity != null && editing ? (
                    <div className="grid gap-3">
                        {ID_FIELDS.map(([key, label, type]) => (
                            <div key={key} className="grid gap-1.5">
                                <label className="text-muted-foreground text-xs" htmlFor={`id-field-${key}`}>
                                    {label}
                                </label>
                                <Input
                                    id={`id-field-${key}`}
                                    type={type}
                                    value={draft[key]}
                                    disabled={saving}
                                    onChange={(event) =>
                                        setDraft((current) => ({
                                            ...current,
                                            [key]: event.target.value,
                                        }))
                                    }
                                />
                            </div>
                        ))}
                        {error ? <p className="text-destructive text-xs">{error}</p> : null}
                    </div>
                ) : null}
                {!isId ? (
                    <p className="text-muted-foreground text-sm">No extra info for this document type.</p>
                ) : null}
                {isId && identity != null && editing ? (
                    <DialogFooter>
                        <Button variant="outline" disabled={saving} onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button disabled={saving} onClick={handleSave}>
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                ) : null}
                {isId && identity != null && !editing ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-2 right-10 z-50"
                        title="Edit ID info"
                        onClick={() => setEditing(true)}
                    >
                        <PencilIcon />
                        <span className="sr-only">Edit ID info</span>
                    </Button>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
