<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\BlockController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\FriendshipController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\PasswordController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReportController;
use App\Http\Middleware\RequireAdmin;
use Illuminate\Support\Facades\Route;

Route::pattern('room', '[0-9]+');
Route::pattern('message', '[0-9]+');
Route::view('/', 'chat')->name('login');

Route::prefix('api')->group(function () {
    Route::get('/session', [AccountController::class, 'profile']);
    Route::post('/password/forgot', [PasswordController::class, 'forgot'])->middleware('throttle:password-forgot');
    Route::post('/password/reset', [PasswordController::class, 'reset'])->middleware('throttle:password-reset');
    Route::middleware(['guest', 'throttle:10,1'])->group(function () {
        Route::post('/register', [AccountController::class, 'register']);
        Route::post('/login', [AccountController::class, 'login']);
    });

    Route::middleware(['auth', 'throttle:180,1'])->group(function () {
        Route::post('/logout', [AccountController::class, 'logout']);
        Route::post('/heartbeat', [AccountController::class, 'heartbeat']);
        Route::get('/users', [ChatController::class, 'users']);
        Route::get('/users/{user}/avatar', [ProfileController::class, 'avatar'])->whereNumber('user');
        Route::post('/profile', [ProfileController::class, 'update']);
        Route::post('/password/change', [PasswordController::class, 'change'])->middleware('throttle:password-change');
        Route::get('/blocks', [BlockController::class, 'index']);
        Route::post('/blocks', [BlockController::class, 'store']);
        Route::delete('/blocks/{user}', [BlockController::class, 'destroy'])->whereNumber('user');
        Route::get('/friendships', [FriendshipController::class, 'index']);
        Route::post('/friendships', [FriendshipController::class, 'store'])->middleware('throttle:20,1');
        Route::patch('/friendships/{friendship}', [FriendshipController::class, 'update'])->whereNumber('friendship');
        Route::get('/rooms', [ChatController::class, 'rooms']);
        Route::post('/rooms', [ChatController::class, 'create']);
        Route::patch('/rooms/{room}', [GroupController::class, 'rename']);
        Route::patch('/rooms/{room}/owner', [GroupController::class, 'transfer']);
        Route::delete('/rooms/{room}/members/{user}', [GroupController::class, 'removeMember'])->whereNumber('user');
        Route::patch('/rooms/{room}/read', [ChatController::class, 'read']);
        Route::get('/rooms/{room}/search', [ChatController::class, 'search']);
        Route::get('/rooms/{room}/messages', [ChatController::class, 'messages']);
        Route::post('/rooms/{room}/messages', [ChatController::class, 'send'])->middleware('throttle:chat-send');
        Route::post('/rooms/{room}/messages/{message}/reactions', [ChatController::class, 'react']);
        Route::post('/rooms/{room}/messages/{message}/report', [ReportController::class, 'store'])->middleware('throttle:reports');
        Route::patch('/rooms/{room}/messages/{message}', [ChatController::class, 'edit']);
        Route::delete('/rooms/{room}/messages/{message}', [ChatController::class, 'remove']);
        Route::get('/rooms/{room}/messages/{message}/image', [ChatController::class, 'image']);
        Route::get('/rooms/{room}/messages/{message}/thumbnail', [ChatController::class, 'thumbnail']);
        Route::post('/rooms/{room}/members', [ChatController::class, 'invite']);

        Route::prefix('admin')->middleware(RequireAdmin::class)->group(function () {
            Route::get('/overview', [AdminController::class, 'overview']);
            Route::get('/users', [AdminController::class, 'users']);
            Route::post('/users/{user}', [AdminController::class, 'userAction'])->whereNumber('user');
            Route::get('/reports', [AdminController::class, 'reports']);
            Route::get('/reports/{report}/image', [AdminController::class, 'reportImage'])->whereNumber('report');
            Route::post('/reports/{report}', [AdminController::class, 'resolve'])->whereNumber('report');
            Route::get('/audit', [AdminController::class, 'auditLogs']);
        });
    });
});
