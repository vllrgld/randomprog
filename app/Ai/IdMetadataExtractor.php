<?php

namespace App\Ai;

use App\Models\Document;
use App\Models\IdMetadata;

class IdMetadataExtractor
{
    /**
     * @var list<string>
     */
    public const FIELDS = [
        'first_name',
        'middle_name',
        'last_name',
        'suffix',
        'id_number',
        'sex',
        'civil_status',
        'blood_type',
        'birthday',
        'place_of_birth',
        'address',
        'issued_on',
    ];

    public function __construct(private OllamaClient $ollama) {}

    public function extractAndSave(Document $document, string $ocrText, string $model): IdMetadata
    {
        $metadata = $document->idMetadata()->updateOrCreate([], $this->normalize(
            $this->ollama->extractIdMetadata($document->title, $ocrText, $model),
        ));

        $document->setRelation('idMetadata', $metadata);

        return $metadata;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function normalize(array $payload): array
    {
        $normalized = [];

        foreach (self::FIELDS as $field) {
            $normalized[$field] = match ($field) {
                'birthday', 'issued_on' => $this->dateOrNull($payload[$field] ?? null),
                default => $this->stringOrNull($payload[$field] ?? null),
            };
        }

        return $normalized;
    }

    private function stringOrNull(mixed $value): ?string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }

        $text = trim((string) $value);

        return $text === '' || strcasecmp($text, 'null') === 0 ? null : $text;
    }

    private function dateOrNull(mixed $value): ?string
    {
        $text = $this->stringOrNull($value);

        if ($text === null || preg_match('/^\d{4}-\d{2}-\d{2}$/', $text) !== 1) {
            return null;
        }

        [$year, $month, $day] = array_map(intval(...), explode('-', $text));

        return checkdate($month, $day, $year) ? $text : null;
    }
}
