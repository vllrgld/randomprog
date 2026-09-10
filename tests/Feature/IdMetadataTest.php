<?php

namespace Tests\Feature;

use App\Enums\DocType;
use App\Models\Document;
use App\Models\IdMetadata;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class IdMetadataTest extends TestCase
{
    use RefreshDatabase;

    public function test_id_metadata_table_has_the_expected_columns(): void
    {
        $this->assertTrue(Schema::hasColumns('id_metadata', [
            'document_id',
            'first_name',
            'middle_name',
            'last_name',
            'suffix',
            'id_number',
            'sex',
            'civil_status',
            'blood_type',
            'birthday',
            'place_of_birth',
            'address',
            'issued_on',
        ]));
        $this->assertFalse(Schema::hasColumn('id_metadata', 'age'));
    }

    public function test_id_metadata_can_be_stored_for_a_document(): void
    {
        $document = Document::query()->create($this->documentAttributes([
            'title' => 'national-id.pdf',
            'doc_type' => DocType::Id,
            'filepath' => 'national-id.pdf',
            'file_size' => 24,
        ]));

        $metadata = $document->idMetadata()->create([
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
        ]);

        $this->assertDatabaseHas('id_metadata', [
            'document_id' => $document->id,
            'first_name' => 'Juan',
            'middle_name' => 'Santos',
            'last_name' => 'Dela Cruz',
            'suffix' => 'Jr',
            'id_number' => '1234-5678-9012',
            'sex' => 'male',
            'civil_status' => 'single',
            'blood_type' => 'O+',
            'place_of_birth' => 'Quezon City',
            'address' => '123 Main St, Quezon City',
        ]);

        $this->assertTrue($metadata->birthday->isSameDay('1992-03-15'));
        $this->assertTrue($metadata->issued_on->isSameDay('2024-01-10'));
        $this->assertTrue($document->idMetadata->is($metadata));
    }

    public function test_id_metadata_is_deleted_when_the_document_is_deleted(): void
    {
        $document = Document::query()->create($this->documentAttributes([
            'title' => 'national-id.pdf',
            'doc_type' => DocType::Id,
            'filepath' => 'national-id.pdf',
            'file_size' => 24,
        ]));

        $metadata = $document->idMetadata()->create([
            'first_name' => 'Juan',
            'id_number' => '1234-5678-9012',
        ]);

        $document->delete();

        $this->assertDatabaseMissing('id_metadata', [
            'id' => $metadata->id,
        ]);
    }

    public function test_a_document_can_have_only_one_id_metadata_record(): void
    {
        $document = Document::query()->create($this->documentAttributes([
            'title' => 'national-id.pdf',
            'doc_type' => DocType::Id,
            'filepath' => 'national-id.pdf',
            'file_size' => 24,
        ]));

        $document->idMetadata()->create([
            'first_name' => 'Juan',
        ]);

        $this->expectException(QueryException::class);

        IdMetadata::query()->create([
            'document_id' => $document->id,
            'first_name' => 'Maria',
        ]);
    }

    public function test_id_metadata_is_included_when_listing_documents(): void
    {
        $document = Document::query()->create($this->documentAttributes([
            'title' => 'national-id.pdf',
            'doc_type' => DocType::Id,
            'filepath' => 'national-id.pdf',
            'file_size' => 24,
        ]));

        $document->idMetadata()->create([
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'id_number' => '1234-5678-9012',
            'birthday' => '1992-03-15',
        ]);

        $this->getJson(route('documents.index'))
            ->assertOk()
            ->assertJsonPath('0.uses_id_metadata', true)
            ->assertJsonPath('0.id_metadata.first_name', 'Juan')
            ->assertJsonPath('0.id_metadata.last_name', 'Dela Cruz')
            ->assertJsonPath('0.id_metadata.id_number', '1234-5678-9012')
            ->assertJsonPath('0.id_metadata.birthday', '1992-03-15');
    }

    public function test_id_metadata_can_be_updated(): void
    {
        $document = Document::query()->create($this->documentAttributes([
            'title' => 'national-id.pdf',
            'doc_type' => DocType::Id,
            'filepath' => 'national-id.pdf',
            'file_size' => 24,
        ]));

        $document->idMetadata()->create([
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'id_number' => '1234-5678-9012',
        ]);

        $this->putJson(route('documents.id-metadata.update', $document), [
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'id_number' => '9876-5432-1098',
            'birthday' => '1990-05-20',
            'sex' => '',
        ])
            ->assertOk()
            ->assertJsonPath('id_metadata.first_name', 'Maria')
            ->assertJsonPath('id_metadata.last_name', 'Santos')
            ->assertJsonPath('id_metadata.id_number', '9876-5432-1098')
            ->assertJsonPath('id_metadata.birthday', '1990-05-20')
            ->assertJsonPath('id_metadata.sex', null);

        $this->assertDatabaseHas('id_metadata', [
            'document_id' => $document->id,
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'id_number' => '9876-5432-1098',
        ]);
    }

    public function test_id_metadata_cannot_be_updated_for_unknown_documents(): void
    {
        $document = Document::query()->create($this->documentAttributes([
            'title' => 'notes.pdf',
        ]));

        $this->putJson(route('documents.id-metadata.update', $document), [
            'first_name' => 'Maria',
        ])->assertUnprocessable();

        $this->assertDatabaseCount('id_metadata', 0);
    }
}
