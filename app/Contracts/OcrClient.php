<?php

namespace App\Contracts;

interface OcrClient
{
    /**
     * Run OCR on a local file and return the provider JSON payload.
     *
     * @return array<string, mixed>
     */
    public function parse(string $absolutePath, string $filename, string $mimeType): array;
}
