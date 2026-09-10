<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
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

    /**
     * @param  Builder<static>  $query
     */
    public function scopeMatchingParsedText(Builder $query, string $term): void
    {
        $term = trim($term);

        if ($term === '') {
            return;
        }

        if ($this->supportsFullText($query)) {
            $booleanQuery = $this->booleanQuery($term);

            if ($booleanQuery !== '') {
                $query->whereFullText('parsed_text', $booleanQuery, ['mode' => 'boolean']);

                return;
            }
        }

        $query->where('parsed_text', 'like', '%'.addcslashes($term, '%_\\').'%');
    }

    public function snippet(string $term, int $radius = 90): ?string
    {
        $text = trim(preg_replace('/\s+/u', ' ', (string) $this->parsed_text) ?? '');

        if ($text === '') {
            return null;
        }

        $haystack = mb_strtolower($text);
        $position = false;

        foreach ($this->searchTokens($term) as $token) {
            $position = mb_strpos($haystack, mb_strtolower($token));

            if ($position !== false) {
                break;
            }
        }

        if ($position === false) {
            return mb_strlen($text) > 160 ? mb_substr($text, 0, 157).'…' : $text;
        }

        $start = max(0, $position - $radius);
        $excerpt = mb_substr($text, $start, ($radius * 2) + mb_strlen($term));

        if ($start > 0) {
            $excerpt = '…'.$excerpt;
        }

        if (($start + mb_strlen($excerpt)) < mb_strlen($text)) {
            $excerpt .= '…';
        }

        return $excerpt;
    }

    /**
     * @param  Builder<static>  $query
     */
    private function supportsFullText(Builder $query): bool
    {
        return in_array($query->getConnection()->getDriverName(), ['mysql', 'mariadb'], true);
    }

    private function booleanQuery(string $term): string
    {
        $clauses = [];

        foreach ($this->searchTokens($term) as $word) {
            $clauses[] = '+'.$word.'*';
        }

        return implode(' ', $clauses);
    }

    /**
     * @return list<string>
     */
    private function searchTokens(string $term): array
    {
        preg_match_all('/[\p{L}\p{N}]+/u', $term, $matches);

        return array_values(array_filter(
            $matches[0],
            fn (string $word): bool => mb_strlen($word) >= 2,
        ));
    }
}
