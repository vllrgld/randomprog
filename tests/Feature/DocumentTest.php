<?php

namespace Tests\Feature;

use App\Contracts\PdfCompressor;
use App\Enums\DocType;
use App\Models\Document;
use App\PdfCompression\PdfCompressionSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class DocumentTest extends TestCase
{
    use RefreshDatabase;

    public function test_documents_table_has_title_doc_type_filepath_and_file_size(): void
    {
        $this->assertTrue(Schema::hasColumns('documents', [
            'title',
            'doc_type',
            'mime_type',
            'filepath',
            'file_size',
        ]));
        $this->assertFalse(Schema::hasColumn('documents', 'original_name'));
        $this->assertFalse(Schema::hasColumn('documents', 'path'));
        $this->assertFalse(Schema::hasColumn('documents', 'size'));
    }

    public function test_documents_can_be_listed(): void
    {
        $document = Document::query()->create($this->documentAttributes([
            'title' => 'notes.txt',
            'mime_type' => 'text/plain',
            'filepath' => 'notes.txt',
        ]));

        $this->getJson(route('documents.index'))
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.title', 'notes.txt')
            ->assertJsonPath('0.doc_type', 'unknown')
            ->assertJsonPath('0.doc_type_label', 'Unknown')
            ->assertJsonPath('0.filepath', 'notes.txt')
            ->assertJsonPath('0.file_size', 12)
            ->assertJsonPath('0.name', 'notes.txt')
            ->assertJsonPath('0.mime_type', 'text/plain')
            ->assertJsonPath('0.uses_id_metadata', false)
            ->assertJsonPath('0.id_metadata', null)
            ->assertJsonPath('0.url', route('documents.show', $document))
            ->assertJsonPath('0.download_url', route('documents.download', $document))
            ->assertJsonPath('0.ocr_url', null)
            ->assertJsonPath('0.ai_url', route('documents.ai', $document));
    }

    public function test_documents_are_stored_on_the_documents_disk(): void
    {
        Storage::fake('documents');
        $this->fakeOcrSpace();

        $file = UploadedFile::fake()->create('report.pdf', 120, 'application/pdf');

        $response = $this->post(route('documents.store'), [
            'file' => $file,
        ], [
            'Accept' => 'application/json',
        ]);

        $response->assertCreated()
            ->assertJsonPath('name', 'report.pdf');

        $this->assertDatabaseHas('documents', [
            'title' => 'report.pdf',
            'doc_type' => 'unknown',
            'mime_type' => 'application/pdf',
        ]);

        $document = Document::query()->first();

        Storage::disk('documents')->assertExists($document->filepath);
    }

    public function test_pdf_uploads_are_compressed_before_they_are_stored(): void
    {
        Storage::fake('documents');
        $this->fakeOcrSpace();

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
            ->assertJsonPath('file_size', strlen('%PDF-compressed'));

        $document = Document::query()->first();

        $this->assertNotNull($compressedPath);
        $this->assertFileExists($compressedPath);
        $this->assertSame([], $filesDuringCompress);
        $this->assertSame('%PDF-compressed', Storage::disk('documents')->get($document->filepath));
    }

    public function test_original_quality_stores_pdfs_without_compressing(): void
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

        Storage::disk('documents')->assertExists($document->filepath);
    }

    public function test_stored_documents_can_be_viewed_inline(): void
    {
        Storage::fake('documents');
        Storage::disk('documents')->put('report.pdf', '%PDF-bytes');

        $document = Document::query()->create($this->documentAttributes([
            'file_size' => 10,
        ]));

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

        $document = Document::query()->create($this->documentAttributes([
            'file_size' => 9,
        ]));

        $this->get(route('documents.download', $document))
            ->assertOk()
            ->assertDownload('report.pdf');
    }

    public function test_uploads_default_to_the_unknown_doc_type(): void
    {
        Storage::fake('documents');
        $this->fakeOcrSpace();

        $this->post(route('documents.store'), [
            'file' => UploadedFile::fake()->create('report.pdf', 120, 'application/pdf'),
        ], [
            'Accept' => 'application/json',
        ])
            ->assertCreated()
            ->assertJsonPath('doc_type', 'unknown')
            ->assertJsonPath('uses_id_metadata', false);

        $this->assertDatabaseHas('documents', [
            'title' => 'report.pdf',
            'doc_type' => 'unknown',
            'mime_type' => 'application/pdf',
        ]);
    }

    public function test_id_uploads_are_marked_for_id_metadata(): void
    {
        Storage::fake('documents');
        $this->fakeOcrSpace();

        $this->post(route('documents.store'), [
            'file' => UploadedFile::fake()->create('national-id.pdf', 120, 'application/pdf'),
            'doc_type' => 'id',
        ], [
            'Accept' => 'application/json',
        ])
            ->assertCreated()
            ->assertJsonPath('doc_type', 'id')
            ->assertJsonPath('doc_type_label', 'ID')
            ->assertJsonPath('uses_id_metadata', true);

        $this->assertDatabaseHas('documents', [
            'title' => 'national-id.pdf',
            'doc_type' => 'id',
            'mime_type' => 'application/pdf',
        ]);
    }

    public function test_invalid_doc_types_are_rejected(): void
    {
        Storage::fake('documents');

        $this->postJson(route('documents.store'), [
            'file' => UploadedFile::fake()->create('report.pdf', 120, 'application/pdf'),
            'doc_type' => 'invoice',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('doc_type');
    }

    public function test_a_document_can_be_deleted_with_its_file_and_related_data(): void
    {
        Storage::fake('documents');
        Storage::disk('documents')->put('national-id.pdf', '%PDF-bytes');
        Storage::disk('documents')->put('keep.pdf', '%PDF-keep');

        $document = Document::query()->create($this->documentAttributes([
            'title' => 'national-id.pdf',
            'doc_type' => DocType::Id,
            'filepath' => 'national-id.pdf',
            'file_size' => 11,
        ]));
        $kept = Document::query()->create($this->documentAttributes([
            'title' => 'keep.pdf',
            'filepath' => 'keep.pdf',
            'file_size' => 9,
        ]));

        $ocr = $document->ocrResult()->create([
            'payload' => ['OCRExitCode' => 1],
            'parsed_text' => 'Republic of the Philippines National ID',
        ]);
        $metadata = $document->idMetadata()->create([
            'first_name' => 'Juan',
            'id_number' => '1234-5678-9012',
        ]);

        $this->deleteJson(route('documents.destroy', $document))
            ->assertNoContent();

        $this->assertDatabaseMissing('documents', ['id' => $document->id]);
        $this->assertDatabaseMissing('ocr_results', ['id' => $ocr->id]);
        $this->assertDatabaseMissing('id_metadata', ['id' => $metadata->id]);
        $this->assertDatabaseHas('documents', ['id' => $kept->id]);
        Storage::disk('documents')->assertMissing('national-id.pdf');
        Storage::disk('documents')->assertExists('keep.pdf');
    }

    public function test_deleting_a_document_still_works_when_the_file_is_already_gone(): void
    {
        Storage::fake('documents');

        $document = Document::query()->create($this->documentAttributes());

        $this->deleteJson(route('documents.destroy', $document))
            ->assertNoContent();

        $this->assertDatabaseMissing('documents', ['id' => $document->id]);
    }

    public function test_the_stored_pdf_file_can_be_replaced(): void
    {
        Storage::fake('documents');
        Storage::disk('documents')->put('report.pdf', '%PDF-old');

        $document = Document::query()->create($this->documentAttributes([
            'file_size' => 8,
        ]));

        $this->post(route('documents.file.update', $document), [
            'file' => UploadedFile::fake()->create('filled.pdf', 24, 'application/pdf'),
        ], [
            'Accept' => 'application/json',
        ])
            ->assertOk()
            ->assertJsonPath('id', $document->id)
            ->assertJsonPath('title', 'report.pdf');

        $document->refresh();

        $this->assertSame('report.pdf', $document->filepath);
        $this->assertSame($document->file_size, Storage::disk('documents')->size('report.pdf'));
        $this->assertNotSame('%PDF-old', Storage::disk('documents')->get('report.pdf'));
    }
}
