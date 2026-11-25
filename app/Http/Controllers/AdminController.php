<?php

namespace App\Http\Controllers;

use App\Events\ChatUpdated;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class AdminController extends Controller
{
    public function overview()
    {
        return [
            'users' => DB::table('users')->count(),
            'suspended' => DB::table('users')->whereNotNull('suspended_at')->count(),
            'rooms' => DB::table('rooms')->count(),
            'messages' => DB::table('messages')->whereNull('deleted_at')->count(),
            'open_reports' => DB::table('message_reports')->where('status', 'open')->count(),
        ];
    }

    public function users(Request $request)
    {
        $data = $request->validate(['q' => ['nullable', 'string', 'max:100']]);
        $q = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($data['q'] ?? ''));

        return DB::table('users')->select('id', 'username', 'display_name', 'email', 'role', 'suspended_at', 'created_at')
            ->where(fn ($query) => $query->whereRaw("lower(username) LIKE ? ESCAPE '!'", ["%$q%"])
                ->orWhereRaw("lower(display_name) LIKE ? ESCAPE '!'", ["%$q%"]))
            ->orderByDesc('id')->paginate(20);
    }

    public function userAction(Request $request, int $user)
    {
        $data = $request->validate([
            'action' => ['required', 'in:suspend,restore,make_admin,make_user'],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);
        DB::transaction(function () use ($request, $user, $data) {
            DB::table('users')->where('role', 'admin')->orderBy('id')->lockForUpdate()->get(['id']);
            $actor = DB::table('users')->where('id', $request->user()->id)->first();
            abort_unless($actor && $actor->role === 'admin' && $actor->suspended_at === null, 403);
            $target = DB::table('users')->where('id', $user)->lockForUpdate()->first();
            abort_unless($target, 404);
            abort_if($user === $actor->id, 422, 'Hãy nhờ quản trị viên khác thay đổi quyền hoặc trạng thái tài khoản của bạn.');
            $changes = match ($data['action']) {
                'suspend' => ['suspended_at' => now()],
                'restore' => ['suspended_at' => null],
                'make_admin' => ['role' => 'admin'],
                'make_user' => ['role' => 'user'],
            };
            $changes['auth_version'] = $target->auth_version + 1;
            DB::table('users')->where('id', $user)->update($changes);
            $rooms = DB::table('room_members')->where('user_id', $user)->pluck('room_id');
            DB::table('rooms')->whereIn('id', $rooms)->increment('presence_version');
            $this->audit($actor->id, $data['action'], 'user', $user, ['reason' => $data['reason']]);
        }, 3);

        return response()->noContent();
    }

    public function reports()
    {
        return DB::table('message_reports as reports')
            ->join('users as reporter', 'reporter.id', '=', 'reports.reporter_id')
            ->join('messages', 'messages.id', '=', 'reports.message_id')
            ->join('users as sender', 'sender.id', '=', 'messages.sender_id')
            ->select('reports.*', 'reporter.display_name as reporter_name', 'sender.display_name as sender_name',
                'messages.room_id', 'messages.deleted_at', 'messages.image_path')
            ->orderByRaw("case when reports.status = 'open' then 0 else 1 end")
            ->orderByDesc('reports.id')->paginate(20)
            ->through(function ($report) {
                $report->image_url = $report->image_path !== null && $report->deleted_at === null
                    ? "/api/admin/reports/{$report->id}/image" : null;
                unset($report->image_path);

                return $report;
            });
    }

    public function reportImage(int $report)
    {
        $path = DB::table('message_reports')->join('messages', 'messages.id', '=', 'message_reports.message_id')
            ->where('message_reports.id', $report)->whereNull('messages.deleted_at')->value('image_path');
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, null, ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function resolve(Request $request, int $report)
    {
        $data = $request->validate([
            'action' => ['required', 'in:dismiss,remove'],
            'resolution' => ['required', 'string', 'min:5', 'max:1000'],
        ]);
        $changed = DB::transaction(function () use ($request, $report, $data) {
            $actor = DB::table('users')->where('id', $request->user()->id)->lockForUpdate()->first();
            abort_unless($actor && $actor->role === 'admin' && $actor->suspended_at === null, 403);
            $record = DB::table('message_reports')->where('id', $report)->lockForUpdate()->first();
            abort_unless($record, 404);
            abort_unless($record->status === 'open', 409, 'Báo cáo đã được xử lý.');
            $message = DB::table('messages')->where('id', $record->message_id)->lockForUpdate()->first();
            $media = [];
            if ($data['action'] === 'remove' && $message->deleted_at === null) {
                $media = array_filter([$message->image_path, $message->thumbnail_path]);
                DB::table('messages')->where('id', $message->id)->update([
                    'content' => '', 'image_path' => null, 'thumbnail_path' => null,
                    'deleted_at' => now(), 'revision' => $message->revision + 1,
                ]);
            }
            DB::table('message_reports')->where('id', $report)->update([
                'status' => $data['action'] === 'remove' ? 'removed' : 'dismissed',
                'resolution' => $data['resolution'], 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(),
            ]);
            $this->audit($request->user()->id, 'report_'.$data['action'], 'report', $report, ['resolution' => $data['resolution']]);

            return [$message->room_id, $media];
        }, 3);
        [$room, $media] = $changed;
        if ($media) {
            Storage::disk('local')->delete($media);
        }
        $ids = DB::table('room_members')->where('room_id', $room)->pluck('user_id')->all();
        foreach (array_chunk($ids, 100) as $recipients) {
            try {
                event(new ChatUpdated($recipients, $room, null));
            } catch (Throwable $error) {
                report($error);
            }
        }

        return response()->noContent();
    }

    public function auditLogs()
    {
        return DB::table('admin_audit_logs')->join('users', 'users.id', '=', 'actor_id')
            ->select('admin_audit_logs.*', 'users.username as actor_username')
            ->orderByDesc('admin_audit_logs.id')->paginate(30);
    }

    private function audit(int $actor, string $action, string $type, int $id, array $details): void
    {
        DB::table('admin_audit_logs')->insert([
            'actor_id' => $actor, 'action' => $action, 'entity_type' => $type,
            'entity_id' => $id, 'details' => json_encode($details, JSON_THROW_ON_ERROR),
        ]);
    }
}
