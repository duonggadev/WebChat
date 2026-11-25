import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import {
    Check,
    Hash,
    MessageCircle,
    Moon,
    Search,
    Star,
    Sun,
} from "lucide-react";
import { MediaDialog, ImageViewer } from "./chat-dialogs";

gsap.registerPlugin(useGSAP);
export const motion = {
    micro: 0.12,
    panel: 0.24,
    scene: 0.48,
    stagger: 0.04,
    ease: "power2.out",
};

export function useInterfaceMotion(scope, dependency) {
    useGSAP(
        () => {
            const media = gsap.matchMedia();
            media.add("(prefers-reduced-motion: no-preference)", () => {
                const targets = [
                    ...scope.current.querySelectorAll("[data-motion]"),
                ].filter(
                    (target) =>
                        target.closest("[data-motion-scope]") === scope.current,
                );
                if (targets.length)
                    gsap.timeline({
                        defaults: { ease: motion.ease, overwrite: "auto" },
                    }).fromTo(
                        targets,
                        { opacity: 0, y: 8 },
                        {
                            opacity: 1,
                            y: 0,
                            duration: motion.panel,
                            stagger: motion.stagger,
                        },
                    );
            });
            return () => media.revert();
        },
        { scope, dependencies: [dependency], revertOnUpdate: true },
    );
}

export function useDetailsMotion(panel, backdrop, open, roomId) {
    useGSAP(
        () => {
            if (!panel.current || !backdrop.current) return;
            const element = panel.current;
            if (!element.dataset.drawerReady) {
                gsap.set(element, { x: 0, xPercent: 100, autoAlpha: 0 });
                element.dataset.drawerReady = "true";
            }
            const reduce = window.matchMedia(
                "(prefers-reduced-motion: reduce)",
            ).matches;
            const duration = reduce ? 0 : motion.panel;
            gsap.to(element, {
                x: 0,
                xPercent: open ? 0 : 100,
                autoAlpha: open ? 1 : 0,
                duration,
                ease: motion.ease,
                overwrite: true,
                onComplete: () => gsap.set(element, { willChange: "auto" }),
                onStart: () =>
                    gsap.set(element, {
                        willChange: "transform, opacity",
                    }),
            });
            gsap.to(backdrop.current, {
                autoAlpha: open ? 1 : 0,
                duration,
                ease: motion.ease,
                overwrite: true,
            });
        },
        { dependencies: [open, roomId], scope: panel },
    );
    useEffect(
        () => () => {
            if (panel.current) gsap.killTweensOf(panel.current);
            if (backdrop.current) gsap.killTweensOf(backdrop.current);
        },
        [panel, backdrop],
    );
}

export function DialogMotion() {
    useEffect(() => {
        const contexts = new Map();
        const observer = new MutationObserver(() => {
            for (const [dialog, context] of contexts) {
                if (!dialog.isConnected || !dialog.open) {
                    context.revert();
                    contexts.delete(dialog);
                }
            }
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
                return;
            document.querySelectorAll("dialog[open]").forEach((dialog) => {
                if (contexts.has(dialog)) return;
                contexts.set(
                    dialog,
                    gsap.context(() => {
                        gsap.timeline({
                            defaults: { ease: motion.ease, overwrite: "auto" },
                        }).fromTo(
                            dialog,
                            { opacity: 0, y: 8, scale: 0.985 },
                            {
                                opacity: 1,
                                y: 0,
                                scale: 1,
                                duration: motion.panel,
                            },
                        );
                    }, dialog),
                );
            });
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["open"],
        });
        return () => {
            observer.disconnect();
            contexts.forEach((context) => context.revert());
        };
    }, []);
    return null;
}

