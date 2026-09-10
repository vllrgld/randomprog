<?php

namespace App\Ai;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OllamaClient
{
    public function documentContext(string $documentName, string $documentText, string $model): string
    {
        return $this->chat(
            $documentName,
            $documentText,
            'What is the context of this document? Explain what it is about and the key details in a short paragraph.',
            $model,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function extractIdMetadata(string $documentName, string $documentText, string $model): array
    {
        $content = $this->chat(
            $documentName,
            $documentText,
            'Extract the ID fields from the document. Reply with JSON only.',
            $model,
            $this->idExtractionPrompt($documentName, $documentText),
        );

        return $this->decodeJsonObject($content);
    }

    /**
     * Ask an Ollama Cloud model about a document using OCR text and form fields as context.
     */
    private function chat(string $documentName, string $documentText, string $message, string $model, ?string $systemPrompt = null): string
    {
        $apiKey = config('services.ollama.key');

        if (! filled($apiKey)) {
            throw new RuntimeException('Ollama API key is not configured.');
        }

        $response = Http::timeout((int) config('services.ollama.timeout', 180))
            ->asJson()
            ->withHeaders([
                'Authorization' => 'Bearer '.$apiKey,
            ])
            ->post((string) config('services.ollama.url'), [
                'model' => $model,
                'stream' => false,
                'think' => false,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => $systemPrompt ?? $this->systemPrompt($documentName, $documentText),
                    ],
                    [
                        'role' => 'user',
                        'content' => $message,
                    ],
                ],
            ]);

        if ($response->unauthorized()) {
            throw new RuntimeException('Ollama rejected the API key. Check OLLAMA_API_KEY.');
        }

        try {
            $response->throw();
        } catch (RequestException $exception) {
            $error = $response->json('error');

            throw new RuntimeException(
                is_string($error) && $error !== ''
                    ? "Ollama request failed: {$error}"
                    : 'Ollama request failed.',
                previous: $exception,
            );
        }

        $payload = $response->json();
        $content = is_array($payload) ? ($payload['message']['content'] ?? null) : null;

        if (! is_string($content) || trim($content) === '') {
            throw new RuntimeException('Ollama returned an empty reply.');
        }

        return $content;
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJsonObject(string $content): array
    {
        $trimmed = trim($content);

        if (preg_match('/```(?:json)?\s*(.*?)\s*```/s', $trimmed, $matches) === 1) {
            $trimmed = $matches[1];
        }

        $decoded = json_decode($trimmed, true);

        if (! is_array($decoded)) {
            throw new RuntimeException('Ollama did not return ID fields as JSON.');
        }

        return $decoded;
    }

    private function systemPrompt(string $documentName, string $documentText): string
    {
        return <<<PROMPT
You are helping the user understand a document. Use the PDF text, OCR text, and form fields below as context. PDF text is the document body. If the answer is not in the document, say so. Reply with a short paragraph.

Document name: {$documentName}

{$documentText}
PROMPT;
    }

    private function idExtractionPrompt(string $documentName, string $documentText): string
    {
        return <<<PROMPT
You extract identity fields from an ID document. Use the PDF text, OCR text, and form fields. Reply with a JSON object and no markdown. Use null when a field is missing.

Keys: first_name, middle_name, last_name, suffix, id_number, sex, civil_status, blood_type, birthday, place_of_birth, address, issued_on.
birthday and issued_on must be YYYY-MM-DD or null.

Document name: {$documentName}

{$documentText}
PROMPT;
    }
}
