<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_and_login_use_the_stored_password_hash(): void
    {
        $this->postJson('/api/register', [
            'username' => 'Tester',
            'email' => 'Tester@example.com',
            'display_name' => 'Người thử',
            'password' => 'password-long',
        ])->assertCreated()->assertJsonPath('user.username', 'tester')
            ->assertJsonMissingPath('user.password_hash');
        $this->assertTrue(Hash::check('password-long', User::firstOrFail()->password_hash));
        $this->postJson('/api/logout')->assertOk()->assertJsonPath('user', null);
        $this->postJson('/api/login', ['identity' => 'tester', 'password' => 'sai-mat-khau'])
            ->assertUnprocessable();
        $this->postJson('/api/login', ['identity' => 'TESTER@example.com', 'password' => 'password-long'])
            ->assertOk()->assertJsonPath('user.display_name', 'Người thử');
    }

    public function test_direct_rooms_are_reused_and_outsiders_cannot_access_messages(): void
    {
        [$alice, $bob, $outsider] = User::factory()->count(3)->create();
        $id = $this->actingAs($alice)->postJson('/api/rooms', ['type' => 'direct', 'members' => [$bob->id]])
            ->assertOk()->json('room_id');
        $this->actingAs($bob)->postJson('/api/rooms', ['type' => 'direct', 'members' => [$alice->id]])
            ->assertOk()->assertJsonPath('room_id', $id);
        $this->assertDatabaseCount('rooms', 1);

        $this->postJson("/api/rooms/$id/messages", ['content' => 'Chào Alice'])->assertCreated();
        $this->actingAs($alice)->getJson('/api/rooms')->assertJsonPath('0.preview', 'Chào Alice');
        $this->postJson("/api/rooms/$id/members", ['user_id' => $outsider->id])->assertForbidden();
        $this->actingAs($outsider)->getJson('/api/rooms')->assertExactJson([]);
        $this->getJson("/api/rooms/$id/messages")->assertForbidden();
        $this->postJson("/api/rooms/$id/messages", ['content' => 'Blocked'])->assertForbidden();
    }

    public function test_group_owner_can_invite_and_history_uses_a_cursor(): void
    {
        [$owner, $member, $invitee] = User::factory()->count(3)->create();
        $id = $this->actingAs($owner)->postJson('/api/rooms', [
            'type' => 'group', 'name' => 'Nhóm đồ án', 'members' => [$member->id],
        ])->assertOk()->json('room_id');

        $this->actingAs($member)->postJson("/api/rooms/$id/members", ['user_id' => $invitee->id])->assertForbidden();
        $this->actingAs($owner);
        for ($repeat = 0; $repeat < 2; $repeat++) {
            $this->postJson("/api/rooms/$id/members", ['user_id' => $invitee->id])->assertNoContent();
        }
        $this->assertDatabaseCount('room_members', 3);

        DB::table('messages')->insert(array_map(fn ($number) => [
            'room_id' => $id, 'sender_id' => $owner->id, 'content' => (string) $number,
        ], range(1, 51)));
        $cursor = $this->actingAs($invitee)->getJson("/api/rooms/$id/messages")
            ->assertOk()->assertJsonCount(50, 'messages')->assertJsonPath('messages.0.content', '2')
            ->json('next_before');
        $this->getJson("/api/rooms/$id/messages?before=$cursor")->assertOk()
            ->assertJsonCount(1, 'messages')->assertJsonPath('messages.0.content', '1')
            ->assertJsonPath('next_before', null);
    }
}
