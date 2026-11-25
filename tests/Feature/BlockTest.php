<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\UserBlocks;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BlockTest extends TestCase
{
    use RefreshDatabase;

    public function test_block_removes_friendship_and_only_its_sender_can_remove_it(): void
    {
        [$actor, $peer, $third] = User::factory()->count(3)->create();
        $this->postJson('/api/blocks', ['user_id' => $peer->id])->assertUnauthorized();
        $this->actingAs($actor)->postJson('/api/blocks', ['user_id' => $actor->id])->assertUnprocessable();
        $this->postJson('/api/friendships', ['user_id' => $peer->id])->assertNoContent();

        $this->postJson('/api/blocks', ['user_id' => $peer->id])->assertNoContent();
        $this->postJson('/api/blocks', ['user_id' => $peer->id])->assertNoContent();
        $this->assertDatabaseCount('user_blocks', 1);
        $this->assertDatabaseCount('friendships', 0);
        $this->getJson('/api/blocks')->assertJsonPath('0.id', $peer->id)->assertJsonCount(1);
        $this->postJson('/api/friendships', ['user_id' => $peer->id])->assertForbidden();
        $this->assertFalse(UserBlocks::hideFrom(DB::table('users'), $actor->id)->where('id', $peer->id)->exists());
        $this->assertFalse(UserBlocks::hideFrom(DB::table('users'), $peer->id)->where('id', $actor->id)->exists());
        $this->assertTrue(UserBlocks::hideFrom(DB::table('users'), $actor->id)->where('id', $third->id)->exists());

        $this->actingAs($peer)->getJson('/api/blocks')->assertExactJson([]);
        $this->postJson('/api/friendships', ['user_id' => $actor->id])->assertForbidden();
        $this->deleteJson("/api/blocks/{$actor->id}")->assertNoContent();
        $this->assertTrue(UserBlocks::between($peer->id, $actor->id));

        $this->actingAs($actor)->deleteJson("/api/blocks/{$peer->id}")->assertNoContent();
        $this->assertFalse(UserBlocks::between($actor->id, $peer->id));
        $this->actingAs($peer)->postJson('/api/friendships', ['user_id' => $actor->id])->assertNoContent();
    }
}
