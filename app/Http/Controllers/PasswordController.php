<?php

namespace App\Http\Controllers;

use App\Events\ChatUpdated;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class PasswordController extends Controller
{
    public function change(Request $request)
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => $this->rules(),
        ]);
        [$version, $rooms] = DB::transaction(function () use ($request, $data) {
            $user = User::query()->lockForUpdate()->findOrFail($request->user()->id);
            if (! Hash::check($data['current_password'], $user->password_hash)) {
                throw ValidationException::withMessages(['current_password' => 'Mật khẩu hiện tại chưa đúng.']);
            }
            if (Hash::check($data['password'], $user->password_hash)) {
                throw ValidationException::withMessages(['password' => 'Chọn mật khẩu mới khác mật khẩu hiện tại.']);
            }
            $user->password_hash = Hash::make($data['password']);
            $user->auth_version++;
            $user->save();
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();

            return [$user->auth_version, $this->rotatePresence($user->id)];
        }, 3);
        $request->session()->put('auth_version', $version);
        $request->session()->regenerate();
        $this->notifyRooms($rooms);

        return response()->json(['message' => 'Đã đổi mật khẩu. Các phiên đăng nhập khác đã hết hiệu lực.']);
    }

    public function forgot(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:255']]);
        Password::sendResetLink(['email' => strtolower($data['email'])]);

        return response()->json(['message' => 'Nếu email khớp với tài khoản, hướng dẫn đặt lại mật khẩu sẽ được gửi. Liên kết có hiệu lực trong 60 phút.']);
    }

    public function reset(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'token' => ['required', 'string', 'max:255'],
            'password' => $this->rules(),
        ]);
        $data['email'] = strtolower($data['email']);
        $rooms = [];
        $status = DB::transaction(function () use ($data, &$rooms) {
            $user = User::query()->where('email', $data['email'])->lockForUpdate()->first();
            if ($user === null) {
                return Password::INVALID_TOKEN;
            }

            return Password::reset($data, function (User $user, string $password) use (&$rooms) {
                $user->password_hash = Hash::make($password);
                $user->auth_version++;
                $user->save();
                $rooms = $this->rotatePresence($user->id);
            });
        }, 3);
        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['token' => 'Liên kết đã hết hạn hoặc không hợp lệ. Hãy yêu cầu liên kết mới.']);
        }
        $this->notifyRooms($rooms);

        return response()->json(['message' => 'Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.']);
    }

    private function rules(): array
    {
        return ['bail', 'required', 'string', 'min:8', 'confirmed', function ($attribute, $value, $fail) {
            if (strlen($value) > 72 || str_contains($value, "\0")) {
                $fail('Mật khẩu dài tối đa 72 byte và không chứa ký tự null.');
            }
        }];
    }

    private function rotatePresence(int $user): array
    {
        $ids = DB::table('room_members')->where('user_id', $user)->pluck('room_id')->all();
        DB::table('rooms')->whereIn('id', $ids)->increment('presence_version');

        return $ids;
    }

    private function notifyRooms(array $rooms): void
    {
        foreach ($rooms as $room) {
            $ids = DB::table('room_members')->where('room_id', $room)->pluck('user_id')->all();
            foreach (array_chunk($ids, 100) as $recipients) {
                try {
                    event(new ChatUpdated($recipients, $room, null));
                } catch (\Throwable $error) {
                    report($error);
                }
            }
        }
    }
}
