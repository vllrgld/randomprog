<?php

namespace Tests\Unit;

use App\Ai\IdMetadataExtractor;
use App\Ai\OllamaClient;
use PHPUnit\Framework\TestCase;

class IdMetadataExtractorTest extends TestCase
{
    public function test_it_normalizes_extracted_id_fields(): void
    {
        $extractor = new IdMetadataExtractor($this->createMock(OllamaClient::class));

        $normalized = $extractor->normalize([
            'first_name' => ' Juan ',
            'birthday' => '1992-03-15',
            'issued_on' => 'not-a-date',
            'sex' => 'null',
            'unknown' => 'ignore',
        ]);

        $this->assertSame('Juan', $normalized['first_name']);
        $this->assertSame('1992-03-15', $normalized['birthday']);
        $this->assertNull($normalized['issued_on']);
        $this->assertNull($normalized['sex']);
        $this->assertArrayNotHasKey('unknown', $normalized);
        $this->assertArrayNotHasKey('age', $normalized);
        $this->assertNull($normalized['last_name']);
    }
}
