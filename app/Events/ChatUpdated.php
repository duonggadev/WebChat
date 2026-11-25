<?php

namespace App\Events;

use App\Support\AccountChannels;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class ChatUpdated implements ShouldBroadcastNow
{
    public function __construct(private array $recipients, private int $roomId, private ?object $message) {}

    public function broadcastOn(): array
    {
        return AccountChannels::forUsers($this->recipients);
    }

    public function broadcastAs(): string
    {
        return 'chat.updated';
    }

    public function broadcastWith(): array
    {
        return ['room_id' => $this->roomId, 'message' => $this->message];
    }
}
