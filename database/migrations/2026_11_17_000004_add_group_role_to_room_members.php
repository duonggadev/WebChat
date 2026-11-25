<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('room_members', function (Blueprint $table) {
            $table->enum('role', ['owner', 'member'])->default('member');
        });

        DB::table('room_members')->whereExists(fn ($rooms) => $rooms
            ->selectRaw('1')
            ->from('rooms')
            ->whereColumn('rooms.id', 'room_members.room_id')
            ->whereColumn('rooms.created_by', 'room_members.user_id')
            ->where('rooms.type', 'group'))
            ->update(['role' => 'owner']);
    }

    public function down(): void
    {
        Schema::table('room_members', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
