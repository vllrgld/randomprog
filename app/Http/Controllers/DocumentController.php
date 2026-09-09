<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDocumentRequest;
use App\Models\Document;
use App\PdfCompression\StoredPdfCompressor;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function index(): JsonResponse
    {
        $documents = Document::query()
            ->latest()
            ->get()
            ->map(fn (Document $document): array => $document->toApiArray())
            ->values();

        return response()->json($documents);
    }

    public function store(StoreDocumentRequest $request, StoredPdfCompressor $compression): JsonResponse
    {
        $stored = $compression->storeUploaded($request->file('file'));

        $document = Document::query()->create([
            'original_name' => $stored['original_name'],
            'path' => $stored['path'],
            'size' => $stored['size'],
            'mime_type' => $stored['mime_type'],
        ]);

        return response()->json([
            ...$document->toApiArray(),
            'compressed' => $stored['compressed'],
            'original_size' => $stored['original_size'],
        ], 201);
    }

    public function show(Document $document): StreamedResponse
    {
        abort_unless(Storage::disk('documents')->exists($document->path), 404);

        $headers = [];

        if (filled($document->mime_type)) {
            $headers['Content-Type'] = $document->mime_type;
        }

        return Storage::disk('documents')->response(
            $document->path,
            $document->original_name,
            $headers,
        );
    }

    public function download(Document $document): StreamedResponse
    {
        abort_unless(Storage::disk('documents')->exists($document->path), 404);

        return Storage::disk('documents')->download(
            $document->path,
            $document->original_name,
        );
    }
}
