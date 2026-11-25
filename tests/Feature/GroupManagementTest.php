<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class GroupManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_group_owner_can_rename_remove_members_and_transfer_ownership(): void
    {
        [$owner, $successor, $removed, $outsider] = User::factory()->count(4)->create();
        $room = $this->group($owner, $successor, $removed);

        $this->actingAs($outsider)->patchJson("/api/rooms/$room", ['name' => 'Lén đổi tên'])->assertForbidden();
        $this->actingAs($successor)->patchJson("/api/rooms/$room", ['name' => 'Thử đổi tên'])->assertForbidden();
        $this->deleteJson("/api/rooms/$room/members/{$owner->id}")->assertForbidden();

        $this->actingAs($owner)->patchJson("/api/rooms/$room", ['name' => 'Tên mới'])->assertNoContent();
        $this->assertDatabaseHas('rooms', ['id' => $room, 'name' => 'Tên mới']);
        $this->patchJson("/api/rooms/$room/owner", ['user_id' => $outsider->id])->assertUnprocessable();
        $this->deleteJson("/api/rooms/$room/members/{$removed->id}")->assertNoContent();
        $this->assertDatabaseHas('rooms', ['id' => $room, 'presence_version' => 1]);
        $this->actingAs($removed)->getJson("/api/rooms/$room/messages")->assertForbidden();

        $this->actingAs($owner)->deleteJson("/api/rooms/$room/members/{$owner->id}")->assertConflict();
        $this->patchJson("/api/rooms/$room/owner", ['user_id' => $successor->id])->assertNoContent();
        $this->assertDatabaseHas('rooms', ['id' => $room, 'created_by' => $successor->id]);
        $this->assertDatabaseHas('room_members', ['room_id' => $room, 'user_id' => $owner->id, 'role' => 'member']);
        $this->assertDatabaseHas('room_members', ['room_id' => $room, 'user_id' => $successor->id, 'role' => 'owner']);
        $this->patchJson("/api/rooms/$room", ['name' => 'Trưởng nhóm cũ'])->assertForbidden();
        $this->deleteJson("/api/rooms/$room/members/{$owner->id}")->assertNoContent();
        $this->assertDatabaseMissing('room_members', ['room_id' => $room, 'user_id' => $owner->id]);

        $this->actingAs($successor)->deleteJson("/api/rooms/$room/members/{$successor->id}")->assertNoContent();
        $this->assertDatabaseHas('rooms', ['id' => $room, 'created_by' => null, 'presence_version' => 3]);
        $this->assertDatabaseMissing('room_members', ['room_id' => $room]);
    }

    private function group(User $owner, User ...$members): int
    {
        $room = DB::table('rooms')->insertGetId(['name' => 'Nhóm', 'type' => 'group', 'created_by' => $owner->id]);
        DB::table('room_members')->insert(['room_id' => $room, 'user_id' => $owner->id, 'role' => 'owner']);
        DB::table('room_members')->insert(array_map(fn (User $member) => [
            'room_id' => $room,
            'user_id' => $member->id,
            'role' => 'member',
        ], $members));

        return $room;
    }
}
