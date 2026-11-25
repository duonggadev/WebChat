<?php

namespace App\Http\Controllers;

use App\Events\ChatUpdated;
use Closure;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class GroupController extends Controller
{
    public function rename(Request $request, int $room)
    {
        $name = $request->validate(['name' => ['required', 'string', 'max:100']])['name'];
        $actor = (int) $request->user()->id;

        return $this->changeGroup($room, $actor, function (object $group, Builder $members) use ($room, $actor, $name) {
            $this->requireOwner($group, $actor);
            DB::table('rooms')->where('id', $room)->update(['name' => $name]);
        });
    }

    public function removeMember(Request $request, int $room, int $user)
    {
        $actor = (int) $request->user()->id;

        return $this->changeGroup($room, $actor, function (object $group, Builder $members) use ($room, $actor, $user) {
            if ($actor !== $user) {
                $this->requireOwner($group, $actor);
            }

            if ((int) $group->created_by === $user) {
                abort_if((clone $members)->where('user_id', '<>', $user)->exists(), 409, 'Hãy chuyển quyền trưởng nhóm trước khi rời.');
                DB::table('rooms')->where('id', $room)->update(['created_by' => null]);
            }

            $removed = $members->where('user_id', $user)->delete();
            abort_unless($removed, 404, 'Không tìm thấy thành viên trong nhóm.');
            DB::table('rooms')->where('id', $room)->increment('presence_version');
        });
    }

    public function transfer(Request $request, int $room)
    {
        $actor = (int) $request->user()->id;
        $target = (int) $request->validate([
            'user_id' => ['required', 'integer', 'not_in:'.$actor],
        ])['user_id'];

        return $this->changeGroup($room, $actor, function (object $group, Builder $members) use ($room, $actor, $target) {
            $this->requireOwner($group, $actor);
            $updated = (clone $members)->where('user_id', $target)->update(['role' => 'owner']);
            abort_unless($updated, 422, 'Chọn một thành viên trong nhóm.');
            $members->where('user_id', $actor)->update(['role' => 'member']);
            DB::table('rooms')->where('id', $room)->update(['created_by' => $target]);
        });
    }

    private function changeGroup(int $room, int $actor, Closure $change)
    {
        $recipients = DB::transaction(function () use ($room, $actor, $change) {
            $group = DB::table('rooms')->where('id', $room)->lockForUpdate()->first();
            abort_unless($group !== null && $group->type === 'group', 404, 'Không tìm thấy nhóm.');
            $members = DB::table('room_members')->where('room_id', $room);
            $recipients = $members->pluck('user_id')->map(fn ($id) => (int) $id)->all();
            abort_unless(in_array($actor, $recipients, true), 403);
            $change($group, $members);

            return $recipients;
        }, 3);

        // Former members also need to invalidate their local room state.
        foreach (array_chunk($recipients, 100) as $channelIds) {
            try {
                event(new ChatUpdated($channelIds, $room, null));
            } catch (Throwable $error) {
                report($error);
            }
        }

        return response()->noContent();
    }

    private function requireOwner(object $group, int $actor): void
    {
        abort_unless((int) $group->created_by === $actor, 403, 'Thao tác này dành cho trưởng nhóm.');
    }
}
