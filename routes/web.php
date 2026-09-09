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
Route::get('/documents/{document}/download', [DocumentController::class, 'download'])->name('documents.download');
Route::get('/settings', [SettingController::class, 'show'])->name('settings.show');
Route::put('/settings', [SettingController::class, 'update'])->name('settings.update');
