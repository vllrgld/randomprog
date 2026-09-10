<?php

namespace App\Ocr;

use App\Contracts\OcrClient;
use App\Models\Document;
use App\Models\OcrResult;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class DocumentOcr
{
    public function __construct(private OcrClient $client) {}

    /**
     * OCR the stored (already compressed) document and persist the JSON for later context.
     */
    public function process(Document $document): OcrResult
    {
        $disk = Storage::disk('documents');

        if (! $disk->exists($document->filepath)) {
            throw new RuntimeException('The stored document is missing.');
        }

        $payload = $this->client->parse(
            $disk->path($document->filepath),
            $document->title,
            (string) $document->mime_type,
        );

        $result = $document->ocrResult()->updateOrCreate([], [
            'payload' => $payload,
            'parsed_text' => $this->parsedText($payload),
        ]);

        $document->setRelation('ocrResult', $result);

        return $result;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function parsedText(array $payload): string
    {
        $pages = $payload['ParsedResults'] ?? [];

        if (! is_array($pages)) {
            return '';
        }

        $text = [];

        foreach ($pages as $page) {
            if (is_array($page) && filled($page['ParsedText'] ?? null)) {
                $text[] = (string) $page['ParsedText'];
            }
        }

        return implode("\n\n", $text);
    }
}
