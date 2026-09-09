<?php

namespace Tests\Feature;

use App\PdfCompression\PdfCompressionSettings;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class PdfCompressionSettingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Cache::forget(PdfCompressionSettings::CACHE_KEY);
    }

    public function test_compression_quality_defaults_to_ebook(): void
    {
        $this->getJson(route('settings.show'))
            ->assertOk()
            ->assertJsonPath('pdf_quality', 'ebook')
            ->assertJsonCount(3, 'pdf_qualities');
    }

    public function test_compression_quality_can_be_updated(): void
    {
        $this->putJson(route('settings.update'), [
            'pdf_quality' => 'screen',
        ])
            ->assertOk()
            ->assertJsonPath('pdf_quality', 'screen');

        $this->getJson(route('settings.show'))
            ->assertOk()
            ->assertJsonPath('pdf_quality', 'screen');

        $this->assertSame('screen', app(PdfCompressionSettings::class)->quality());
    }

    public function test_original_quality_skips_compression(): void
    {
        $this->putJson(route('settings.update'), [
            'pdf_quality' => 'original',
        ])
            ->assertOk()
            ->assertJsonPath('pdf_quality', 'original');

        $this->assertFalse(app(PdfCompressionSettings::class)->shouldCompress());
    }

    public function test_invalid_compression_quality_is_rejected(): void
    {
        $this->putJson(route('settings.update'), [
            'pdf_quality' => 'printer',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('pdf_quality');
    }
}
