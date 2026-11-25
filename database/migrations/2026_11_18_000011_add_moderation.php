<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 16)->default('user')->index();
            $table->timestamp('suspended_at')->nullable();
        });
        Schema::create('message_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_id')->constrained('users');
            $table->foreignId('message_id')->constrained('messages');
            $table->string('reason', 1000);
            $table->text('snapshot');
            $table->string('status', 16)->default('open')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users');
            $table->text('resolution')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('reviewed_at')->nullable();
            $table->unique(['reporter_id', 'message_id']);
        });
        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->constrained('users');
            $table->string('action', 40);
            $table->string('entity_type', 30);
            $table->unsignedBigInteger('entity_id');
            $table->json('details');
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_audit_logs');
        Schema::dropIfExists('message_reports');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['role', 'suspended_at']));
    }
};
