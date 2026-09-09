<?php

return [

    /*
    |--------------------------------------------------------------------------
    | PDF Compression Driver
    |--------------------------------------------------------------------------
    |
    | The active compressor used when a PDF is uploaded. Add a new class that
    | implements App\Contracts\PdfCompressor, register it in AppServiceProvider,
    | then set PDF_COMPRESSION_DRIVER to that key.
    |
    | Ghostscript quality presets:
    |   original — store the upload without compressing
    |   ebook    — 150 dpi, best size/quality balance (default)
    |   screen   — smallest, 72 dpi (looks like a fax)
    |
    */

    'compression' => [
        'driver' => env('PDF_COMPRESSION_DRIVER', 'ghostscript'),

        'drivers' => [
            'ghostscript' => [
                'binary' => env('GS_BINARY'),
                'pdf_settings' => env('GS_PDF_SETTINGS', 'ebook'),
            ],
        ],
    ],

];
