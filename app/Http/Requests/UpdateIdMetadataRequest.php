<?php

namespace App\Http\Requests;

use App\Ai\IdMetadataExtractor;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateIdMetadataRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    protected function prepareForValidation(): void
    {
        $this->merge(collect($this->only(IdMetadataExtractor::FIELDS))->map(function (mixed $value): mixed {
            if (! is_string($value)) {
                return $value;
            }

            $text = trim($value);

            return $text === '' ? null : $text;
        })->all());
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $string = ['nullable', 'string', 'max:255'];

        return [
            'first_name' => $string,
            'middle_name' => $string,
            'last_name' => $string,
            'suffix' => $string,
            'id_number' => $string,
            'sex' => $string,
            'civil_status' => $string,
            'blood_type' => $string,
            'birthday' => ['nullable', 'date_format:Y-m-d'],
            'place_of_birth' => $string,
            'address' => ['nullable', 'string'],
            'issued_on' => ['nullable', 'date_format:Y-m-d'],
        ];
    }
}
