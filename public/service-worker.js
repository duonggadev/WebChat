const offlinePage = `<!doctype html>
<html lang="vi">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>HeyDay · Đang ngoại tuyến</title>
    <style>
        body { margin: 0; background: #f5f5f1; color: #25362b; font: 16px/1.5 system-ui; }
        main { max-width: 28rem; margin: 14vh auto; padding: 1.5rem; }
        a { color: inherit; }
    </style>
    <main>
        <h1>Bạn đang mất kết nối</h1>
        <p>Hãy kết nối lại với mạng để tiếp tục trò chuyện trên HeyDay.</p>
        <a href="/">Thử lại</a>
    </main>
</html>`;

self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (
        request.method !== "GET" ||
        request.mode !== "navigate" ||
        url.origin !== self.location.origin ||
        url.pathname !== "/"
    ) return;

    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => new Response(offlinePage, {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    })));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil((async () => {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const heyday = clients.find((client) => new URL(client.url).pathname === "/");
        if (heyday) {
            await heyday.focus();
        } else {
            await self.clients.openWindow("/");
        }
    })());
});
