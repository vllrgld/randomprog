<?php

use App\Http\Controllers\DocumentController;
use App\Http\Controllers\SettingController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/documents', [DocumentController::class, 'index'])->name('documents.index');
Route::post('/documents', [DocumentController::class, 'store'])->name('documents.store');
Route::get('/documents/{document}', [DocumentController::class, 'show'])->name('documents.show');
Route::delete('/documents/{document}', [DocumentController::class, 'destroy'])->name('documents.destroy');
Route::post('/documents/{document}/file', [DocumentController::class, 'updateFile'])->name('documents.file.update');
Route::get('/documents/{document}/download', [DocumentController::class, 'download'])->name('documents.download');
Route::get('/documents/{document}/ocr', [DocumentController::class, 'ocr'])->name('documents.ocr');
Route::post('/documents/{document}/ai', [DocumentController::class, 'ai'])->name('documents.ai');
Route::put('/documents/{document}/id-metadata', [DocumentController::class, 'updateIdMetadata'])->name('documents.id-metadata.update');
Route::get('/settings', [SettingController::class, 'show'])->name('settings.show');
Route::put('/settings', [SettingController::class, 'update'])->name('settings.update');