export function useInterfacePreferences(userId) {
    const key = `heyday:interface:${userId}`;
    const [preferences, setPreferences] = useState(() => {
        let value;
        try {
            value = JSON.parse(localStorage.getItem(key));
        } catch {
            /* Use defaults. */
        }
        return {
            theme: value?.theme === "light" ? "light" : "dark",
            density: value?.density === "compact" ? "compact" : "comfortable",
            fontSize: value?.fontSize === "large" ? "large" : "normal",
            favorites: Array.isArray(value?.favorites)
                ? value.favorites.filter(Number.isSafeInteger)
                : [],
        };
    });
    useEffect(() => {
        const root = document.documentElement;
        root.dataset.theme = preferences.theme;
        root.dataset.density = preferences.density;
        root.dataset.fontSize = preferences.fontSize;
        try {
            localStorage.setItem(key, JSON.stringify(preferences));
        } catch {
            /* Retain session values. */
        }
        return () => {
            delete root.dataset.theme;
            delete root.dataset.density;
            delete root.dataset.fontSize;
        };
    }, [preferences, key]);
    return [
        preferences,
        (patch) => setPreferences((current) => ({ ...current, ...patch })),
    ];
}

export function PreferencesDialog({
    preferences,
    onChange,
    onClose,
    onPassword,
    onAdmin,
}) {
    return (
        <MediaDialog
            title="Không gian của bạn"
            onClose={onClose}
            className="preferences-dialog"
        >
            <p className="dialog-intro">
                Tùy chỉnh cách HeyDay hiển thị trên trình duyệt này
            </p>
            <fieldset className="preference-group">
                <legend>Giao diện</legend>
                <div className="theme-options">
                    {[
                        ["dark", "Đêm", Moon],
                        ["light", "Ngày", Sun],
                    ].map(([value, label, Icon]) => (
                        <button
                            type="button"
                            className={`theme-option theme-preview-${value}`}
                            key={value}
                            aria-pressed={preferences.theme === value}
                            onClick={() => onChange({ theme: value })}
                        >
                            <span className="theme-miniature">
                                <span />
                                <i />
                                <i />
                                <i />
                            </span>
                            <span>
                                <Icon /> {label}{" "}
                                {preferences.theme === value && <Check />}
                            </span>
                        </button>
                    ))}
                </div>
            </fieldset>
            {[
                [
                    "density",
                    "Mật độ hội thoại",
                    [
                        ["comfortable", "Thoải mái"],
                        ["compact", "Gọn"],
                    ],
                ],
                [
                    "fontSize",
                    "Cỡ chữ tin nhắn",
                    [
                        ["normal", "Tiêu chuẩn"],
                        ["large", "Lớn"],
                    ],
                ],
            ].map(([key, label, options]) => (
                <fieldset className="preference-group" key={key}>
                    <legend>{label}</legend>
                    <div className="segmented-options">
                        {options.map(([value, name]) => (
                            <button
                                type="button"
                                key={value}
                                aria-pressed={preferences[key] === value}
                                onClick={() => onChange({ [key]: value })}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                </fieldset>
            ))}
            <button
                type="button"
                className="friend-outline"
                onClick={onPassword}
            >
                Đổi mật khẩu
            </button>
            {onAdmin && (
                <button
                    type="button"
                    className="friend-outline"
                    onClick={onAdmin}
                >
                    Quản trị HeyDay
                </button>
            )}
            <div className="shortcut-reference">
                <kbd>Ctrl / ⌘</kbd> + <kbd>K</kbd>
                <span>Chuyển nhanh cuộc trò chuyện</span>
            </div>
        </MediaDialog>
    );
}

export function QuickSwitchDialog({
    rooms,
    user,
    favorites,
    onChoose,
    onClose,
}) {
    const [query, setQuery] = useState("");
    const [index, setIndex] = useState(0);
    const input = useRef(null);
    const title = (room) =>
        room.name ||
        room.members.find((member) => member.id !== user.id)?.display_name ||
        "Chat riêng";
    const results = rooms
        .filter((room) =>
            title(room)
                .toLocaleLowerCase("vi")
                .includes(query.trim().toLocaleLowerCase("vi")),
        )
        .sort(
            (a, b) =>
                Number(favorites.includes(b.id)) -
                Number(favorites.includes(a.id)),
        )
        .slice(0, 12);
    useEffect(() => {
        input.current?.focus();
    }, []);
    const selected = Math.min(index, Math.max(0, results.length - 1));
    useEffect(() => {
        document
            .getElementById(`switch-room-${results[selected]?.id}`)
            ?.scrollIntoView({ block: "nearest" });
    }, [selected, query]);
    return (
        <MediaDialog
            title="Chuyển nhanh"
            onClose={onClose}
            className="quick-switch-dialog"
        >
            <label className="quick-switch-input">
                <Search />
                <input
                    ref={input}
                    aria-label="Tìm phòng để chuyển nhanh"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="quick-switch-list"
                    aria-activedescendant={
                        results[selected]
                            ? `switch-room-${results[selected].id}`
                            : undefined
                    }
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setIndex(0);
                    }}
                    placeholder="Tên bạn bè hoặc nhóm…"
                    onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setIndex((current) =>
                                Math.min(current + 1, results.length - 1),
                            );
                        }
                        if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setIndex((current) => Math.max(0, current - 1));
                        }
                        if (event.key === "Enter" && results[selected]) {
                            event.preventDefault();
                            onChoose(results[selected].id);
                        }
                    }}
                />
            </label>
            <div
                className="quick-switch-list"
                role="listbox"
                id="quick-switch-list"
                aria-label="Kết quả phòng"
            >
                {results.map((room, position) => (
                    <button
                        type="button"
                        role="option"
                        aria-selected={position === selected}
                        id={`switch-room-${room.id}`}
                        key={room.id}
                        onClick={() => onChoose(room.id)}
                    >
                        {room.type === "group" ? <Hash /> : <MessageCircle />}
                        <span>{title(room)}</span>
                        {favorites.includes(room.id) && <Star />}
                        {room.unread_count > 0 && (
                            <small>{room.unread_count} tin mới</small>
                        )}
                    </button>
                ))}
                {results.length === 0 && (
                    <p className="friends-empty">
                        Không tìm thấy cuộc trò chuyện
                    </p>
                )}
            </div>
            <div className="quick-switch-footer">
                <span>
                    <kbd>↑</kbd> <kbd>↓</kbd> di chuyển
                </span>
                <span>
                    <kbd>Enter</kbd> mở
                </span>
                <span>
                    <kbd>Esc</kbd> đóng
                </span>
            </div>
        </MediaDialog>
    );
}

