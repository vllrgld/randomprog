<?php

namespace App\Contracts;

interface PdfCompressor
{
    /**
     * Whether this driver should compress the uploaded file.
     */
    public function supports(string $mimeType, string $filename): bool;

    /**
     * Compress the PDF at the given absolute path and return the compressed bytes.
     */
    public function compress(string $absolutePath): string;
}
