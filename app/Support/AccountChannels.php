<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Broadcasting\PrivateChannel;

class AccountChannels
{
    public static function forUsers(array $ids): array
    {
        return User::query()->whereIn('id', $ids)->get(['id', 'auth_version'])
            ->map(fn (User $user) => new PrivateChannel("users.{$user->id}.{$user->auth_version}"))->all();
    }
}
