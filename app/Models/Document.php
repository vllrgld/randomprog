<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['original_name', 'path', 'size', 'mime_type'])]
class Document extends Model
{
    /**
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->original_name,
            'size' => $this->size,
            'mime_type' => $this->mime_type,
            'url' => route('documents.show', $this),
            'download_url' => route('documents.download', $this),
        ];
    }
}
