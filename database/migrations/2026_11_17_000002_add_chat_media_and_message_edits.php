<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->string('avatar_path')->nullable());
        Schema::table('messages', function (Blueprint $table) {
            $table->string('image_path')->nullable();
            $table->timestamp('edited_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->unsignedInteger('revision')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('messages', fn (Blueprint $table) => $table->dropColumn(['image_path', 'edited_at', 'deleted_at', 'revision']));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('avatar_path'));
    }
};
