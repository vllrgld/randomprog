<?php

namespace Tests;

use App\Enums\DocType;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    /**
     * @param  array<string, mixed>  $payload
     */
    protected function fakeOcrSpace(array $payload = []): void
    {
        Http::fake([
            '*ocr.space*' => Http::response($payload !== [] ? $payload : [
                'OCRExitCode' => 1,
                'IsErroredOnProcessing' => false,
                'ParsedResults' => [
                    [
                        'FileParseExitCode' => 1,
                        'ParsedText' => 'Recognized text',
                    ],
                ],
            ]),
        ]);
    }

    protected function httpMultipartValue(mixed $request, string $name): ?string
    {
        $body = str_replace("\r\n", "\n", (string) $request->body());
        $quoted = preg_quote($name, '/');

        if (preg_match('/name="'.$quoted.'"(?:; filename="[^"]*")?\n(?:Content-Type: [^\n]+\n)?\n(.*?)(?:\n--|\z)/s', $body, $matches) !== 1) {
            return null;
        }

        return $matches[1];
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    protected function documentAttributes(array $overrides = []): array
    {
        return [
            'title' => 'report.pdf',
            'doc_type' => DocType::Unknown,
            'mime_type' => 'application/pdf',
            'filepath' => 'report.pdf',
            'file_size' => 12,
            ...$overrides,
        ];
    }
}
