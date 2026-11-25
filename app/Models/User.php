<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory;
    use Notifiable;

    public const UPDATED_AT = null;

    protected $fillable = ['username', 'email', 'display_name', 'password_hash'];

    protected $hidden = ['password_hash', 'avatar_path'];

    public function getAvatarUrlAttribute(): ?string
    {
        return self::avatarUrl($this->id, $this->avatar_path);
    }

    public static function avatarUrl(int $id, ?string $path): ?string
    {
        return $path === null ? null : '/api/users/'.$id.'/avatar?v='.rawurlencode(basename($path));
    }

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }
}
