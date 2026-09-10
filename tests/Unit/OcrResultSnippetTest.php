<?php

namespace Tests\Unit;

use App\Models\OcrResult;
use Tests\TestCase;

class OcrResultSnippetTest extends TestCase
{
    public function test_snippet_extracts_text_around_the_match(): void
    {
        $padding = str_repeat('lorem ipsum dolor sit amet ', 8);
        $result = new OcrResult([
            'parsed_text' => $padding.'National ID Juan Dela Cruz '.$padding,
        ]);

        $snippet = $result->snippet('National ID');

        $this->assertNotNull($snippet);
        $this->assertStringContainsString('National ID', $snippet);
        $this->assertStringContainsString('…', $snippet);
    }

    public function test_snippet_returns_null_when_parsed_text_is_empty(): void
    {
        $result = new OcrResult([
            'parsed_text' => '   ',
        ]);

        $this->assertNull($result->snippet('Juan'));
    }
}
