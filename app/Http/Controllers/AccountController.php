<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AccountController extends Controller
{
    public function register(Request $request)
    {
        foreach (['username', 'email'] as $field) {
            $value = $request->input($field);
            if (is_string($value)) {
                $request->merge([$field => strtolower($value)]);
            }
        }
        $data = $request->validate([
            'username' => ['required', 'alpha_dash:ascii', 'min:3', 'max:50', 'unique:users'],
            'email' => ['required', 'email', 'max:255', 'unique:users'],
            'display_name' => ['required', 'string', 'max:100'],
            'password' => ['bail', 'required', 'string', 'min:8', $this->validatePassword(...)],
        ]);
        $data['password_hash'] = Hash::make($data['password']);
        unset($data['password']);
        $user = User::create($data);
        Auth::login($user);
        $request->session()->put('auth_version', $user->auth_version ?? 0);
        $request->session()->regenerate();

        return response()->json($this->profile($request), 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'identity' => ['required', 'string', 'max:255'],
            'password' => ['bail', 'required', 'string', $this->validatePassword(...)],
        ]);
        $field = str_contains($data['identity'], '@') ? 'email' : 'username';
        if (str_starts_with($data['identity'], '@')) {
            $field = 'username';
            $data['identity'] = substr($data['identity'], 1);
        }
        if (! Auth::attempt([$field => strtolower($data['identity']), 'password' => $data['password'], 'suspended_at' => null])) {
            throw ValidationException::withMessages(['identity' => 'Tên đăng nhập hoặc mật khẩu chưa đúng.']);
        }
        $request->session()->put('auth_version', $request->user()->auth_version);
        $request->session()->regenerate();

        return $this->profile($request);
    }

    public function profile(Request $request): array
    {
        return [
            'user' => $request->user()?->only(['id', 'username', 'display_name', 'avatar_url', 'auth_version', 'role']),
            'csrf' => csrf_token(),
        ];
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->profile($request);
    }

    public function heartbeat(Request $request)
    {
        $now = now();
        User::query()->whereKey($request->user()->id)
            ->where(fn ($query) => $query->whereNull('last_seen_at')->orWhere('last_seen_at', '<', $now->copy()->subSeconds(30)))
            ->update(['last_seen_at' => $now]);

        return response()->noContent();
    }

    private function validatePassword(string $attribute, string $value, \Closure $fail): void
    {
        if (strlen($value) > 72 || str_contains($value, "\0")) {
            $fail('Mật khẩu phải dài tối đa 72 byte và không chứa ký tự null.');
        }
    }
}
