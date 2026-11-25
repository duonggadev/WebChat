<?php

namespace App\Http\Controllers;

use App\Events\FriendshipsChanged;
use App\Support\UserBlocks;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class FriendshipController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user()->id;

        return $this->forUser($user)
            ->join('users', 'users.id', '=', DB::raw('case when first_user_id = '.(int) $user.' then second_user_id else first_user_id end'))
            ->orderBy('users.display_name')
            ->get(['friendships.id', 'status', 'requested_by', 'users.id as user_id', 'username', 'display_name']);
    }

    public function store(Request $request)
    {
        $user = $request->user()->id;
        $other = (int) $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id', 'not_in:'.$user],
        ])['user_id'];
        $first = min($user, $other);
        $second = max($user, $other);

        $created = DB::transaction(function () use ($user, $other, $first, $second) {
            UserBlocks::lockPair($first, $second);
            abort_if(UserBlocks::between($user, $other), 403, 'Không thể gửi lời mời kết bạn cho tài khoản này.');

            return DB::table('friendships')->insertOrIgnore([
                'first_user_id' => $first,
                'second_user_id' => $second,
                'requested_by' => $user,
            ]);
        }, 3);
        if ($created) {
            $this->notify($first, $second);
        }

        return response()->noContent();
    }

    public function update(Request $request, int $friendship)
    {
        $action = $request->validate(['action' => ['required', 'in:accept,decline,cancel,remove']])['action'];
        $user = $request->user()->id;

        $pair = DB::transaction(function () use ($user, $friendship, $action) {
            $record = $this->forUser($user)->where('id', $friendship)->lockForUpdate()->first();
            abort_if($record === null, 404, 'Lời mời hoặc kết bạn không còn tồn tại.');
            $sender = (int) $record->requested_by === $user;
            $allowed = match ($action) {
                'accept', 'decline' => $record->status === 'pending' && ! $sender,
                'cancel' => $record->status === 'pending' && $sender,
                'remove' => $record->status === 'accepted',
            };
            abort_unless($allowed, 409, 'Trạng thái kết bạn đã thay đổi hoặc bạn không có quyền thực hiện thao tác này.');

            $query = DB::table('friendships')->where('id', $record->id);
            if ($action === 'accept') {
                $query->update(['status' => 'accepted']);
            } else {
                $query->delete();
            }

            return [(int) $record->first_user_id, (int) $record->second_user_id];
        }, 3);
        $this->notify(...$pair);

        return response()->noContent();
    }

    private function forUser(int $user): Builder
    {
        return DB::table('friendships')->where(fn ($query) => $query
            ->where('first_user_id', $user)->orWhere('second_user_id', $user));
    }

    private function notify(int $first, int $second): void
    {
        try {
            event(new FriendshipsChanged($first, $second));
        } catch (Throwable $error) {
            report($error);
        }
    }
}
