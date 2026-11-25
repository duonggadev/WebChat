<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('heyday:demo', function () {
    abort_unless(app()->isLocal(), 403, 'Demo accounts are available only in the local environment.');
    $this->call('db:seed', ['--class' => 'DemoSeeder']);
})->purpose('Create local HeyDay demo accounts and conversations');
