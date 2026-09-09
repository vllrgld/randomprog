<?php

namespace App\PdfCompression;

use App\Contracts\PdfCompressor;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use RuntimeException;

class GhostscriptPdfCompressor implements PdfCompressor
{
    public function __construct(
        private ?string $binary = null,
        private ?string $pdfSettings = null,
    ) {}

    public function supports(string $mimeType, string $filename): bool
    {
        return str_ends_with(strtolower($filename), '.pdf')
            || str_contains(strtolower($mimeType), 'pdf');
    }

    public function compress(string $absolutePath): string
    {
        $binary = $this->resolveBinary();
        $workDir = $this->makeWorkDirectory();
        $inputPath = $workDir.DIRECTORY_SEPARATOR.'input.pdf';
        $outputPath = $workDir.DIRECTORY_SEPARATOR.'output.pdf';

        try {
            File::copy($absolutePath, $inputPath);

            $gsWorkDir = $this->ghostscriptPath($workDir);
            $result = Process::timeout(180)
                ->env([
                    'TEMP' => $gsWorkDir,
                    'TMP' => $gsWorkDir,
                    'TMPDIR' => $gsWorkDir,
                ])
                ->run([
                    $binary,
                    '-dNOSAFER',
                    '-dBATCH',
                    '-dNOPAUSE',
                    '-sDEVICE=pdfwrite',
                    '-dCompatibilityLevel=1.4',
                    '-dPDFSETTINGS=/'.$this->normalizedSettings(),
                    '-sOutputFile='.$this->ghostscriptPath($outputPath),
                    $this->ghostscriptPath($inputPath),
                ]);

            $details = trim($result->errorOutput()."\n".$result->output());

            if ($result->failed() || ! is_file($outputPath) || filesize($outputPath) === 0) {
                throw new RuntimeException($details !== '' ? $details : 'Ghostscript failed to compress the PDF.');
            }

            $compressed = File::get($outputPath);

            if (! str_starts_with($compressed, '%PDF')) {
                throw new RuntimeException('Ghostscript did not produce a valid PDF.');
            }

            $original = File::get($absolutePath);

            return $compressed !== '' ? $compressed : $original;
        } finally {
            File::deleteDirectory($workDir);
        }
    }

    private function makeWorkDirectory(): string
    {
        $directory = sys_get_temp_dir().DIRECTORY_SEPARATOR.'gs-pdf-'.bin2hex(random_bytes(8));

        File::ensureDirectoryExists($directory);

        return $directory;
    }

    private function ghostscriptPath(string $path): string
    {
        return str_replace('\\', '/', $path);
    }

    private function normalizedSettings(): string
    {
        $value = $this->pdfSettings ?? app(PdfCompressionSettings::class)->quality();

        return in_array($value, PdfCompressionSettings::PRESETS, true)
            ? $value
            : PdfCompressionSettings::DEFAULT;
    }

    private function resolveBinary(): string
    {
        $configured = is_string($this->binary) ? trim($this->binary, " \t\"'") : '';

        if ($configured !== '' && is_file($configured)) {
            return $configured;
        }

        foreach (['gswin64c', 'gswin32c', 'gs'] as $name) {
            $resolved = $this->findOnPath($name);

            if ($resolved !== null) {
                return $resolved;
            }
        }

        foreach (glob('C:\\Program Files\\gs\\*\\bin\\gswin64c.exe') ?: [] as $path) {
            return $path;
        }

        foreach (glob('C:\\Program Files (x86)\\gs\\*\\bin\\gswin32c.exe') ?: [] as $path) {
            return $path;
        }

        throw new RuntimeException('Ghostscript was not found. Install it or set GS_BINARY to the executable path.');
    }

    private function findOnPath(string $name): ?string
    {
        $command = PHP_OS_FAMILY === 'Windows' ? ['where', $name] : ['which', $name];
        $result = Process::run($command);

        if (! $result->successful()) {
            return null;
        }

        $line = strtok($result->output(), "\r\n");

        return is_string($line) && $line !== '' ? $line : null;
    }
}
