<?php

namespace App\Providers;

use App\Contracts\OcrClient;
use App\Contracts\PdfCompressor;
use App\Ocr\OcrSpaceClient;
use App\PdfCompression\GhostscriptPdfCompressor;
use App\PdfCompression\NullPdfCompressor;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(PdfCompressor::class, function (): PdfCompressor {
            $driver = config('pdf.compression.driver') ?: 'none';

            return match ($driver) {
                'ghostscript' => new GhostscriptPdfCompressor(
                    config('pdf.compression.drivers.ghostscript.binary') ?: null,
                ),
                'none' => new NullPdfCompressor,
                default => throw new InvalidArgumentException("Unsupported PDF compression driver [{$driver}]."),
            };
        });

        $this->app->singleton(OcrClient::class, OcrSpaceClient::class);
    }
}
