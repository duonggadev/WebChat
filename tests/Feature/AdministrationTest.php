<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AdministrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_admin_can_manage_accounts_and_cannot_lock_self(): void
    {
        $admin = User::factory()->create();
        $user = User::factory()->create();
        DB::table('users')->where('id', $admin->id)->update(['role' => 'admin']);
        $this->actingAs($user)->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs($admin->fresh())->getJson('/api/admin/overview')->assertOk()->assertJsonPath('users', 2);
        $this->postJson("/api/admin/users/$admin->id", ['action' => 'suspend', 'reason' => 'Tự khóa tài khoản'])->assertUnprocessable();
        $this->postJson("/api/admin/users/$user->id", ['action' => 'suspend', 'reason' => 'Vi phạm nội quy'])->assertNoContent();
        $this->assertDatabaseHas('admin_audit_logs', ['actor_id' => $admin->id, 'action' => 'suspend', 'entity_id' => $user->id]);
        $this->actingAs($user->fresh())->getJson('/api/rooms')->assertUnauthorized();

        $this->actingAs($admin->fresh())->postJson("/api/admin/users/$user->id", ['action' => 'restore', 'reason' => 'Đã xác minh lại'])->assertNoContent();
        $this->assertNull($user->fresh()->suspended_at);
    }

    public function test_report_permissions_duplicate_handling_and_moderation_audit(): void
    {
        [$sender, $member, $outsider, $admin] = User::factory()->count(4)->create();
        DB::table('users')->where('id', $admin->id)->update(['role' => 'admin']);
        $room = $this->actingAs($sender)->postJson('/api/rooms', ['type' => 'direct', 'members' => [$member->id]])->json('room_id');
        $id = $this->postJson("/api/rooms/$room/messages", ['content' => 'Nội dung cần xem xét'])->assertCreated()->json('id');
        $url = "/api/rooms/$room/messages/$id/report";
        $this->actingAs($outsider)->postJson($url, ['reason' => 'Nội dung vi phạm'])->assertForbidden();
        $this->actingAs($member)->postJson($url, ['reason' => 'Nội dung vi phạm'])->assertOk();
        $this->postJson($url, ['reason' => 'Báo cáo lặp'])->assertOk();
        $this->assertDatabaseCount('message_reports', 1);
        $report = DB::table('message_reports')->value('id');
        $this->postJson("/api/admin/reports/$report", ['action' => 'remove', 'resolution' => 'Đã xem xét vi phạm'])->assertForbidden();
        $this->actingAs($admin->fresh())->postJson("/api/admin/reports/$report", ['action' => 'remove', 'resolution' => 'Đã xem xét vi phạm'])->assertNoContent();
        $this->assertDatabaseHas('messages', ['id' => $id, 'content' => '', 'revision' => 1]);
        $this->assertDatabaseHas('message_reports', ['id' => $report, 'status' => 'removed']);
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'report_remove', 'actor_id' => $admin->id]);
        $this->postJson("/api/admin/reports/$report", ['action' => 'dismiss', 'resolution' => 'Không xử lý lặp'])->assertConflict();
    }
}
