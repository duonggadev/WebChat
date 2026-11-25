import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";
import "../css/notifications.css";

function preferencesKey(userId) {
    return `heyday:alerts:${userId}`;
}

function readPreferences(userId) {
    try {
        const saved = JSON.parse(localStorage.getItem(preferencesKey(userId)));
        return { browser: saved?.browser === true, sound: saved?.sound === true };
    } catch {
        return { browser: false, sound: false };
    }
}

function playChime(audio) {
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    const start = audio.currentTime;
    oscillator.frequency.setValueAtTime(587, start);
    oscillator.frequency.setValueAtTime(784, start + 0.09);
    volume.gain.setValueAtTime(0.001, start);
    volume.gain.exponentialRampToValueAtTime(0.05, start + 0.025);
    volume.gain.exponentialRampToValueAtTime(0.001, start + 0.19);
    oscillator.connect(volume).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.2);
}

async function showBrowserNotification(userId, roomId) {
    const options = {
        body: "Bạn có tin nhắn mới.",
        icon: "/icons/heyday-192.png",
        silent: true,
        tag: `heyday:${userId}:${roomId}`,
    };
    const worker = await navigator.serviceWorker?.getRegistration();
    if (worker?.active) {
        await worker.showNotification("HeyDay", options);
        return;
    }

    const notification = new Notification("HeyDay", options);
    notification.addEventListener("click", () => {
        window.focus();
        notification.close();
    });
}

export function useChatNotifications(userId) {
    const [preferences, setPreferences] = useState(() => readPreferences(userId));
    const [notice, setNotice] = useState("");
    const [permission, setPermission] = useState(() => window.Notification?.permission);
    const settings = useRef(preferences);
    const audio = useRef(null);
    const lastSound = useRef(-Infinity);
    const Audio = window.AudioContext || window.webkitAudioContext;
    const browserSupported = Boolean(window.isSecureContext && window.Notification);

    function save(next) {
        settings.current = next;
        setPreferences(next);
        try {
            localStorage.setItem(preferencesKey(userId), JSON.stringify(next));
        } catch {
            // Keep the settings in memory when storage is disabled.
        }
    }

    const unlockSound = useCallback(async () => {
        if (!Audio) return;
        audio.current ??= new Audio();
        if (audio.current.state === "suspended" || audio.current.state === "interrupted") {
            await audio.current.resume();
        }
    }, [Audio]);

    useEffect(() => {
        const onStorage = (event) => {
            if (event.key !== preferencesKey(userId)) return;
            settings.current = readPreferences(userId);
            setPreferences(settings.current);
        };
        const onFocus = () => setPermission(window.Notification?.permission);
        window.addEventListener("storage", onStorage);
        window.addEventListener("focus", onFocus);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("focus", onFocus);
            audio.current?.close().catch(() => {});
            audio.current = null;
        };
    }, [userId]);

    useEffect(() => {
        if (!preferences.sound) return;
        const resume = () => {
            if (audio.current?.state !== "running") unlockSound().catch(() => {});
        };
        window.addEventListener("click", resume);
        window.addEventListener("keydown", resume);
        return () => {
            window.removeEventListener("click", resume);
            window.removeEventListener("keydown", resume);
        };
    }, [preferences.sound, unlockSound]);

    const notify = useCallback(({ roomId }) => {
        if (!document.hidden) return;
        const now = performance.now();
        if (settings.current.sound && audio.current?.state === "running" && now - lastSound.current >= 1200) {
            lastSound.current = now;
            playChime(audio.current);
        }
        if (settings.current.browser && window.Notification?.permission === "granted") {
            showBrowserNotification(userId, roomId).catch(() => {});
        }
    }, [userId]);

    async function toggleBrowser() {
        setNotice("");
        if (preferences.browser && permission === "granted") {
            save({ ...settings.current, browser: false });
            return;
        }
        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            save({ ...settings.current, browser: result === "granted" });
            if (result === "denied") {
                setNotice("Cho phép thông báo HeyDay trong cài đặt trang của trình duyệt.");
            }
        } catch {
            setNotice("Không thể bật thông báo trên trình duyệt này.");
        }
    }

    async function toggleSound() {
        setNotice("");
        if (preferences.sound) {
            save({ ...settings.current, sound: false });
            return;
        }
        try {
            await unlockSound();
            save({ ...settings.current, sound: true });
        } catch {
            setNotice("Không thể bật âm thanh trên thiết bị này.");
        }
    }

    const browserOn = preferences.browser && permission === "granted";
    const controls = (
        <div className="alert-settings" role="group" aria-label="Thông báo">
            {browserSupported && (
                <button type="button" aria-pressed={browserOn} onClick={toggleBrowser}>
                    {browserOn ? <Bell size={15} /> : <BellOff size={15} />}
                    Thông báo
                </button>
            )}
            {Audio && (
                <button type="button" aria-pressed={preferences.sound} onClick={toggleSound}>
                    {preferences.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    Âm thanh
                </button>
            )}
            {notice && <p role="status">{notice}</p>}
        </div>
    );

    return { notify, controls };
}
