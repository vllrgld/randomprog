<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdatePdfCompressionSettingRequest;
use App\PdfCompression\PdfCompressionSettings;
use Illuminate\Http\JsonResponse;

class SettingController extends Controller
{
    public function show(PdfCompressionSettings $settings): JsonResponse
    {
        return response()->json($this->payload($settings));
    }

    public function update(UpdatePdfCompressionSettingRequest $request, PdfCompressionSettings $settings): JsonResponse
    {
        $settings->setQuality($request->validated('pdf_quality'));

        return response()->json($this->payload($settings));
    }

    /**
     * @return array{pdf_quality: string, pdf_qualities: list<array{value: string, label: string, description: string}>}
     */
    private function payload(PdfCompressionSettings $settings): array
    {
        return [
            'pdf_quality' => $settings->quality(),
            'pdf_qualities' => $settings->options(),
        ];
    }
}
