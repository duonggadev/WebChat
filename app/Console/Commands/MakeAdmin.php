<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MakeAdmin extends Command
{
    protected $signature = 'heyday:admin {username} {--reason=Khởi tạo quản trị viên qua console}';

    protected $description = 'Cấp quyền quản trị cho tài khoản đã tồn tại và ghi nhật ký';

    public function handle(): int
    {
        return DB::transaction(function () {
            $user = DB::table('users')->where('username', strtolower($this->argument('username')))->lockForUpdate()->first();
            if (! $user || $user->suspended_at !== null) {
                $this->error('Chọn tài khoản đang hoạt động và đã đăng ký.');

                return self::FAILURE;
            }
            if ($user->role !== 'admin') {
                DB::table('users')->where('id', $user->id)->update(['role' => 'admin', 'auth_version' => $user->auth_version + 1]);
                DB::table('admin_audit_logs')->insert([
                    'actor_id' => $user->id, 'action' => 'bootstrap_admin', 'entity_type' => 'user',
                    'entity_id' => $user->id, 'details' => json_encode(['source' => 'console', 'reason' => $this->option('reason')], JSON_THROW_ON_ERROR),
                ]);
            }
            $this->info('Đã cấp quyền quản trị. Tài khoản cần đăng nhập lại.');

            return self::SUCCESS;
        }, 3);
    }
}
