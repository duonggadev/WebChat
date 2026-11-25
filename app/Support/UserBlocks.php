<?php

namespace App\Support;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class UserBlocks
{
    /**
     * Lock both account rows in a consistent order inside the caller's write transaction.
     */
    public static function lockPair(int $one, int $two): void
    {
        DB::table('users')->whereIn('id', [$one, $two])
            ->orderBy('id')->lockForUpdate()->get(['id']);
    }

    public static function between(int $one, int $two): bool
    {
        return DB::table('user_blocks')->where(fn (Builder $pair) => $pair
            ->where(['blocker_id' => $one, 'blocked_id' => $two])
            ->orWhere(['blocker_id' => $two, 'blocked_id' => $one]))
            ->exists();
    }

    public static function relatedIds(int $viewer): Collection
    {
        return DB::table('user_blocks')->where('blocker_id', $viewer)->pluck('blocked_id')
            ->merge(DB::table('user_blocks')->where('blocked_id', $viewer)->pluck('blocker_id'))
            ->unique()->values();
    }

    public static function hideFrom(Builder $query, int $viewer, string $userColumn = 'users.id'): Builder
    {
        return $query->whereNotExists(fn (Builder $blocks) => $blocks->selectRaw('1')
            ->from('user_blocks')
            ->where(fn (Builder $pair) => $pair
                ->where(fn (Builder $outgoing) => $outgoing->where('blocker_id', $viewer)
                    ->whereColumn('blocked_id', $userColumn))
                ->orWhere(fn (Builder $incoming) => $incoming->where('blocked_id', $viewer)
                    ->whereColumn('blocker_id', $userColumn))));
    }
}
