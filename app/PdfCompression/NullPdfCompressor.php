<?php

namespace App\PdfCompression;

use App\Contracts\PdfCompressor;
use Illuminate\Support\Facades\File;

class NullPdfCompressor implements PdfCompressor
{
    /**
     * Keep the original file. Used in tests or when compression is disabled.
     */
    public function supports(string $mimeType, string $filename): bool
    {
        return false;
    }

    public function compress(string $absolutePath): string
    {
        return File::get($absolutePath);
    }
}
