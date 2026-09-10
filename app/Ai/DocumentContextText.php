<?php

namespace App\Ai;

class DocumentContextText
{
    public function forAi(string $ocrText, string $formText, string $pageText = ''): string
    {
        $parts = [];
        $page = trim($pageText);
        $ocr = trim($ocrText);
        $form = $this->withoutFormsAndChecklists($formText);

        if ($page !== '') {
            $parts[] = "PDF text:\n{$page}";
        } elseif ($ocr !== '') {
            $parts[] = "OCR text:\n{$ocr}";
        }

        if ($form !== '') {
            $parts[] = "Form fields:\n{$form}";
        }

        return implode("\n\n", $parts);
    }

    public function withoutFormsAndChecklists(string $text): string
    {
        $text = trim($text);

        if ($text === '') {
            return '';
        }

        $kept = [];

        foreach (preg_split('/\R/u', $text) ?: [] as $line) {
            if ($this->isTableOrChecklistLine($line)) {
                continue;
            }

            $kept[] = $line;
        }

        $cleaned = trim(preg_replace("/\n{3,}/", "\n\n", implode("\n", $kept)) ?? '');

        return $cleaned;
    }

    private function isTableOrChecklistLine(string $line): bool
    {
        $trimmed = trim($line);

        if ($trimmed === '') {
            return false;
        }

        if (str_contains($trimmed, ':') && $this->isTableOrChecklistFieldLabel($trimmed)) {
            return true;
        }

        $markCount = preg_match_all(
            '/[☐☑☒✓✔✗✘■□○●◻◼⬜⬛]|\[(?:\s|x|X|v|V|✓)?\]|\((?:\s|x|X)?\)/u',
            $trimmed,
        );

        if ($markCount >= 2) {
            return true;
        }

        if (substr_count($trimmed, '|') >= 2) {
            return true;
        }

        if (preg_match('/^[\+\|][-+=:\s|]+[\+\|]$/u', $trimmed) === 1) {
            return true;
        }

        $withoutStructure = trim((string) preg_replace(
            '/[☐☑☒✓✔✗✘■□○●◻◼⬜⬛\[\]\(\)|+\-_=:·•.\s]/u',
            '',
            $trimmed,
        ));

        return $markCount >= 1 && $withoutStructure === '';
    }

    private function isTableOrChecklistFieldLabel(string $line): bool
    {
        $label = $line;

        if (str_contains($line, ':')) {
            $label = trim(explode(':', $line, 2)[0]);
        }

        return preg_match(
            '/check\s*box|checkbox|chkbox|\bchk[\s._-]?\d|\bradiobutton|\bradiobtn|checklist|table\[\d+|row\[\d+|col\[\d+|cell\[\d+|row\s*\d+|col(?:umn)?\s*\d+|cell\s*\d+/i',
            $label,
        ) === 1;
    }
}
