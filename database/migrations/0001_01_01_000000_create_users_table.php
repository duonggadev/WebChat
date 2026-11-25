<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('username', 50)->unique();
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('display_name', 100);
            $table->timestamp('created_at')->useCurrent();
        });
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->nullable();
            $table->enum('type', ['direct', 'group']);
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamp('created_at')->useCurrent();
        });
        Schema::create('room_members', function (Blueprint $table) {
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('joined_at')->useCurrent();
            $table->primary(['room_id', 'user_id']);
            $table->index('user_id');
        });
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users');
            $table->text('content');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['room_id', 'created_at']);
            $table->index(['room_id', 'id']);
        });
    }

    public function down(): void
    {
        foreach (['messages', 'room_members', 'rooms', 'users'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
