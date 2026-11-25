<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->isLocal() || User::query()->exists()) {
            return;
        }

        DB::transaction(function () {
            $users = collect(['duong' => 'Thái Dương', 'linh' => 'Phương Linh', 'minh' => 'Hoàng Minh', 'an' => 'Hải An'])
                ->map(fn ($name, $username) => User::create([
                    'username' => $username,
                    'email' => "$username@heyday.test",
                    'display_name' => $name,
                    'password_hash' => Hash::make('HeyDay-demo-local'),
                ]));

            $rooms = [
                ['Đồ án Web Chat', ['duong', 'linh', 'minh'], [
                    ['linh', 'Mọi người ơi, tối nay mình chốt phần demo nhé?'],
                    ['minh', 'Được nha. Mình đã chuẩn bị kịch bản mở hai cửa sổ để thử realtime.'],
                    ['duong', 'Ok, mình sẽ trình bày sơ đồ 4 bảng trước, rồi chuyển qua demo chat nhóm.'],
                    ['linh', 'Hay đó. Nhớ thử thêm một thành viên ngay trong lúc demo nữa nhé.'],
                    ['duong', 'Mình sẽ thêm An vào lúc trình bày.'],
                    ['minh', 'Vậy mình hẹn nhau 8 giờ tối để chạy thử một lượt nha.'],
                ], 30],
                [null, ['duong', 'linh'], [
                    ['linh', 'Dương ơi, mai bạn mang laptop đi học nhé.'],
                    ['duong', 'Ừ, mình mang. Gặp nhau ở thư viện nha!'],
                ], 105],
                ['Cuối tuần đi đâu?', ['duong', 'linh', 'an'], [
                    ['an', 'Sáng Chủ nhật mọi người có muốn đi cà phê không?'],
                    ['linh', 'Mình rảnh buổi sáng nè. Chọn quán ở gần trường được không?'],
                ], 190],
                [null, ['duong', 'minh'], [
                    ['minh', 'Mình xem qua migration rồi, phần khóa ngoại chạy ổn nha.'],
                    ['duong', 'Cảm ơn Minh, mình cập nhật README tối nay.'],
                ], 290],
                [null, ['duong', 'an'], [
                    ['an', 'Mình gửi slide qua nhóm lớp rồi nhé.'],
                ], 1500],
            ];

            foreach ($rooms as [$name, $members, $messages, $minutesAgo]) {
                $start = now()->subMinutes($minutesAgo);
                $roomId = DB::table('rooms')->insertGetId([
                    'name' => $name,
                    'type' => $name === null ? 'direct' : 'group',
                    'created_by' => $users[$members[0]]->id,
                    'created_at' => $start,
                ]);
                DB::table('room_members')->insert(array_map(fn ($member) => [
                    'room_id' => $roomId, 'user_id' => $users[$member]->id, 'joined_at' => $start,
                    'role' => $name !== null && $member === $members[0] ? 'owner' : 'member',
                ], $members));
                foreach ($messages as $index => [$sender, $content]) {
                    DB::table('messages')->insert([
                        'room_id' => $roomId, 'sender_id' => $users[$sender]->id, 'content' => $content,
                        'created_at' => $start->copy()->addMinutes($index * 2),
                    ]);
                }
            }
        });
    }
}
