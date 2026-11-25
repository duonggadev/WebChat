<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EnsureAccountSession
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if ($user !== null && ($user->suspended_at !== null || (int) $request->session()->get('auth_version', 0) !== (int) $user->auth_version)) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return $request->expectsJson()
                ? response()->json(['message' => 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.'], 401)
                : redirect('/');
        }

        return $next($request);
    }
}
