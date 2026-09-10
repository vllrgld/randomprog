<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->renameColumn('original_name', 'title');
            $table->renameColumn('mime_type', 'doc_type');
            $table->renameColumn('path', 'filepath');
            $table->renameColumn('size', 'file_size');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->renameColumn('title', 'original_name');
            $table->renameColumn('doc_type', 'mime_type');
            $table->renameColumn('filepath', 'path');
            $table->renameColumn('file_size', 'size');
        });
    }
};
