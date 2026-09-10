<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\OcrResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_documents_can_be_searched_by_ocr_parsed_text(): void
    {
        $match = $this->documentWithOcr(
            ['title' => 'national-id.pdf', 'filepath' => 'national-id.pdf'],
            'Republic of the Philippines National ID Juan Dela Cruz',
        );
        $this->documentWithOcr(
            ['title' => 'bill.pdf', 'filepath' => 'bill.pdf'],
            'Utility bill for January 2026',
        );
        Document::query()->create($this->documentAttributes([
            'title' => 'notes.txt',
            'mime_type' => 'text/plain',
            'filepath' => 'notes.txt',
        ]));

        $response = $this->getJson(route('documents.index', ['q' => 'National ID']));

        $response->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $match->id)
            ->assertJsonPath('0.title', 'national-id.pdf');

        $this->assertNotNull($response->json('0.ocr_snippet'));
        $this->assertStringContainsStringIgnoringCase('National ID', (string) $response->json('0.ocr_snippet'));
    }

    public function test_empty_search_returns_all_documents(): void
    {
        $this->documentWithOcr(
            ['title' => 'national-id.pdf', 'filepath' => 'national-id.pdf'],
            'Republic of the Philippines National ID',
        );
        Document::query()->create($this->documentAttributes([
            'title' => 'notes.txt',
            'mime_type' => 'text/plain',
            'filepath' => 'notes.txt',
        ]));

        $this->getJson(route('documents.index', ['q' => '']))
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.ocr_snippet', null);
    }

    public function test_search_does_not_match_unrelated_ocr_text(): void
    {
        $this->documentWithOcr(
            ['title' => 'bill.pdf', 'filepath' => 'bill.pdf'],
            'Utility bill for January 2026',
        );

        $this->getJson(route('documents.index', ['q' => 'passport']))
            ->assertOk()
            ->assertJsonCount(0);
    }

    public function test_search_query_cannot_exceed_two_hundred_characters(): void
    {
        $this->getJson(route('documents.index', ['q' => str_repeat('a', 201)]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function documentWithOcr(array $overrides = [], string $parsedText = 'Recognized text'): Document
    {
        $document = Document::query()->create($this->documentAttributes($overrides));

        OcrResult::query()->create([
            'document_id' => $document->id,
            'payload' => ['OCRExitCode' => 1],
            'parsed_text' => $parsedText,
        ]);

        return $document;
    }
}
