<?php

namespace App\Events;

use App\Support\AccountChannels;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class BlocksChanged implements ShouldBroadcastNow
{
    public function __construct(private int $blocker, private int $blocked) {}

    public function broadcastOn(): array
    {
        return AccountChannels::forUsers([$this->blocker, $this->blocked]);
    }

    public function broadcastAs(): string
    {
        return 'blocks.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
