<?php

namespace Tests\Feature;

use App\Events\ChatUpdated;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AccountSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_password_change_requires_current_password_and_revokes_other_sessions(): void
    {
        $user = User::factory()->create(['password_hash' => Hash::make('old-password-123')]);
        $beforeChannel = (new ChatUpdated([$user->id], 1, null))->broadcastOn()[0]->name;
        $this->actingAs($user)->postJson('/api/password/change', [
            'current_password' => 'wrong',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertUnprocessable();

        $this->postJson('/api/password/change', [
            'current_password' => 'old-password-123',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk()->assertSessionHas('auth_version', 1);
        $this->assertTrue(Hash::check('new-password-123', $user->fresh()->password_hash));
        $afterChannel = (new ChatUpdated([$user->id], 1, null))->broadcastOn()[0]->name;
        $this->assertNotSame($beforeChannel, $afterChannel);
        $this->assertSame("private-users.{$user->id}.1", $afterChannel);
        $this->actingAs($user->fresh())->getJson('/api/rooms')->assertOk();
        $this->withSession(['auth_version' => 0])->getJson('/api/rooms')->assertUnauthorized();
    }

    public function test_recovery_is_generic_tokens_are_single_use_and_expire(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'owner@example.com']);
        $generic = $this->postJson('/api/password/forgot', ['email' => 'missing@example.com'])->assertOk()->json('message');
        $this->postJson('/api/password/forgot', ['email' => 'OWNER@example.com'])
            ->assertOk()->assertJsonPath('message', $generic);
        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function ($notice) use (&$token) {
            $token = $notice->token;

            return true;
        });
        $this->assertNotNull($token);
        $this->assertNotSame($token, DB::table('password_reset_tokens')->value('token'));
        $payload = ['email' => $user->email, 'token' => $token, 'password' => 'reset-password-123', 'password_confirmation' => 'reset-password-123'];
        $this->postJson('/api/password/reset', $payload)->assertOk();
        $this->postJson('/api/password/reset', $payload)->assertUnprocessable();
        $this->assertEquals(1, $user->fresh()->auth_version);
        $this->postJson('/api/login', ['identity' => $user->username, 'password' => 'reset-password-123'])
            ->assertOk()->assertSessionHas('auth_version', 1);
        $this->postJson('/api/logout')->assertOk();

        $this->postJson('/api/password/forgot', ['email' => $user->email])->assertOk();
        DB::table('password_reset_tokens')->update(['created_at' => now()->subMinutes(61)]);
        $notice = Notification::sent($user, ResetPassword::class)->last();
        $payload['token'] = $notice->token;
        $this->postJson('/api/password/reset', $payload)->assertUnprocessable();
    }
}
