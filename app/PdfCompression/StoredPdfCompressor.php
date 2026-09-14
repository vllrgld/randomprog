<?php

namespace App\PdfCompression;

use App\Contracts\PdfCompressor;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class StoredPdfCompressor
{
    public function __construct(
        private PdfCompressor $compressor,
        private PdfCompressionSettings $settings,
    ) {}

    /**
     * Compress an uploaded file, then store the result on the documents disk.
     *
     * @return array{path: string, size: int, compressed: bool, compression_ran: bool, original_size: int, original_name: string, mime_type: string}
     */
    public function storeUploaded(UploadedFile $file): array
    {
        $originalName = $file->getClientOriginalName();
        $mimeType = (string) $file->getClientMimeType();
        $originalSize = $file->getSize();
        $absolutePath = $file->getRealPath() ?: $file->getPathname();
        $path = $file->hashName();
        $disk = Storage::disk('documents');
        $compressed = false;
        $compressionRan = false;

        if ($this->shouldCompress($mimeType, $originalName, $absolutePath)) {
            try {
                $result = $this->compressor->compress($absolutePath);

                if ($result !== '') {
                    $disk->put($path, $result);
                    $compressed = strlen($result) < $originalSize;
                    $compressionRan = true;
                }
            } catch (Throwable $exception) {
                Log::warning('PDF compression failed; storing the original file.', [
                    'name' => $originalName,
                    'quality' => $this->settings->quality(),
                    'driver' => $this->compressor::class,
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        if (! $disk->exists($path)) {
            $disk->putFileAs('', $file, $path);
        }

        return [
            'path' => $path,
            'size' => $disk->size($path),
            'compressed' => $compressed,
            'compression_ran' => $compressionRan,
            'original_size' => $originalSize,
            'original_name' => $originalName,
            'mime_type' => $mimeType,
        ];
    }

    /**
     * Compress a file already stored on the documents disk.
     *
     * @return array{path: string, size: int, compressed: bool}
     */
    public function compress(string $storedPath, string $mimeType, string $originalName): array
    {
        $disk = Storage::disk('documents');

        $result = [
            'path' => $storedPath,
            'size' => $disk->size($storedPath),
            'compressed' => false,
        ];

        if (! $this->shouldCompress($mimeType, $originalName, $disk->path($storedPath))) {
            return $result;
        }

        try {
            $originalSize = $result['size'];
            $compressed = $this->compressor->compress($disk->path($storedPath));

            if ($compressed === '') {
                return $result;
            }

            $disk->put($storedPath, $compressed);

            return [
                'path' => $storedPath,
                'size' => $disk->size($storedPath),
                'compressed' => strlen($compressed) < $originalSize,
            ];
        } catch (Throwable $exception) {
            Log::warning('PDF compression failed; storing the original file.', [
                'path' => $storedPath,
                'quality' => $this->settings->quality(),
                'driver' => $this->compressor::class,
                'message' => $exception->getMessage(),
            ]);

            return $result;
        }
    }

    /**
     * Compress a PDF for download without replacing the stored file.
     * Fillable forms are allowed here so a filled copy can be shrunk.
     *
     * @param  'ebook'|'screen'  $quality
     */
    public function compressForDownload(string $absolutePath, string $mimeType, string $originalName, string $quality): string
    {
        $original = (string) file_get_contents($absolutePath);

        if (! in_array($quality, PdfCompressionSettings::PRESETS, true)) {
            return $original;
        }

        if (! $this->compressor->supports($mimeType, $originalName) && ! $this->fileStartsWithPdf($absolutePath)) {
            return $original;
        }

        $compressor = $this->compressor instanceof GhostscriptPdfCompressor
            ? $this->compressor->withPdfSettings($quality)
            : $this->compressor;

        try {
            $compressed = $compressor->compress($absolutePath);

            return $compressed !== '' ? $compressed : $original;
        } catch (Throwable $exception) {
            Log::warning('PDF compression failed; downloading the uncompressed file.', [
                'name' => $originalName,
                'quality' => $quality,
                'driver' => $this->compressor::class,
                'message' => $exception->getMessage(),
            ]);

            return $original;
        }
    }

    private function shouldCompress(string $mimeType, string $originalName, string $absolutePath, bool $skipFillable = true): bool
    {
        if (! $this->settings->shouldCompress()) {
            return false;
        }

        if ($skipFillable && $this->hasFormFields($absolutePath)) {
            return false;
        }

        return $this->compressor->supports($mimeType, $originalName)
            || $this->fileStartsWithPdf($absolutePath);
    }

    private function hasFormFields(string $absolutePath): bool
    {
        $contents = @file_get_contents($absolutePath);

        return is_string($contents)
            && (str_contains($contents, '/AcroForm') || str_contains($contents, '/XFA'));
    }

    private function fileStartsWithPdf(string $absolutePath): bool
    {
        $handle = @fopen($absolutePath, 'rb');

        if ($handle === false) {
            return false;
        }

        $header = fread($handle, 4);
        fclose($handle);

        return $header === '%PDF';
    }
}
