import { csrfToken } from '@/lib/documents';

export async function getSettings() {
    const response = await fetch('/settings', {
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    });

    if (!response.ok) {
        throw new Error('Could not load settings.');
    }

    return response.json();
}

export async function updateSettings(pdfQuality) {
    const response = await fetch('/settings', {
        method: 'PUT',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ pdf_quality: pdfQuality }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(payload?.message ?? 'Could not save settings.');
    }

    return payload;
}
