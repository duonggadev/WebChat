<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ProfileController extends Controller
{
    public function update(Request $request)
    {
        $data = $request->validate([
            'display_name' => ['required', 'string', 'max:100'],
            'avatar' => ['sometimes', 'required', 'image', 'mimes:jpeg,png,webp', 'max:2048', 'dimensions:ratio=1,max_width=512,max_height=512'],
        ]);
        $id = $request->user()->id;
        $path = isset($data['avatar']) ? $data['avatar']->store('avatars', 'local') : null;
        abort_if($path === false, 500, 'Không lưu được ảnh đại diện.');

        try {
            $old = DB::transaction(function () use ($id, $data, $path) {
                $profile = User::query()->lockForUpdate()->findOrFail($id);
                $old = $profile->avatar_path;
                $profile->display_name = $data['display_name'];
                if ($path !== null) {
                    $profile->avatar_path = $path;
                }
                $profile->save();

                return $old;
            }, 3);
        } catch (Throwable $error) {
            if ($path !== null) {
                Storage::disk('local')->delete($path);
            }
            throw $error;
        }

        if ($path !== null && $old !== null) {
            Storage::disk('local')->delete($old);
        }

        $user = User::findOrFail($id);

        return $user->only(['id', 'username', 'display_name', 'avatar_url', 'auth_version', 'role']);
    }

    public function avatar(int $user)
    {
        $path = User::query()->whereKey($user)->value('avatar_path');
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, null, [
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