export function SharedMedia({ messages, older, onOlder, loading }) {
    const [image, setImage] = useState(null);
    const [busy, setBusy] = useState(false);
    const images = messages.filter(
        (message) => message.image_url && !message.deleted_at,
    );
    const selected = images.find((message) => message.id === image);
    return (
        <section className="shared-media">
            <h3>
                Ảnh đã chia sẻ <span>{images.length}</span>
            </h3>
            {images.length ? (
                <div className="shared-media-grid">
                    {images
                        .slice()
                        .reverse()
                        .map((message) => (
                            <button
                                type="button"
                                aria-label={`Mở ảnh của ${message.sender_name}`}
                                key={message.id}
                                onClick={() => setImage(message.id)}
                            >
                                <img
                                    loading="lazy"
                                    src={
                                        message.thumbnail_url ??
                                        message.image_url
                                    }
                                    alt={
                                        message.content || "Ảnh trong hội thoại"
                                    }
                                />
                            </button>
                        ))}
                </div>
            ) : (
                <p>
                    {loading
                        ? "Đang tải ảnh…"
                        : "Chưa có ảnh trong phần lịch sử đã tải"}
                </p>
            )}
            {older && (
                <button
                    className="text-button"
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        try {
                            await onOlder();
                        } catch {
                            /* Parent displays error. */
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    {busy ? "Đang tải…" : "Tải thêm lịch sử"}
                </button>
            )}
            {selected && (
                <ImageViewer
                    url={selected.image_url}
                    onClose={() => setImage(null)}
                />
            )}
        </section>
    );
}
