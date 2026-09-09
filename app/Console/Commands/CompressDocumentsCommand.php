<?php

namespace App\Console\Commands;

use App\Models\Document;
use App\PdfCompression\StoredPdfCompressor;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

#[Signature('documents:compress')]
#[Description('Recompress stored PDF documents with Ghostscript.')]
class CompressDocumentsCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(StoredPdfCompressor $compressor): int
    {
        $documents = Document::query()->get();

        if ($documents->isEmpty()) {
            $this->info('No documents found.');

            return self::SUCCESS;
        }

        foreach ($documents as $document) {
            if (! Storage::disk('documents')->exists($document->path)) {
                $this->warn("Missing file: {$document->original_name}");

                continue;
            }

            $before = $document->size;
            $result = $compressor->compress(
                $document->path,
                (string) $document->mime_type,
                $document->original_name,
            );

            $document->update(['size' => $result['size']]);

            $this->line(sprintf(
                '%s: %d -> %d bytes%s',
                $document->original_name,
                $before,
                $result['size'],
                $result['compressed'] ? ' (compressed)' : ' (unchanged)',
            ));
        }

        return self::SUCCESS;
    }
}
