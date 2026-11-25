<?php

namespace App\Events;

use App\Support\AccountChannels;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class FriendshipsChanged implements ShouldBroadcastNow
{
    public function __construct(private int $first, private int $second) {}

    public function broadcastOn(): array
    {
        return AccountChannels::forUsers([$this->first, $this->second]);
    }

    public function broadcastAs(): string
    {
        return 'friendships.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
