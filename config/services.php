<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'ocrspace' => [
        'key' => env('OCR_SPACE_API_KEY'),
        'url' => env('OCR_SPACE_URL', 'https://api.ocr.space/parse/image'),
        'engine' => 2,
        'timeout' => env('OCR_SPACE_TIMEOUT', 120),
    ],

    'ollama' => [
        'key' => env('OLLAMA_API_KEY'),
        'url' => env('OLLAMA_URL', 'https://ollama.com/api/chat'),
        'model' => env('OLLAMA_MODEL', 'gemma4:31b'),
        'timeout' => env('OLLAMA_TIMEOUT', 180),
        'models' => array_values(array_filter(array_map(
            trim(...),
            explode(',', (string) env(
                'OLLAMA_MODELS',
                'gemma4:31b,gpt-oss:120b,gpt-oss:20b,nemotron-3-nano:30b,nemotron-3-super,nemotron-3-ultra',
            )),
        ))),
    ],

];
