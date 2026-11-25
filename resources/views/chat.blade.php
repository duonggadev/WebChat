<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#25362b">
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" type="image/png" href="/icons/heyday-192.png">
    <link rel="apple-touch-icon" href="/icons/heyday-192.png">
    <title>HeyDay — Góc trò chuyện</title>
    @viteReactRefresh
    @vite('resources/js/app.jsx')
</head>
<body>
    <div id="app" data-demo="{{ app()->isLocal() ? 'true' : 'false' }}"></div>
    <script>
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js').catch((error) => {
                console.warn('Không thể khởi động Service Worker của HeyDay.', error);
            });
        }
    </script>
</body>
</html>
