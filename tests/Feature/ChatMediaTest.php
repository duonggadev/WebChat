<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ChatMediaTest extends TestCase
{
    use RefreshDatabase;

    public function test_images_are_visible_only_to_members_and_are_removed_with_the_message(): void
    {
        Storage::fake('local');
        [$author, $member, $outsider] = User::factory()->count(3)->create();
        $this->actingAs($author);
        $room = $this->postJson('/api/rooms', ['type' => 'direct', 'members' => [$member->id]])->json('room_id');
        $response = $this->post("/api/rooms/$room/messages", [
            'image' => UploadedFile::fake()->image('sharing.png', 480, 480),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonMissingPath('image_path');
        $id = $response->json('id');
        $url = $response->json('image_url');
        $thumbnail = $response->json('thumbnail_url');

        $this->actingAs($outsider)->get($url)->assertForbidden();
        $this->get($thumbnail)->assertForbidden();
        $this->actingAs($member)->get($url)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
        $preview = $this->get($thumbnail)->assertOk()->streamedContent();
        $this->assertSame(320, getimagesizefromstring($preview)[0]);
        $this->patchJson("/api/rooms/$room/messages/$id", ['content' => 'Sửa hộ'])->assertForbidden();
        $this->deleteJson("/api/rooms/$room/messages/$id")->assertForbidden();

        $this->actingAs($author)->patchJson("/api/rooms/$room/messages/$id", ['content' => 'Chú thích'])
            ->assertOk()->assertJsonPath('content', 'Chú thích')->assertJsonPath('revision', 1);
        $this->deleteJson("/api/rooms/$room/messages/$id")->assertOk()
            ->assertJsonPath('image_url', null)->assertJsonPath('content', '')->assertJsonPath('revision', 2);
        $this->actingAs($member)->get($url)->assertNotFound();
        $this->get($thumbnail)->assertNotFound();
        $this->assertSame([], Storage::disk('local')->allFiles('chat'));
        $this->assertSame([], Storage::disk('local')->allFiles('chat-thumbnails'));
        $this->getJson("/api/rooms/$room/messages")->assertJsonPath('messages.0.revision', 2);
    }

    public function test_a_square_avatar_updates_the_profile_and_replaces_the_previous_file(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $this->actingAs($user)->post('/api/profile', [
            'display_name' => 'Ảnh không vuông',
            'avatar' => UploadedFile::fake()->image('wide.png', 80, 50),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('avatar');

        $update = fn ($name) => $this->post('/api/profile', [
            'display_name' => $name,
            'avatar' => UploadedFile::fake()->image('square.png', 100, 100),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonMissingPath('avatar_path');
        $before = $update('Tên trước')->json('avatar_url');
        $after = $update('Tên mới')->assertJsonPath('display_name', 'Tên mới')->json('avatar_url');
        $this->assertNotSame($before, $after);
        $this->assertCount(1, Storage::disk('local')->allFiles('avatars'));
        $this->get($after)->assertOk();
        $this->actingAs($user->fresh())->getJson('/api/session')->assertJsonPath('user.avatar_url', $after);
    }
}
