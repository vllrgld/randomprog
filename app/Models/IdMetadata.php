<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'document_id',
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
])]
class IdMetadata extends Model
{
    /**
     * @var string
     */
    protected $table = 'id_metadata';

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
            'birthday' => 'date',
            'issued_on' => 'date',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        return [
            'first_name' => $this->first_name,
            'middle_name' => $this->middle_name,
            'last_name' => $this->last_name,
            'suffix' => $this->suffix,
            'id_number' => $this->id_number,
            'sex' => $this->sex,
            'civil_status' => $this->civil_status,
            'blood_type' => $this->blood_type,
            'birthday' => $this->birthday?->toDateString(),
            'place_of_birth' => $this->place_of_birth,
            'address' => $this->address,
            'issued_on' => $this->issued_on?->toDateString(),
        ];
    }
}
