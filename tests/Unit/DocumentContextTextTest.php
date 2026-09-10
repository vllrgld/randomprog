<?php

namespace Tests\Unit;

use App\Ai\DocumentContextText;
use PHPUnit\Framework\TestCase;

class DocumentContextTextTest extends TestCase
{
    public function test_it_keeps_narrative_text_and_fillable_values(): void
    {
        $text = (new DocumentContextText)->forAi(
            "Patient intake form.\nThe visit was completed on site.",
            "Full Name: Juan Dela Cruz\nPosition: Clerk",
        );

        $this->assertStringContainsString('Patient intake form.', $text);
        $this->assertStringContainsString('Full Name: Juan Dela Cruz', $text);
        $this->assertStringContainsString('Position: Clerk', $text);
    }

    public function test_it_prefers_pdf_text_over_ocr_for_fillable_documents(): void
    {
        $text = (new DocumentContextText)->forAi(
            'Raster OCR fragment.',
            "Full Name: Juan Dela Cruz\nCheck Box 1: Yes",
            "Republic of the Philippines\nPhilippine Identification Card\nLast Name DELA CRUZ",
        );

        $this->assertStringContainsString('Philippine Identification Card', $text);
        $this->assertStringContainsString('Last Name DELA CRUZ', $text);
        $this->assertStringContainsString('Full Name: Juan Dela Cruz', $text);
        $this->assertStringNotContainsString('Raster OCR fragment.', $text);
        $this->assertStringNotContainsString('Check Box 1', $text);
    }

    public function test_it_keeps_ocr_including_table_layout(): void
    {
        $text = (new DocumentContextText)->forAi(
            <<<'OCR'
Patient intake.
| Last Name | First Name |
| DELA CRUZ | JUAN |
Sex: ( ) Male ( ) Female
OCR,
            "Full Name: Juan Dela Cruz\nCheck Box 1: Yes\nRow1 Col2: x\nRadioButton3: Off",
        );

        $this->assertStringContainsString('Patient intake.', $text);
        $this->assertStringContainsString('DELA CRUZ', $text);
        $this->assertStringContainsString('JUAN', $text);
        $this->assertStringContainsString('Sex: ( ) Male ( ) Female', $text);
        $this->assertStringContainsString('Full Name: Juan Dela Cruz', $text);
        $this->assertStringNotContainsString('Check Box 1', $text);
        $this->assertStringNotContainsString('Row1 Col2', $text);
        $this->assertStringNotContainsString('RadioButton3', $text);
    }
}
