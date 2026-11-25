<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ChatInteractionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_replies_and_search_are_limited_to_the_room(): void
    {
        [$author, $member, $outsider] = User::factory()->count(3)->create();
        $room = $this->actingAs($author)->postJson('/api/rooms', ['type' => 'direct', 'members' => [$member->id]])->json('room_id');
        $otherRoom = $this->postJson('/api/rooms', ['type' => 'direct', 'members' => [$outsider->id]])->json('room_id');
        $original = $this->postJson("/api/rooms/$room/messages", ['content' => 'Bản thử 100%'])->assertCreated()->json('id');
        $foreign = $this->postJson("/api/rooms/$otherRoom/messages", ['content' => 'Không thuộc phòng'])->assertCreated()->json('id');
        $this->postJson("/api/rooms/$room/messages", ['content' => 'Kiểm tra', 'reply_to_id' => $foreign])
            ->assertUnprocessable()->assertJsonValidationErrors('reply_to_id');

        $reply = $this->actingAs($member)->postJson("/api/rooms/$room/messages", ['content' => 'Đã đọc', 'reply_to_id' => $original])
            ->assertCreated()->assertJsonPath('reply.content', 'Bản thử 100%')->json('id');
        $this->getJson("/api/rooms/$room/search?q=%25")->assertOk()->assertJsonCount(1, 'messages')
            ->assertJsonPath('messages.0.id', $original);
        $this->actingAs($outsider)->getJson("/api/rooms/$room/search?q=100")->assertForbidden();

        $this->actingAs($author)->deleteJson("/api/rooms/$room/messages/$original")->assertOk();
        $this->getJson("/api/rooms/$room/messages")->assertOk()->assertJsonPath('messages.1.id', $reply)
            ->assertJsonPath('messages.1.reply.content', '');
        $this->getJson("/api/rooms/$room/search?q=100")->assertOk()->assertJsonCount(0, 'messages');
    }

    public function test_reaction_toggle_and_read_receipt_are_authorized_and_monotonic(): void
    {
        [$author, $member, $outsider] = User::factory()->count(3)->create();
        $room = $this->actingAs($author)->postJson('/api/rooms', ['type' => 'direct', 'members' => [$member->id]])->json('room_id');
        $first = $this->postJson("/api/rooms/$room/messages", ['content' => 'Tin đầu'])->assertCreated()->json('id');
        $last = $this->postJson("/api/rooms/$room/messages", ['content' => 'Tin cuối'])->assertCreated()->json('id');

        $this->actingAs($outsider)->patchJson("/api/rooms/$room/read", ['message_id' => $last])->assertForbidden();
        $this->postJson("/api/rooms/$room/messages/$last/reactions", ['emoji' => '👍'])->assertForbidden();
        $this->actingAs($member)->getJson('/api/rooms')->assertJsonPath('0.unread_count', 2);
        $this->postJson("/api/rooms/$room/messages/$last/reactions", ['emoji' => '👍'])->assertOk()
            ->assertJsonPath('reactions.0.user_ids.0', $member->id);
        $this->postJson("/api/rooms/$room/messages/$last/reactions", ['emoji' => '👍'])->assertOk()
            ->assertJsonCount(0, 'reactions');
        $this->patchJson("/api/rooms/$room/read", ['message_id' => $last])->assertOk()->assertJsonPath('last_read_message_id', $last);
        $this->patchJson("/api/rooms/$room/read", ['message_id' => $first])->assertOk()->assertJsonPath('last_read_message_id', $last);

        $this->getJson('/api/rooms')->assertJsonPath('0.unread_count', 0);
        $response = $this->actingAs($author)->getJson('/api/rooms')->assertOk();
        $memberPayload = collect($response->json('0.members'))->firstWhere('id', $member->id);
        $this->assertSame($last, $memberPayload['last_read_message_id']);
    }

    public function test_non_square_images_are_rejected(): void
    {
        [$author, $member] = User::factory()->count(2)->create();
        $room = $this->actingAs($author)->postJson('/api/rooms', ['type' => 'direct', 'members' => [$member->id]])->json('room_id');

        $this->post("/api/rooms/$room/messages", ['image' => UploadedFile::fake()->image('wide.png', 120, 80)], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('image');
    }
}
