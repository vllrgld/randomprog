<?php

namespace Tests\Feature;

use App\Contracts\PdfCompressor;
use App\Models\Document;
use App\Models\OcrResult;
use App\PdfCompression\PdfCompressionSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OcrTest extends TestCase
{
    use RefreshDatabase;

    public function test_ocr_runs_with_engine_two_only_after_compression_and_is_stored(): void
    {
        Storage::fake('documents');
        $this->fakeOcrSpace();

        $httpDuringCompress = null;

        $this->app->instance(PdfCompressor::class, $this->compressorThatRecordsHttp($httpDuringCompress));

        $this->post(route('documents.store'), [
            'file' => UploadedFile::fake()->create('report.pdf', 120, 'application/pdf'),
        ], [
            'Accept' => 'application/json',
        ])
            ->assertCreated()
            ->assertJsonPath('name', 'report.pdf')
            ->assertJsonPath('compressed', true)
            ->assertJsonPath('ocr_url', route('documents.ocr', Document::query()->first()));

        $this->assertSame([], $httpDuringCompress);

        Http::assertSent(fn ($request): bool => str_contains($request->url(), 'ocr.space')
            && $request->hasHeader('apikey', 'test-ocr-key')
            && $this->httpMultipartValue($request, 'OCREngine') === '2'
            && $this->httpMultipartValue($request, 'file') === '%PDF-compressed');

        $document = Document::query()->first();

        $this->assertNotNull($document);
        $this->assertDatabaseHas('ocr_results', [
            'document_id' => $document->id,
            'parsed_text' => 'Recognized text',
        ]);

        $result = OcrResult::query()->where('document_id', $document->id)->first();

        $this->assertNotNull($result);
        $this->assertSame(1, $result->payload['OCRExitCode']);

        $this->get(route('documents.ocr', $document))
            ->assertOk()
            ->assertHeader('content-type', 'application/json')
            ->assertHeader('content-disposition', 'inline; filename="report.ocr.json"')
            ->assertJsonPath('OCRExitCode', 1)
            ->assertJsonPath('ParsedResults.0.ParsedText', 'Recognized text');
    }

    public function test_ocr_is_skipped_when_compression_does_not_run(): void
    {
        Storage::fake('documents');
        $this->fakeOcrSpace();
        app(PdfCompressionSettings::class)->setQuality('original');

        $this->app->instance(PdfCompressor::class, new class implements PdfCompressor
        {
            public function supports(string $mimeType, string $filename): bool
            {
                return true;
            }

            public function compress(string $absolutePath): string
            {
                return '%PDF-compressed';
            }
        });

        $this->post(route('documents.store'), [
            'file' => UploadedFile::fake()->create('report.pdf', 120, 'application/pdf'),
        ], [
            'Accept' => 'application/json',
        ])
            ->assertCreated()
            ->assertJsonPath('compressed', false)
            ->assertJsonPath('ocr_url', null);

        Http::assertNothingSent();
        $this->assertDatabaseCount('ocr_results', 0);

        $this->get(route('documents.ocr', Document::query()->first()))
            ->assertNotFound();
    }

    private function compressorThatRecordsHttp(mixed &$httpDuringCompress): PdfCompressor
    {
        return new class($httpDuringCompress) implements PdfCompressor
        {
            public function __construct(private mixed &$httpDuringCompress) {}

            public function supports(string $mimeType, string $filename): bool
            {
                return true;
            }

            public function compress(string $absolutePath): string
            {
                $this->httpDuringCompress = Http::recorded()->all();

                return '%PDF-compressed';
            }
        };
    }
}
