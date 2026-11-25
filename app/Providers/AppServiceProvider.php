<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('reports', fn (Request $request) => Limit::perMinute(5)->by('reports:'.$request->user()->id));
        RateLimiter::for('password-forgot', fn (Request $request) => Limit::perMinutes(10, 5)->by('forgot:'.$request->ip()));
        RateLimiter::for('password-reset', fn (Request $request) => Limit::perMinutes(10, 10)->by('reset:'.$request->ip()));
        RateLimiter::for('password-change', fn (Request $request) => Limit::perMinutes(10, 5)->by('change:'.$request->user()->id));
        ResetPassword::createUrlUsing(
            fn ($user, string $token) => rtrim(config('app.url'), '/').'/?reset_token='.rawurlencode($token).'&email='.rawurlencode($user->email)
        );
        ResetPassword::toMailUsing(
            fn ($user, string $token) => (new MailMessage)
                ->subject('Đặt lại mật khẩu HeyDay')
                ->line('Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản HeyDay.')
                ->action('Đặt lại mật khẩu', rtrim(config('app.url'), '/').'/?reset_token='.rawurlencode($token).'&email='.rawurlencode($user->email))
                ->line('Liên kết có hiệu lực trong 60 phút. Nếu bạn không gửi yêu cầu này, hãy bỏ qua email.')
        );
        RateLimiter::for('chat-send', function (Request $request) {
            $id = $request->user()->id;
            $limits = [
                Limit::perMinute(30)->by('message:'.$id)->response(
                    fn ($request, $headers) => response()->json([
                        'message' => 'Bạn đã gửi tối đa 30 tin nhắn trong một phút. Hãy thử lại sau.',
                    ], 429, $headers),
                ),
            ];
            if ($request->hasFile('image')) {
                $limits[] = Limit::perMinute(10)->by('image:'.$id)->response(
                    fn ($request, $headers) => response()->json([
                        'message' => 'Bạn đã gửi tối đa 10 ảnh trong một phút. Hãy thử lại sau.',
                    ], 429, $headers),
                );
            }

            return $limits;
        });
    }
}
