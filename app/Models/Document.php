<?php

namespace App\Models;

use App\Enums\DocType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['title', 'doc_type', 'mime_type', 'filepath', 'file_size'])]
class Document extends Model
{
    /**
     * @return HasOne<OcrResult, $this>
     */
    public function ocrResult(): HasOne
    {
        return $this->hasOne(OcrResult::class);
    }

    /**
     * @return HasOne<IdMetadata, $this>
     */
    public function idMetadata(): HasOne
    {
        return $this->hasOne(IdMetadata::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'doc_type' => DocType::class,
            'file_size' => 'integer',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'name' => $this->title,
            'doc_type' => $this->doc_type->value,
            'doc_type_label' => $this->doc_type->label(),
            'mime_type' => $this->mime_type,
            'filepath' => $this->filepath,
            'file_size' => $this->file_size,
            'size' => $this->file_size,
            'uses_id_metadata' => $this->doc_type->usesIdMetadata(),
            'id_metadata' => $this->idMetadata?->toApiArray(),
            'url' => route('documents.show', $this),
            'download_url' => route('documents.download', $this),
            'ocr_url' => $this->ocrResult !== null
                ? route('documents.ocr', $this)
                : null,
            'ai_url' => $this->ocrResult !== null
                ? route('documents.ai', $this)
                : null,
        ];
    }
}
