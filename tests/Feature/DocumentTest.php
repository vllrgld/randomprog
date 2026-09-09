<?php

namespace Tests\Feature;

use App\Contracts\PdfCompressor;
use App\Models\Document;
use App\PdfCompression\PdfCompressionSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class DocumentTest extends TestCase
{
    use RefreshDatabase;

    public function test_documents_can_be_listed(): void
    {
        $document = Document::query()->create([
            'original_name' => 'notes.txt',
            'path' => 'notes.txt',
            'size' => 12,
            'mime_type' => 'text/plain',
        ]);

        $this->getJson(route('documents.index'))
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'notes.txt')
            ->assertJsonPath('0.mime_type', 'text/plain')
            ->assertJsonPath('0.url', route('documents.show', $document))
            ->assertJsonPath('0.download_url', route('documents.download', $document));
    }

    public function test_documents_are_stored_on_the_documents_disk(): void
    {
        Storage::fake('documents');

        $file = UploadedFile::fake()->create('report.pdf', 120, 'application/pdf');

        $response = $this->post(route('documents.store'), [
            'file' => $file,
        ], [
            'Accept' => 'application/json',
        ]);

        $response->assertCreated()
            ->assertJsonPath('name', 'report.pdf');

        $this->assertDatabaseHas('documents', [
            'original_name' => 'report.pdf',
        ]);

        $document = Document::query()->first();

        Storage::disk('documents')->assertExists($document->path);
    }

    public function test_pdf_uploads_are_compressed_before_they_are_stored(): void
    {
        Storage::fake('documents');

        $compressedPath = null;
        $filesDuringCompress = null;

        $this->app->instance(PdfCompressor::class, new class($compressedPath, $filesDuringCompress) implements PdfCompressor
        {
            public function __construct(
                private mixed &$compressedPath,
                private mixed &$filesDuringCompress,
            ) {}

            public function supports(string $mimeType, string $filename): bool
            {
                return true;
            }

            public function compress(string $absolutePath): string
            {
                $this->compressedPath = $absolutePath;
                $this->filesDuringCompress = Storage::disk('documents')->allFiles();

                return '%PDF-compressed';
            }
        });

        $file = UploadedFile::fake()->create('report.pdf', 120, 'application/pdf');

        $this->post(route('documents.store'), [
            'file' => $file,
        ], [
            'Accept' => 'application/json',
        ])
            ->assertCreated()
            ->assertJsonPath('name', 'report.pdf')
            ->assertJsonPath('compressed', true)
            ->assertJsonPath('size', strlen('%PDF-compressed'));

        $document = Document::query()->first();

        $this->assertNotNull($compressedPath);
        $this->assertFileExists($compressedPath);
        $this->assertSame([], $filesDuringCompress);
        $this->assertSame('%PDF-compressed', Storage::disk('documents')->get($document->path));
    }

    public function test_original_quality_stores_pdfs_without_compressing(): void
    {
        Storage::fake('documents');
        app(PdfCompressionSettings::class)->setQuality('original');

        $this->app->instance(PdfCompressor::class, new class implements PdfCompressor
        {
            public function supports(string $mimeType, string $filename): bool
            {
                return true;
            }

            public function compress(string $absolutePath): string
            {
                throw new RuntimeException('should not compress');
            }
        });

        $file = UploadedFile::fake()->create('report.pdf', 120, 'application/pdf');

        $this->post(route('documents.store'), [
            'file' => $file,
        ], [
            'Accept' => 'application/json',
        ])
            ->assertCreated()
            ->assertJsonPath('name', 'report.pdf')
            ->assertJsonPath('compressed', false);

        $document = Document::query()->first();

        Storage::disk('documents')->assertExists($document->path);
    }

    public function test_stored_documents_can_be_viewed_inline(): void
    {
        Storage::fake('documents');
        Storage::disk('documents')->put('report.pdf', '%PDF-bytes');

        $document = Document::query()->create([
            'original_name' => 'report.pdf',
            'path' => 'report.pdf',
            'size' => 10,
            'mime_type' => 'application/pdf',
        ]);

        $response = $this->get(route('documents.show', $document));

        $response->assertOk()
            ->assertHeader('content-type', 'application/pdf')
            ->assertStreamedContent('%PDF-bytes');

        $this->assertStringContainsString('inline', (string) $response->headers->get('content-disposition'));
        $this->assertStringContainsString('report.pdf', (string) $response->headers->get('content-disposition'));
    }

    public function test_stored_documents_can_be_downloaded(): void
    {
        Storage::fake('documents');
        Storage::disk('documents')->put('report.pdf', 'pdf-bytes');

        $document = Document::query()->create([
            'original_name' => 'report.pdf',
            'path' => 'report.pdf',
            'size' => 9,
            'mime_type' => 'application/pdf',
        ]);

        $this->get(route('documents.download', $document))
            ->assertOk()
            ->assertDownload('report.pdf');
    }
}
