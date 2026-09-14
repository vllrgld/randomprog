import { PDFDocument } from 'pdf-lib';
import '@fontsource/dancing-script/400.css';
import '@fontsource/great-vibes/400.css';
import '@fontsource/pacifico/400.css';
import '@fontsource/satisfy/400.css';
import '@fontsource/allura/400.css';
import '@fontsource/homemade-apple/400.css';

export const SIGNATURE_STYLES = [
    { id: 'dancing-script', label: 'Casual', family: '"Dancing Script", cursive' },
    { id: 'great-vibes', label: 'Elegant', family: '"Great Vibes", cursive' },
    { id: 'pacifico', label: 'Bold', family: '"Pacifico", cursive' },
    { id: 'satisfy', label: 'Smooth', family: '"Satisfy", cursive' },
    { id: 'allura', label: 'Formal', family: '"Allura", cursive' },
    { id: 'homemade-apple', label: 'Handwritten', family: '"Homemade Apple", cursive' },
];

export const SIGNATURE_FONT = SIGNATURE_STYLES[0].family;
export const SIGNATURE_SIZE_MIN = 0.5;
export const SIGNATURE_SIZE_MAX = 2;
export const SIGNATURE_SIZE_STEP = 0.25;

export function clampSignatureSize(scale) {
    return Math.min(SIGNATURE_SIZE_MAX, Math.max(SIGNATURE_SIZE_MIN, Math.round(scale * 100) / 100));
}

export function signatureStyleById(id) {
    return SIGNATURE_STYLES.find((style) => style.id === id) ?? SIGNATURE_STYLES[0];
}

export async function renderTypedSignature(text, fontFamily = SIGNATURE_FONT) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontSize = 64;
    const font = `${fontSize}px ${fontFamily}`;

    try {
        await document.fonts.load(font);
    } catch {
        // Fall back to the browser's cursive stack if the webfont is still loading.
    }

    context.font = font;
    const width = Math.max(32, Math.ceil(context.measureText(text).width) + 28);
    const height = Math.ceil(fontSize * 1.9);

    canvas.width = width;
    canvas.height = height;
    context.font = font;
    context.fillStyle = '#111827';
    context.textBaseline = 'alphabetic';
    context.fillText(text, 14, fontSize * 1.2);

    return canvas.toDataURL('image/png');
}

export async function stampSignaturesOnPdf(pdfBytes, stamps) {
    if (!Array.isArray(stamps) || stamps.length === 0) {
        return pdfBytes;
    }

    const document = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    for (const stamp of stamps) {
        const page = document.getPages()[stamp.pageIndex];

        if (page == null || stamp.dataUrl == null) {
            continue;
        }

        const bytes = dataUrlToBytes(stamp.dataUrl);
        const image = await document.embedPng(bytes);

        page.drawImage(image, {
            x: stamp.pdfX,
            y: stamp.pdfY,
            width: stamp.pdfWidth,
            height: stamp.pdfHeight,
        });
    }

    return document.save();
}

function dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1] ?? '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}
