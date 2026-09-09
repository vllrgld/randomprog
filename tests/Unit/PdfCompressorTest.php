<?php

namespace Tests\Unit;

use App\PdfCompression\GhostscriptPdfCompressor;
use App\PdfCompression\NullPdfCompressor;
use Tests\TestCase;

class PdfCompressorTest extends TestCase
{
    public function test_ghostscript_driver_supports_pdf_files(): void
    {
        $compressor = new GhostscriptPdfCompressor;

        $this->assertTrue($compressor->supports('application/pdf', 'report.pdf'));
        $this->assertFalse($compressor->supports('text/plain', 'notes.txt'));
    }

    public function test_null_driver_does_not_compress(): void
    {
        $compressor = new NullPdfCompressor;

        $this->assertFalse($compressor->supports('application/pdf', 'report.pdf'));
    }
}
