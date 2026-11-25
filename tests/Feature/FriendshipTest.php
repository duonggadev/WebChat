<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FriendshipTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_the_recipient_can_accept_and_both_users_see_one_friendship(): void
    {
        [$sender, $recipient, $outsider] = User::factory()->count(3)->create();
        $this->actingAs($sender)->postJson('/api/friendships', ['user_id' => $sender->id])->assertUnprocessable();
        $this->postJson('/api/friendships', ['user_id' => $recipient->id])->assertNoContent();
        $id = $this->getJson('/api/friendships')->assertJsonPath('0.status', 'pending')
            ->assertJsonPath('0.user_id', $recipient->id)->json('0.id');

        $this->patchJson("/api/friendships/$id", ['action' => 'accept'])->assertConflict();
        $this->actingAs($outsider)->getJson('/api/friendships')->assertExactJson([]);
        $this->patchJson("/api/friendships/$id", ['action' => 'accept'])->assertNotFound();

        $this->actingAs($recipient)->postJson('/api/friendships', ['user_id' => $sender->id])->assertNoContent();
        $this->assertDatabaseCount('friendships', 1);
        $this->getJson('/api/friendships')->assertJsonPath('0.requested_by', $sender->id);
        $this->patchJson("/api/friendships/$id", ['action' => 'accept'])->assertNoContent();
        $this->actingAs($sender)->getJson('/api/friendships')->assertJsonPath('0.status', 'accepted');
        $this->patchJson("/api/friendships/$id", ['action' => 'cancel'])->assertConflict();
        $this->patchJson("/api/friendships/$id", ['action' => 'remove'])->assertNoContent();
        $this->actingAs($recipient)->getJson('/api/friendships')->assertExactJson([]);
    }

    public function test_declining_and_cancelling_allow_a_new_request(): void
    {
        [$sender, $recipient] = User::factory()->count(2)->create();
        $this->actingAs($sender)->postJson('/api/friendships', ['user_id' => $recipient->id])->assertNoContent();
        $oldId = $this->getJson('/api/friendships')->json('0.id');

        $this->actingAs($recipient)->patchJson("/api/friendships/$oldId", ['action' => 'cancel'])->assertConflict();
        $this->patchJson("/api/friendships/$oldId", ['action' => 'decline'])->assertNoContent();
        $this->actingAs($sender)->postJson('/api/friendships', ['user_id' => $recipient->id])->assertNoContent();
        $newId = $this->getJson('/api/friendships')->json('0.id');

        $this->patchJson("/api/friendships/$oldId", ['action' => 'cancel'])->assertNotFound();
        $this->patchJson("/api/friendships/$newId", ['action' => 'cancel'])->assertNoContent();
        $this->assertDatabaseCount('friendships', 0);
    }
}
