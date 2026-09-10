<?php

namespace Tests\Feature;

use App\Enums\DocType;
use App\Models\Document;
use App\Models\OcrResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DocumentAiTest extends TestCase
{
    use RefreshDatabase;

    public function test_ai_uses_the_selected_free_cloud_model(): void
    {
        Http::fake([
            'https://ollama.com/api/chat' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'This is an invoice for 40 pesos.',
                ],
            ]),
        ]);

        $document = $this->documentWithOcr();

        $this->postJson(route('documents.ai', $document), [
            'model' => 'gpt-oss:20b',
        ])
            ->assertOk()
            ->assertJsonPath('context', 'This is an invoice for 40 pesos.');

        Http::assertSent(function ($request): bool {
            $data = $request->data();

            return $request->url() === 'https://ollama.com/api/chat'
                && $request->hasHeader('Authorization', 'Bearer test-ollama-key')
                && ($data['model'] ?? null) === 'gpt-oss:20b'
                && ($data['stream'] ?? null) === false
                && str_contains((string) ($data['messages'][0]['content'] ?? ''), 'Invoice total: 40 pesos.')
                && str_contains((string) ($data['messages'][1]['content'] ?? ''), 'context of this document');
        });
    }

    public function test_ai_rejects_models_that_are_not_in_the_free_list(): void
    {
        Http::fake();

        $this->postJson(route('documents.ai', $this->documentWithOcr()), [
            'model' => 'deepseek-v4-flash:cloud',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('model');

        Http::assertNothingSent();
    }

    public function test_ai_is_rejected_without_ocr_text(): void
    {
        Http::fake();

        $document = Document::query()->create($this->documentAttributes([
            'title' => 'invoice.pdf',
            'filepath' => 'invoice.pdf',
        ]));

        $this->postJson(route('documents.ai', $document), [
            'model' => 'gemma4:31b',
        ])->assertUnprocessable();

        Http::assertNothingSent();
    }

    public function test_ai_uses_fillable_form_fields_without_ocr_text(): void
    {
        Http::fake([
            'https://ollama.com/api/chat' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'This is a filled employment application for Juan Dela Cruz.',
                ],
            ]),
        ]);

        $document = Document::query()->create($this->documentAttributes([
            'title' => 'application.pdf',
            'filepath' => 'application.pdf',
        ]));

        $this->postJson(route('documents.ai', $document), [
            'model' => 'gpt-oss:20b',
            'form_text' => "Full Name: Juan Dela Cruz\nPosition: Clerk",
        ])
            ->assertOk()
            ->assertJsonPath('context', 'This is a filled employment application for Juan Dela Cruz.');

        Http::assertSent(function ($request): bool {
            $content = (string) ($request->data()['messages'][0]['content'] ?? '');

            return str_contains($content, 'Form fields:')
                && str_contains($content, 'Full Name: Juan Dela Cruz')
                && str_contains($content, 'Position: Clerk')
                && ! str_contains($content, 'OCR text:');
        });
    }

    public function test_ai_includes_form_fields_with_ocr_text(): void
    {
        Http::fake([
            'https://ollama.com/api/chat' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'This invoice is billed to Juan Dela Cruz.',
                ],
            ]),
        ]);

        $document = $this->documentWithOcr();

        $this->postJson(route('documents.ai', $document), [
            'model' => 'gpt-oss:20b',
            'form_text' => 'Customer: Juan Dela Cruz',
        ])->assertOk();

        Http::assertSent(function ($request): bool {
            $content = (string) ($request->data()['messages'][0]['content'] ?? '');

            return str_contains($content, 'Invoice total: 40 pesos.')
                && str_contains($content, 'Form fields:')
                && str_contains($content, 'Customer: Juan Dela Cruz');
        });
    }

    public function test_ai_uses_pdf_page_text_for_fillable_documents_without_ocr(): void
    {
        Http::fake([
            'https://ollama.com/api/chat' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'This is a Philippine identification card for Juan Dela Cruz.',
                ],
            ]),
        ]);

        $document = Document::query()->create($this->documentAttributes([
            'title' => 'national-id.pdf',
            'filepath' => 'national-id.pdf',
        ]));

        $this->postJson(route('documents.ai', $document), [
            'model' => 'gpt-oss:20b',
            'form_text' => 'LastName: Dela Cruz',
            'page_text' => "Republic of the Philippines\nPhilippine Identification Card\nLast Name DELA CRUZ\nGiven Name JUAN",
        ])
            ->assertOk()
            ->assertJsonPath('context', 'This is a Philippine identification card for Juan Dela Cruz.');

        Http::assertSent(function ($request): bool {
            $content = (string) ($request->data()['messages'][0]['content'] ?? '');

            return str_contains($content, 'PDF text:')
                && str_contains($content, 'Philippine Identification Card')
                && str_contains($content, 'Given Name JUAN')
                && str_contains($content, 'LastName: Dela Cruz');
        });
    }

    public function test_ai_keeps_ocr_and_omits_checklist_form_fields(): void
    {
        Http::fake([
            'https://ollama.com/api/chat' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'This is a patient intake for Juan Dela Cruz.',
                ],
            ]),
        ]);

        $document = Document::query()->create($this->documentAttributes([
            'title' => 'intake.pdf',
            'filepath' => 'intake.pdf',
        ]));

        OcrResult::query()->create([
            'document_id' => $document->id,
            'payload' => ['OCRExitCode' => 1],
            'parsed_text' => "Patient intake.\n| Symptom | Yes | No |\n[ ] Fever  [x] Cough",
        ]);

        $this->postJson(route('documents.ai', $document), [
            'model' => 'gpt-oss:20b',
            'form_text' => "Full Name: Juan Dela Cruz\nCheck Box 12: Yes",
        ])->assertOk();

        Http::assertSent(function ($request): bool {
            $content = (string) ($request->data()['messages'][0]['content'] ?? '');

            return str_contains($content, 'Patient intake.')
                && str_contains($content, '| Symptom | Yes | No |')
                && str_contains($content, '[ ] Fever  [x] Cough')
                && str_contains($content, 'Full Name: Juan Dela Cruz')
                && ! str_contains($content, 'Check Box 12');
        });
    }

    public function test_ai_extracts_and_saves_id_metadata_for_id_documents(): void
    {
        Http::fake(function ($request) {
            $message = $request->data()['messages'][1]['content'] ?? '';

            if (str_contains((string) $message, 'JSON')) {
                return Http::response([
                    'message' => [
                        'role' => 'assistant',
                        'content' => json_encode([
                            'first_name' => 'Juan',
                            'middle_name' => 'Santos',
                            'last_name' => 'Dela Cruz',
                            'suffix' => 'Jr',
                            'id_number' => '1234-5678-9012',
                            'sex' => 'male',
                            'civil_status' => 'single',
                            'blood_type' => 'O+',
                            'birthday' => '1992-03-15',
                            'place_of_birth' => 'Quezon City',
                            'address' => '123 Main St, Quezon City',
                            'issued_on' => '2024-01-10',
                        ]),
                    ],
                ]);
            }

            return Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'This is a Philippine national ID.',
                ],
            ]);
        });

        $document = $this->documentWithOcr([
            'title' => 'national-id.pdf',
            'doc_type' => DocType::Id,
            'filepath' => 'national-id.pdf',
        ]);

        $this->postJson(route('documents.ai', $document), [
            'model' => 'gpt-oss:20b',
        ])
            ->assertOk()
            ->assertJsonPath('context', 'This is a Philippine national ID.')
            ->assertJsonPath('id_metadata.first_name', 'Juan')
            ->assertJsonPath('id_metadata.last_name', 'Dela Cruz')
            ->assertJsonPath('id_metadata.id_number', '1234-5678-9012')
            ->assertJsonPath('id_metadata.birthday', '1992-03-15');

        $this->assertDatabaseHas('id_metadata', [
            'document_id' => $document->id,
            'first_name' => 'Juan',
            'id_number' => '1234-5678-9012',
            'place_of_birth' => 'Quezon City',
        ]);
    }

    public function test_ai_does_not_save_id_metadata_for_unknown_documents(): void
    {
        Http::fake([
            'https://ollama.com/api/chat' => Http::response([
                'message' => [
                    'role' => 'assistant',
                    'content' => 'This is an invoice for 40 pesos.',
                ],
            ]),
        ]);

        $document = $this->documentWithOcr();

        $this->postJson(route('documents.ai', $document), [
            'model' => 'gpt-oss:20b',
        ])
            ->assertOk()
            ->assertJsonPath('id_metadata', null);

        $this->assertDatabaseCount('id_metadata', 0);
        Http::assertSentCount(1);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function documentWithOcr(array $overrides = []): Document
    {
        $document = Document::query()->create($this->documentAttributes([
            'title' => 'invoice.pdf',
            'filepath' => 'invoice.pdf',
            ...$overrides,
        ]));

        OcrResult::query()->create([
            'document_id' => $document->id,
            'payload' => ['OCRExitCode' => 1],
            'parsed_text' => 'Invoice total: 40 pesos.',
        ]);

        return $document;
    }
}
