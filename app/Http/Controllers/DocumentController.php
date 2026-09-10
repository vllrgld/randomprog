<?php

namespace App\Http\Controllers;

use App\Ai\IdMetadataExtractor;
use App\Ai\OllamaClient;
use App\Enums\DocType;
use App\Http\Requests\AskDocumentAiRequest;
use App\Http\Requests\ListDocumentsRequest;
use App\Http\Requests\StoreDocumentRequest;
use App\Http\Requests\UpdateIdMetadataRequest;
use App\Models\Document;
use App\Ocr\DocumentOcr;
use App\PdfCompression\StoredPdfCompressor;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function index(ListDocumentsRequest $request): JsonResponse
    {
        $search = $request->search();

        $documents = Document::query()
            ->with(['ocrResult', 'idMetadata'])
            ->when($search !== '', fn ($query) => $query->searchOcrText($search))
            ->latest()
            ->get()
            ->map(fn (Document $document): array => $document->toApiArray($search))
            ->values();

        return response()->json($documents);
    }

    public function store(StoreDocumentRequest $request, StoredPdfCompressor $compression, DocumentOcr $ocr): JsonResponse
    {
        $stored = $compression->storeUploaded($request->file('file'));

        $document = Document::query()->create([
            'title' => $stored['original_name'],
            'doc_type' => $request->enum('doc_type', DocType::class) ?? DocType::Unknown,
            'mime_type' => $stored['mime_type'],
            'filepath' => $stored['path'],
            'file_size' => $stored['size'],
        ]);

        if ($stored['compression_ran']) {
            $ocr->process($document);
        }

        return response()->json([
            ...$document->toApiArray(),
            'compressed' => $stored['compressed'],
            'original_size' => $stored['original_size'],
        ], 201);
    }

    public function show(Document $document): StreamedResponse
    {
        abort_unless(Storage::disk('documents')->exists($document->filepath), 404);

        $headers = [];

        if (filled($document->mime_type)) {
            $headers['Content-Type'] = $document->mime_type;
        }

        return Storage::disk('documents')->response(
            $document->filepath,
            $document->title,
            $headers,
        );
    }

    public function download(Document $document): StreamedResponse
    {
        abort_unless(Storage::disk('documents')->exists($document->filepath), 404);

        return Storage::disk('documents')->download(
            $document->filepath,
            $document->title,
        );
    }

    public function ocr(Document $document): JsonResponse
    {
        $result = $document->ocrResult;

        abort_unless($result !== null, 404);

        $result->setRelation('document', $document);

        return response()->json($result->payload)->withHeaders([
            'Content-Disposition' => 'inline; filename="'.$result->filename().'"',
        ]);
    }

    public function ai(AskDocumentAiRequest $request, Document $document, OllamaClient $ollama, IdMetadataExtractor $extractor): JsonResponse
    {
        $result = $document->ocrResult;

        abort_unless($result !== null && filled($result->parsed_text), 422, 'OCR text is not available yet.');

        $ocrText = (string) $result->parsed_text;
        $model = $request->validated('model');

        $context = $ollama->documentContext(
            $document->title,
            $ocrText,
            $model,
        );

        $idMetadata = null;

        if ($document->doc_type->usesIdMetadata()) {
            $idMetadata = $extractor->extractAndSave($document, $ocrText, $model)->toApiArray();
        }

        return response()->json([
            'context' => $context,
            'id_metadata' => $idMetadata,
        ]);
    }

    public function updateIdMetadata(UpdateIdMetadataRequest $request, Document $document): JsonResponse
    {
        abort_unless($document->doc_type->usesIdMetadata(), 422, 'This document type has no ID info.');

        $metadata = $document->idMetadata()->updateOrCreate([], $request->validated());
        $document->setRelation('idMetadata', $metadata);

        return response()->json($document->toApiArray());
    }
}
