<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['document_id', 'payload', 'parsed_text'])]
class OcrResult extends Model
{
    /**
     * @return BelongsTo<Document, $this>
     */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }

    public function filename(): string
    {
        $base = pathinfo((string) $this->document?->title, PATHINFO_FILENAME);

        return ($base !== '' ? $base : 'document').'.ocr.json';
    }
}
