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

export async function listDocuments(query = '') {
    const params = new URLSearchParams();
    const search = query.trim();

    if (search !== '') {
        params.set('q', search);
    }

    const url = params.size > 0 ? `/documents?${params}` : '/documents';

    const response = await fetch(url, {
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

export async function uploadDocument(file, docType = 'unknown') {
    const body = new FormData();
    body.append('file', file);
    body.append('doc_type', docType);

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

export async function saveDocumentFile(documentId, blob, filename) {
    const body = new FormData();
    body.append('file', blob, filename);

    const response = await fetch(`/documents/${documentId}/file`, {
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
        throw new Error(payload?.message ?? 'Could not save the document.');
    }

    return payload;
}

export async function deleteDocument(documentId) {
    const response = await fetch(`/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
            Accept: 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => null);

        throw new Error(payload?.message ?? 'Could not delete the document.');
    }
}

export async function loadDocumentContext(url, model, formText = '', pageText = '') {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
            model,
            form_text: formText,
            page_text: pageText,
        }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(payload?.message ?? 'Could not load document context.');
    }

    return payload;
}

export async function updateIdMetadata(documentId, fields) {
    const response = await fetch(`/documents/${documentId}/id-metadata`, {
        method: 'PUT',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify(fields),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(payload?.message ?? 'Could not save ID info.');
    }

    return payload;
}
