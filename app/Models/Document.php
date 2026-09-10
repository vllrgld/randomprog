<?php

namespace App\Models;

use App\Enums\DocType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;

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

    protected static function booted(): void
    {
        static::deleting(function (Document $document): void {
            $disk = Storage::disk('documents');

            if (filled($document->filepath) && $disk->exists($document->filepath)) {
                $disk->delete($document->filepath);
            }
        });
    }

    /**
     * @param  Builder<static>  $query
     */
    public function scopeSearchOcrText(Builder $query, string $term): void
    {
        $term = trim($term);

        if ($term === '') {
            return;
        }

        $query->whereHas('ocrResult', function (Builder $ocr) use ($term): void {
            $ocr->matchingParsedText($term);
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function toApiArray(string $search = ''): array
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
            'ai_url' => route('documents.ai', $this),
            'ocr_snippet' => $search !== ''
                ? $this->ocrResult?->snippet($search)
                : null,
        ];
    }
}
