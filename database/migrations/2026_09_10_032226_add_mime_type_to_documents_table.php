<?php

use App\Enums\DocType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('mime_type')->nullable();
            $table->index('doc_type');
        });

        DB::table('documents')->orderBy('id')->each(function (object $document): void {
            $value = (string) $document->doc_type;
            $isMime = str_contains($value, '/');

            DB::table('documents')->where('id', $document->id)->update([
                'mime_type' => $isMime ? $value : null,
                'doc_type' => $isMime || $value === ''
                    ? DocType::Unknown->value
                    : $value,
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('documents')->orderBy('id')->each(function (object $document): void {
            if (filled($document->mime_type)) {
                DB::table('documents')->where('id', $document->id)->update([
                    'doc_type' => $document->mime_type,
                ]);
            }
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex(['doc_type']);
            $table->dropColumn('mime_type');
        });
    }
};
