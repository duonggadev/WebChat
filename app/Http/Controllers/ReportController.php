<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function store(Request $request, int $room, int $message)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:1000']]);
        abort_unless(DB::table('room_members')->where('room_id', $room)
            ->where('user_id', $request->user()->id)->exists(), 403);
        $target = DB::table('messages')->where('room_id', $room)->where('id', $message)->whereNull('deleted_at')->first();
        abort_unless($target !== null, 404);
        DB::table('message_reports')->insertOrIgnore([
            'reporter_id' => $request->user()->id, 'message_id' => $message,
            'reason' => $data['reason'], 'snapshot' => $target->content,
        ]);

        return response()->json(['message' => 'Đã gửi báo cáo. Quản trị viên sẽ xem xét.']);
    }
}
