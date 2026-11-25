<?php

use App\Models\User;
use App\Support\UserBlocks;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;

Broadcast::channel('users.{id}.{version}', fn (User $user, int $id, int $version) => $user->id === $id && (int) $user->auth_version === $version);

Broadcast::channel('room-presence.{room}.{version}', function (User $user, int $room, int $version) {
    $record = DB::table('rooms')->where('id', $room)->where('presence_version', $version)->first();
    if (! $record || ! DB::table('room_members')->where('room_id', $room)->where('user_id', $user->id)->exists()) {
        return false;
    }
    if ($record->type === 'direct') {
        $peer = DB::table('room_members')->where('room_id', $room)->where('user_id', '!=', $user->id)->value('user_id');
        if ($peer !== null && UserBlocks::between($user->id, (int) $peer)) {
            return false;
        }
    }

    return ['id' => $user->id];
});
