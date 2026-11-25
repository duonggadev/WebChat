<?php

namespace App\Http\Controllers;

use App\Events\BlocksChanged;
use App\Events\FriendshipsChanged;
use App\Support\UserBlocks;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class BlockController extends Controller
{
    public function index(Request $request)
    {
        return DB::table('user_blocks')
            ->join('users', 'users.id', '=', 'blocked_id')
            ->where('blocker_id', $request->user()->id)
            ->orderBy('users.display_name')->orderBy('users.id')
            ->get(['users.id', 'username', 'display_name']);
    }

    public function store(Request $request)
    {
        $actor = (int) $request->user()->id;
        $blocked = (int) $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id', 'not_in:'.$actor],
        ])['user_id'];

        [$created, $removedFriendship] = DB::transaction(function () use ($actor, $blocked) {
            UserBlocks::lockPair($actor, $blocked);
            $created = DB::table('user_blocks')->insertOrIgnore([
                'blocker_id' => $actor,
                'blocked_id' => $blocked,
            ]);

            $removedFriendship = DB::table('friendships')->where([
                'first_user_id' => min($actor, $blocked),
                'second_user_id' => max($actor, $blocked),
            ])->delete();

            return [$created, $removedFriendship];
        }, 3);

        if ($created) {
            $this->notify(new BlocksChanged($actor, $blocked));
        }
        if ($removedFriendship) {
            $this->notify(new FriendshipsChanged($actor, $blocked));
        }

        return response()->noContent();
    }

    public function destroy(Request $request, int $user)
    {
        $actor = (int) $request->user()->id;

        $removed = DB::transaction(function () use ($actor, $user) {
            UserBlocks::lockPair($actor, $user);

            return DB::table('user_blocks')->where(['blocker_id' => $actor, 'blocked_id' => $user])->delete();
        }, 3);
        if ($removed) {
            $this->notify(new BlocksChanged($actor, $user));
        }

        return response()->noContent();
    }

    private function notify(object $event): void
    {
        try {
            event($event);
        } catch (Throwable $error) {
            report($error);
        }
    }
}
