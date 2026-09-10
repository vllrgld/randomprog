<?php

namespace App\Ocr;

use App\Contracts\OcrClient;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OcrSpaceClient implements OcrClient
{
    /**
     * @return array<string, mixed>
     */
    public function parse(string $absolutePath, string $filename, string $mimeType): array
    {
        $apiKey = config('services.ocrspace.key');

        if (! filled($apiKey)) {
            throw new RuntimeException('OCR.space API key is not configured.');
        }

        $contents = File::get($absolutePath);

        $response = Http::timeout((int) config('services.ocrspace.timeout', 120))
            ->withHeaders(['apikey' => (string) $apiKey])
            ->attach('file', $contents, $filename, [
                'Content-Type' => $mimeType !== '' ? $mimeType : 'application/octet-stream',
            ])
            ->post((string) config('services.ocrspace.url'), [
                'OCREngine' => (string) config('services.ocrspace.engine', 2),
                'language' => 'auto',
                'scale' => 'true',
                'filetype' => $this->fileType($filename),
            ]);

        $response->throw();

        $payload = $response->json();

        if (! is_array($payload)) {
            throw new RuntimeException('OCR.space returned an invalid response.');
        }

        return $payload;
    }

    private function fileType(string $filename): string
    {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        return match ($extension) {
            'png' => 'PNG',
            'jpg', 'jpeg' => 'JPG',
            'gif' => 'GIF',
            'tif', 'tiff' => 'TIF',
            'bmp' => 'BMP',
            default => 'PDF',
        };
    }
}
