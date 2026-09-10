<?php

namespace App\Enums;

enum DocType: string
{
    case Unknown = 'unknown';
    case Id = 'id';

    public function label(): string
    {
        return match ($this) {
            self::Unknown => 'Unknown',
            self::Id => 'ID',
        };
    }

    public function usesIdMetadata(): bool
    {
        return $this === self::Id;
    }
}
