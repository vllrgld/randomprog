<?php

namespace Tests\Unit;

use App\Ocr\OcrSpaceClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class OcrSpaceClientTest extends TestCase
{
    public function test_client_sends_engine_two_and_the_compressed_file(): void
    {
        $this->fakeOcrSpace([
            'OCRExitCode' => 1,
            'ParsedResults' => [],
        ]);

        $path = sys_get_temp_dir().DIRECTORY_SEPARATOR.'ocr-client-test.pdf';
        file_put_contents($path, '%PDF-compressed');

        try {
            $payload = app(OcrSpaceClient::class)->parse($path, 'report.pdf', 'application/pdf');
        } finally {
            @unlink($path);
        }

        $this->assertSame(1, $payload['OCRExitCode']);

        Http::assertSent(function ($request): bool {
            return $request->url() === 'https://api.ocr.space/parse/image'
                && $request->hasHeader('apikey', 'test-ocr-key')
                && $this->httpMultipartValue($request, 'OCREngine') === '2'
                && $this->httpMultipartValue($request, 'filetype') === 'PDF'
                && $this->httpMultipartValue($request, 'file') === '%PDF-compressed';
        });
    }
}
