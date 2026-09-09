<?php

namespace App\PdfCompression;

use Illuminate\Support\Facades\Cache;

class PdfCompressionSettings
{
    public const DEFAULT = 'ebook';

    public const CACHE_KEY = 'pdf.compression.pdf_settings';

    /**
     * @var list<'ebook'|'screen'>
     */
    public const PRESETS = ['ebook', 'screen'];

    /**
     * @var list<'original'|'ebook'|'screen'>
     */
    public const QUALITIES = ['original', 'ebook', 'screen'];

    /**
     * @return 'original'|'ebook'|'screen'
     */
    public function quality(): string
    {
        $value = Cache::get(self::CACHE_KEY, config('pdf.compression.drivers.ghostscript.pdf_settings', self::DEFAULT));

        return $this->normalize($value);
    }

    public function shouldCompress(): bool
    {
        return $this->quality() !== 'original';
    }

    /**
     * @param  'original'|'ebook'|'screen'  $quality
     */
    public function setQuality(string $quality): void
    {
        Cache::forever(self::CACHE_KEY, $this->normalize($quality));
    }

    /**
     * @return list<array{value: string, label: string, description: string}>
     */
    public function options(): array
    {
        return [
            [
                'value' => 'original',
                'label' => 'Original',
                'description' => 'Do not compress. Store the file as uploaded.',
            ],
            [
                'value' => 'ebook',
                'label' => 'Ebook',
                'description' => '150 dpi. Best balance of size and quality.',
            ],
            [
                'value' => 'screen',
                'label' => 'Screen',
                'description' => 'Smallest files. 72 dpi, similar to a fax.',
            ],
        ];
    }

    /**
     * @return 'original'|'ebook'|'screen'
     */
    private function normalize(mixed $value): string
    {
        return in_array($value, self::QUALITIES, true) ? $value : self::DEFAULT;
    }
}
