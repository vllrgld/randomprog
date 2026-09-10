<?php

namespace Tests\Unit;

use App\Enums\DocType;
use PHPUnit\Framework\TestCase;

class DocTypeTest extends TestCase
{
    public function test_id_is_the_only_type_that_uses_id_metadata(): void
    {
        $this->assertTrue(DocType::Id->usesIdMetadata());
        $this->assertFalse(DocType::Unknown->usesIdMetadata());
    }
}
