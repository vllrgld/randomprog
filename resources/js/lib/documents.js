export function formatFileSize(bytes) {
    const value = Number(bytes) || 0;

    if (value >= 1024 * 1024) {
        const megabytes = value / (1024 * 1024);
        const rounded = megabytes >= 10 ? Math.round(megabytes) : Math.round(megabytes * 10) / 10;

        return `${rounded} MB`;
    }

    if (value <= 0) {
        return '0 KB';
    }

    return `${Math.max(1, Math.round(value / 1024))} KB`;
}

export function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

export async function listDocuments() {
    const response = await fetch('/documents', {
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    });

    if (!response.ok) {
        throw new Error('Could not load documents.');
    }

    return response.json();
}

export async function uploadDocument(file) {
    const body = new FormData();
    body.append('file', file);

    const response = await fetch('/documents', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(payload?.message ?? 'Could not upload the document.');
    }

    return payload;
}
