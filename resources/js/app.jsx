import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    Ban,
    Flag,
    Crop,
    Hash,
    ImagePlus,
    LogOut,
    MessageCircle,
    PanelRight,
    Plus,
    Pencil,
    Reply,
    SmilePlus,
    Search,
    Settings2,
    Send,
    Star,
    UserPlus,
    Users,
    X,
} from "lucide-react";
import {
    CropDialog,
    EditMessageDialog,
    ImageViewer,
    NoticeDialog,
    ProfileDialog,
    imageTypes,
    useImagePreview,
    validateImage,
} from "./chat-dialogs";
import "../css/chat.css";
import {
    DialogMotion,
    PreferencesDialog,
    QuickSwitchDialog,
    SharedMedia,
    useInterfaceMotion,
    useInterfacePreferences,
    useDetailsMotion,
} from "./interface-tools";
import { useChatNotifications } from "./notifications.jsx";
import { useRoomPresence } from "./use-room-presence";
import {
    BlockDialog,
    BlockedUsersDialog,
    GroupActions,
    MemberActions,
    RoomManagementDialog,
    RoomSearchDialog,
    describeMessage,
    reactionEmojis,
} from "./room-tools";
import "../css/redesign.css";
import { PasswordDialog, RecoveryForm } from "./account-tools";
import { AdminPanel, ReportDialog } from "./enterprise-tools";

let csrf = "";
const demo = document.getElementById("app").dataset.demo === "true";
const day = new Intl.DateTimeFormat("vi-VN", { dateStyle: "full" });
const clock = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
});
const compact = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
});
const asDate = (value) => new Date(value.replace(" ", "T") + "Z");
const initials = (name) =>
    name
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((word) => word[0])
        .join("");
const roomName = (room, user) =>
    room.name ||
    room.members.find((member) => member.id !== user.id)?.display_name ||
    "Tin nhắn riêng";
function mergeMessages(current, added) {
    const messages = new Map(current.map((message) => [message.id, message]));
    for (const message of added) {
        if ((messages.get(message.id)?.revision ?? 0) <= message.revision) {
            messages.set(message.id, message);
        }
    }
    return [...messages.values()].sort((a, b) => a.id - b.id);
}

async function api(path, method = "GET", data, signal) {
    const multipart = data instanceof FormData;
    const response = await fetch("/api" + path, {
        method,
        signal,
        headers: {
            Accept: "application/json",
            ...(!multipart && { "Content-Type": "application/json" }),
            "X-CSRF-TOKEN": csrf,
        },
        body: multipart ? data : JSON.stringify(data),
    });
    const payload =
        response.status === 204
            ? null
            : await response.json().catch(() => null);
    if (!response.ok) {
        if (response.status === 401 || response.status === 419) {
            window.dispatchEvent(new Event("heyday:session-expired"));
        }
        const error = new Error(
            Object.values(payload?.errors ?? {})[0]?.[0] ??
                payload?.message ??
                "Không thể kết nối. Vui lòng thử lại.",
        );
        error.status = response.status;
        throw error;
    }
    if (payload?.csrf) csrf = payload.csrf;
    return payload;
}

function Brand() {
    return (
        <div className="brand">
            <span className="brand-mark">
                <MessageCircle aria-hidden="true" />
            </span>
            <span>HeyDay</span>
        </div>
    );
}

function Avatar({ name, src, group = false, size = "" }) {
    return (
        <span
            aria-hidden="true"
            className={`avatar ${group ? "group-avatar" : ""} ${size}`}
        >
            {group ? (
                <Hash size={20} />
            ) : src ? (
                <img src={src} alt="" />
            ) : (
                initials(name)
            )}
        </span>
    );
}

function IconButton({ label, children, ...props }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className="icon-button"
            {...props}
        >
            {children}
        </button>
    );
}

function MemberStatus({ member, presence, groupCount, blocked }) {
    if (groupCount !== null && groupCount !== undefined)
        return `${groupCount} thành viên`;
    if (blocked || !member) return "Trò chuyện riêng";
    const lastSeen = member.last_seen_at
        ? asDate(member.last_seen_at).getTime()
        : null;
    const minutes =
        lastSeen === null
            ? null
            : Math.max(0, Math.floor((Date.now() - lastSeen) / 60000));
    if (presence.online.includes(member.id) || minutes === 0) {
        return <span className="member-status online">Đang trực tuyến</span>;
    }
    if (minutes === null) return "Ngoại tuyến";
    if (minutes < 60) return `Hoạt động ${minutes} phút trước`;
    if (minutes < 1440)
        return `Hoạt động ${Math.floor(minutes / 60)} giờ trước`;
    return `Hoạt động ${Math.floor(minutes / 1440)} ngày trước`;
}

function Login({ onLogin }) {
    const motionScope = useRef(null);
    useInterfaceMotion(motionScope, "entry");
    const [register, setRegister] = useState(false);
    const resetParams = new URLSearchParams(window.location.search);
    const [recovery, setRecovery] = useState(
        resetParams.has("reset_token") ? "reset" : null,
    );
    const reset =
        recovery === "reset"
            ? {
                  token: resetParams.get("reset_token"),
                  email: resetParams.get("email") ?? "",
              }
            : null;
    function backToLogin() {
        window.history.replaceState({}, "", window.location.pathname);
        setRecovery(null);
    }
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit(data, isRegistration = register) {
        setBusy(true);
        setError("");
        try {
            const session = await api(
                isRegistration ? "/register" : "/login",
                "POST",
                data,
            );
            onLogin(session.user);
        } catch (error) {
            setError(error.message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <main className="entry" ref={motionScope} data-motion-scope>
            <section className="entry-content">
                <div className="entry-navigation" data-motion>
                    <Brand />
                    <span>Chuyện của chúng mình</span>
                </div>
                <div className="entry-form">
                    {recovery ? (
                        <RecoveryForm
                            api={api}
                            reset={reset}
                            onBack={backToLogin}
                        />
                    ) : (
                        <>
                            <div data-motion>
                                <span className="entry-context">
                                    Một chỗ cho những người bạn
                                </span>
                                <h1>
                                    {register
                                        ? "Bắt đầu câu chuyện"
                                        : "Gặp nhau\nở HeyDay"}
                                </h1>
                                <p className="entry-description">
                                    {register
                                        ? "Tạo tài khoản để tham gia những cuộc trò chuyện của bạn."
                                        : "Từ một lời chào đến những câu chuyện dài. Giữ bạn bè và nhóm của bạn ở gần hơn."}
                                </p>
                            </div>
                            <form
                                data-motion
                                key={String(register)}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    submit(
                                        Object.fromEntries(
                                            new FormData(event.currentTarget),
                                        ),
                                    );
                                }}
                            >
                                {register ? (
                                    <>
                                        <label>
                                            Tên hiển thị
                                            <input
                                                name="display_name"
                                                required
                                                maxLength={100}
                                                autoComplete="name"
                                            />
                                        </label>
                                        <label>
                                            Tên đăng nhập
                                            <input
                                                name="username"
                                                required
                                                minLength={3}
                                                maxLength={50}
                                                autoComplete="username"
                                            />
                                        </label>
                                        <label>
                                            Email
                                            <input
                                                name="email"
                                                type="email"
                                                required
                                                autoComplete="email"
                                            />
                                        </label>
                                    </>
                                ) : (
                                    <label>
                                        Email hoặc tên đăng nhập
                                        <input
                                            name="identity"
                                            required
                                            autoComplete="username"
                                        />
                                    </label>
                                )}
                                <label>
                                    Mật khẩu
                                    <input
                                        name="password"
                                        type="password"
                                        required
                                        minLength={register ? 8 : undefined}
                                        maxLength={72}
                                        autoComplete={
                                            register
                                                ? "new-password"
                                                : "current-password"
                                        }
                                        placeholder={
                                            register
                                                ? "Tối thiểu 8 ký tự"
                                                : undefined
                                        }
                                    />
                                </label>
                                {error && (
                                    <p className="error" role="alert">
                                        {error}
                                    </p>
                                )}
                                <button
                                    className="primary entry-submit"
                                    disabled={busy}
                                >
                                    {register ? "Tạo tài khoản" : "Đăng nhập"}
                                    <ArrowRight size={17} />
                                </button>
                            </form>
                            {!register && (
                                <button
                                    type="button"
                                    className="text-button forgot-password"
                                    onClick={() => setRecovery("forgot")}
                                >
                                    Quên mật khẩu?
                                </button>
                            )}
                            <p className="entry-switch">
                                {register
                                    ? "Đã có tài khoản?"
                                    : "Chưa có tài khoản?"}{" "}
                                <button
                                    className="text-button"
                                    onClick={() => {
                                        setRegister(!register);
                                        setError("");
                                    }}
                                >
                                    {register ? "Đăng nhập" : "Đăng ký"}
                                </button>
                            </p>
                            {demo && (
                                <div className="demo">
                                    <span>Tài khoản dùng thử</span>
                                    {["duong", "linh"].map((name) => (
                                        <button
                                            key={name}
                                            disabled={busy}
                                            onClick={() =>
                                                submit(
                                                    {
                                                        identity: name,
                                                        password:
                                                            "HeyDay-demo-local",
                                                    },
                                                    false,
                                                )
                                            }
                                        >
                                            {name === "duong"
                                                ? "Dương"
                                                : "Linh"}{" "}
                                            <ArrowUpRight size={14} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
                <footer className="entry-footer" data-motion>
                    <span>HeyDay — góc trò chuyện của bạn</span>
                    <span>Tiếng Việt</span>
                </footer>
            </section>
            <figure className="entry-photo">
                <div className="entry-photo-heading" data-motion>
                    <span>Bạn bè. Nhóm nhỏ. Câu chuyện lớn.</span>
                    <MessageCircle />
                </div>
                <img
                    src="/friends.jpg"
                    alt="Một nhóm bạn khoác vai nhau nhìn ra biển"
                />
                <div className="entry-photo-note" data-motion>
                    <span className="photo-note-mark">
                        <Users />
                    </span>
                    <div>
                        <strong>Có nhau, kể gì cũng vui</strong>
                        <p>
                            Gửi ảnh, trò chuyện và bắt kịp những điều nhỏ mỗi
                            ngày
                        </p>
                    </div>
                </div>
                <figcaption>
                    <a
                        href="https://unsplash.com/photos/people-holding-shoulders-sitting-on-wall-Cecb0_8Hx-o"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Ảnh của Duy Pham trên Unsplash <ArrowUpRight />
                    </a>
                </figcaption>
            </figure>
        </main>
    );
}

function PeopleDialog({ mode, room, onClose, onDone }) {
    const dialog = useRef(null);
    const [kind, setKind] = useState("direct");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState([]);
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [searchError, setSearchError] = useState("");
    const inviting = mode === "invite";

    useEffect(() => {
        dialog.current.showModal();
    }, []);
    useEffect(() => {
        const request = new AbortController();
        const timer = setTimeout(async () => {
            try {
                setSearchError("");
                setResults(
                    await api(
                        "/users?q=" + encodeURIComponent(query),
                        "GET",
                        undefined,
                        request.signal,
                    ),
                );
            } catch (error) {
                if (error.name !== "AbortError") setSearchError(error.message);
            }
        }, 230);
        return () => {
            clearTimeout(timer);
            request.abort();
        };
    }, [query]);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            if (inviting) {
                await api(`/rooms/${room.id}/members`, "POST", {
                    user_id: selected[0].id,
                });
                onDone(room.id);
            } else {
                const result = await api("/rooms", "POST", {
                    type: kind,
                    name,
                    members: selected.map((person) => person.id),
                });
                onDone(result.room_id);
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setBusy(false);
        }
    }

    const available = results.filter(
        (person) =>
            !inviting ||
            !room.members.some((member) => member.id === person.id),
    );
    return (
        <dialog
            ref={dialog}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            aria-labelledby="dialog-title"
        >
            <form onSubmit={submit}>
                <header>
                    <h2 id="dialog-title">
                        {inviting ? "Thêm thành viên" : "Cuộc trò chuyện mới"}
                    </h2>
                    <IconButton label="Đóng" onClick={onClose}>
                        <X size={21} />
                    </IconButton>
                </header>
                {!inviting && (
                    <div className="tabs">
                        {[
                            ["direct", "Chat riêng"],
                            ["group", "Chat nhóm"],
                        ].map(([key, label]) => (
                            <button
                                type="button"
                                className={kind === key ? "active" : ""}
                                key={key}
                                onClick={() => {
                                    setKind(key);
                                    setSelected([]);
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
                {!inviting && kind === "group" && (
                    <label>
                        Tên nhóm
                        <input
                            value={name}
                            required
                            onChange={(event) => setName(event.target.value)}
                            maxLength={100}
                        />
                    </label>
                )}
                <label>
                    Tìm người dùng
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Tên hiển thị hoặc tên đăng nhập"
                        maxLength={100}
                    />
                </label>
                {selected.length > 0 && (
                    <div className="selection">
                        {selected.map((person) => (
                            <button
                                type="button"
                                key={person.id}
                                onClick={() =>
                                    setSelected(
                                        selected.filter(
                                            (item) => item.id !== person.id,
                                        ),
                                    )
                                }
                            >
                                {person.display_name} <X size={13} />
                            </button>
                        ))}
                    </div>
                )}
                <div className="people-results">
                    {searchError ? (
                        <p className="error">{searchError}</p>
                    ) : (
                        available.length === 0 && (
                            <p className="subtle">Không tìm thấy người dùng.</p>
                        )
                    )}
                    {available.map((person) => (
                        <button
                            type="button"
                            key={person.id}
                            aria-pressed={selected.some(
                                (item) => item.id === person.id,
                            )}
                            onClick={() => {
                                setSelected((current) =>
                                    current.some(
                                        (item) => item.id === person.id,
                                    )
                                        ? current.filter(
                                              (item) => item.id !== person.id,
                                          )
                                        : inviting || kind === "direct"
                                          ? [person]
                                          : [...current, person].slice(0, 30),
                                );
                            }}
                        >
                            <Avatar name={person.display_name} size="small" />
                            <span>
                                <strong>{person.display_name}</strong>
                                <small>@{person.username}</small>
                            </span>
                            <Plus size={16} />
                        </button>
                    ))}
                </div>
                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}
                <button className="primary" disabled={busy || !selected.length}>
                    {inviting ? "Thêm vào nhóm" : "Mở cuộc trò chuyện"}
                    <ArrowRight size={17} />
                </button>
            </form>
        </dialog>
    );
}

function FriendsDialog({
    relationships,
    user,
    onClose,
    refresh,
    onChat,
    onBlocks,
}) {
    const dialog = useRef(null);
    const [tab, setTab] = useState("friends");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState(null);
    const [searchError, setSearchError] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const byUser = new Map(relationships?.map((item) => [item.user_id, item]));
    const friends =
        relationships?.filter((item) => item.status === "accepted") ?? [];
    const incoming =
        relationships?.filter(
            (item) =>
                item.status === "pending" && item.requested_by !== user.id,
        ) ?? [];
    const outgoing =
        relationships?.filter(
            (item) =>
                item.status === "pending" && item.requested_by === user.id,
        ) ?? [];

    useEffect(() => {
        dialog.current.showModal();
    }, []);
    useEffect(() => {
        if (tab !== "discover") return;
        const request = new AbortController();
        setResults(null);
        setSearchError("");
        const timer = setTimeout(async () => {
            try {
                setResults(
                    await api(
                        "/users?q=" +
                            encodeURIComponent(query.trim().replace(/^@/, "")),
                        "GET",
                        undefined,
                        request.signal,
                    ),
                );
            } catch (error) {
                if (error.name !== "AbortError") setSearchError(error.message);
            }
        }, 220);
        return () => {
            clearTimeout(timer);
            request.abort();
        };
    }, [tab, query]);

    async function perform(action) {
        setBusy(true);
        setError("");
        try {
            await action();
        } catch (error) {
            setError(error.message);
        } finally {
            setBusy(false);
        }
    }

    const update = (id, action) =>
        perform(async () => {
            await api(`/friendships/${id}`, "PATCH", { action });
            await refresh();
        });
    const invite = (userId) =>
        perform(async () => {
            await api("/friendships", "POST", { user_id: userId });
            await refresh();
        });
    const chat = (id) => perform(() => onChat(id));

    function row(person, actions) {
        const id = person.user_id ?? person.id;
        return (
            <li className="friend-row" key={id}>
                <Avatar name={person.display_name} />
                <div className="friend-identity">
                    <strong>{person.display_name}</strong>
                    <small>@{person.username}</small>
                </div>
                <div className="friend-actions">{actions}</div>
            </li>
        );
    }

    const pending = (item) =>
        item.requested_by === user.id
            ? "Đã gửi lời mời"
            : "Đã gửi lời mời cho bạn";
    return (
        <dialog
            ref={dialog}
            className="friends-dialog"
            aria-labelledby="friends-title"
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
        >
            <header>
                <h2 id="friends-title">Bạn bè</h2>
                <div className="modal-heading-actions">
                    <IconButton label="Tài khoản đã chặn" onClick={onBlocks}>
                        <Ban />
                    </IconButton>
                    <IconButton label="Đóng bạn bè" onClick={onClose}>
                        <X size={20} />
                    </IconButton>
                </div>
            </header>
            <div className="friends-content">
                <div className="tabs friends-tabs">
                    {[
                        ["friends", `Bạn bè (${friends.length})`],
                        [
                            "requests",
                            incoming.length
                                ? `Lời mời (${incoming.length})`
                                : "Lời mời",
                        ],
                        ["discover", "Tìm bạn"],
                    ].map(([key, label]) => (
                        <button
                            key={key}
                            className={tab === key ? "active" : ""}
                            aria-pressed={tab === key}
                            onClick={() => setTab(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}
                {tab === "friends" &&
                    (relationships === null ? (
                        <p className="friends-empty">Đang tải bạn bè…</p>
                    ) : friends.length ? (
                        <ul className="friends-list">
                            {friends.map((person) =>
                                row(
                                    person,
                                    <>
                                        <button
                                            className="friend-solid"
                                            disabled={busy}
                                            onClick={() => chat(person.user_id)}
                                        >
                                            <MessageCircle size={15} /> Nhắn tin
                                        </button>
                                        <IconButton
                                            label={`Hủy kết bạn với ${person.display_name}`}
                                            disabled={busy}
                                            onClick={() => {
                                                if (
                                                    window.confirm(
                                                        `Hủy kết bạn với ${person.display_name}?`,
                                                    )
                                                )
                                                    update(person.id, "remove");
                                            }}
                                        >
                                            <X size={16} />
                                        </IconButton>
                                    </>,
                                ),
                            )}
                        </ul>
                    ) : (
                        <div className="friends-empty">
                            <p>Bạn chưa có bạn bè trên HeyDay.</p>
                            <button
                                className="text-button"
                                onClick={() => setTab("discover")}
                            >
                                Tìm người quen
                            </button>
                        </div>
                    ))}
                {tab === "requests" && (
                    <div className="request-lists">
                        <section aria-labelledby="incoming-title">
                            <h3 id="incoming-title">Đã nhận</h3>
                            {incoming.length ? (
                                <ul className="friends-list">
                                    {incoming.map((person) =>
                                        row(
                                            person,
                                            <>
                                                <button
                                                    className="friend-solid"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        update(
                                                            person.id,
                                                            "accept",
                                                        )
                                                    }
                                                >
                                                    Chấp nhận
                                                </button>
                                                <button
                                                    className="friend-outline"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        update(
                                                            person.id,
                                                            "decline",
                                                        )
                                                    }
                                                >
                                                    Từ chối
                                                </button>
                                            </>,
                                        ),
                                    )}
                                </ul>
                            ) : (
                                <p className="friends-empty">
                                    Không có lời mời đang chờ.
                                </p>
                            )}
                        </section>
                        <section aria-labelledby="outgoing-title">
                            <h3 id="outgoing-title">Đã gửi</h3>
                            {outgoing.length ? (
                                <ul className="friends-list">
                                    {outgoing.map((person) =>
                                        row(
                                            person,
                                            <button
                                                className="friend-outline"
                                                disabled={busy}
                                                onClick={() =>
                                                    update(person.id, "cancel")
                                                }
                                            >
                                                Thu hồi
                                            </button>,
                                        ),
                                    )}
                                </ul>
                            ) : (
                                <p className="friends-empty">
                                    Chưa gửi lời mời nào.
                                </p>
                            )}
                        </section>
                    </div>
                )}
                {tab === "discover" && (
                    <>
                        <label className="search friends-search">
                            <Search size={16} />
                            <input
                                aria-label="Tìm người dùng"
                                placeholder="Tên hoặc @tên đăng nhập"
                                value={query}
                                maxLength={100}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                            />
                        </label>
                        {searchError ? (
                            <p className="error" role="alert">
                                {searchError}
                            </p>
                        ) : results === null ? (
                            <p className="friends-empty">
                                Đang tìm người dùng…
                            </p>
                        ) : results.length ? (
                            <ul className="friends-list">
                                {results.map((person) => {
                                    const relation = byUser.get(person.id);
                                    const action =
                                        relation?.status === "accepted" ? (
                                            <button
                                                className="friend-outline"
                                                disabled={busy}
                                                onClick={() => chat(person.id)}
                                            >
                                                Nhắn tin
                                            </button>
                                        ) : relation ? (
                                            <button
                                                className="friend-outline"
                                                onClick={() =>
                                                    setTab("requests")
                                                }
                                            >
                                                {pending(relation)}
                                            </button>
                                        ) : (
                                            <button
                                                className="friend-solid"
                                                disabled={
                                                    busy ||
                                                    relationships === null
                                                }
                                                onClick={() =>
                                                    invite(person.id)
                                                }
                                            >
                                                <UserPlus size={15} /> Kết bạn
                                            </button>
                                        );
                                    return row(person, action);
                                })}
                            </ul>
                        ) : (
                            <p className="friends-empty">
                                Không tìm thấy người dùng.
                            </p>
                        )}
                    </>
                )}
            </div>
        </dialog>
    );
}

function Conversation({
    room,
    user,
    messages,
    older,
    loading,
    onOlder,
    onSend,
    onChangeMessage,
    onReact,
    onRead,
    visible,
    presence,
    favorite,
    onFavorite,
    goBack,
    onDetails,
    details,
}) {
    const motionScope = useRef(null);
    useInterfaceMotion(motionScope, room.id);
    const draftKey = `heyday:draft:${user.id}:${room.id}`;
    const [draft, setDraft] = useState(() => {
        try {
            return localStorage.getItem(draftKey) ?? "";
        } catch {
            return "";
        }
    });
    const [reply, setReply] = useState(null);
    const [reactionTarget, setReactionTarget] = useState(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [atBottom, setAtBottom] = useState(true);
    const [attachment, setAttachment] = useState(null);
    const [imageNotice, setImageNotice] = useState(null);
    const [editor, setEditor] = useState(null);
    const [reportTarget, setReportTarget] = useState(null);
    const [viewer, setViewer] = useState(null);
    const [cropping, setCropping] = useState(false);
    const [cropped, setCropped] = useState(false);
    const attachmentUrl = useImagePreview(attachment);
    const latestId = messages.at(-1)?.id ?? 0;
    const seenLatest = useRef(null);
    const arrivals =
        !loading &&
        seenLatest.current !== null &&
        latestId > seenLatest.current;
    const list = useRef(null);
    const beforeHeight = useRef(null);
    const pinBottom = useRef(true);
    const olderRequest = useRef(null);
    const readTarget = useRef(0);
    const composerInput = useRef(null);
    const name = roomName(room, user);
    const peer = room.members.find((member) => member.id !== user.id);
    const viewedImage = messages.find((item) => item.id === viewer)?.image_url;
    const messageById = new Map(messages.map((item) => [item.id, item]));
    const activeTypists = room.blocked
        ? []
        : room.members
              .filter((member) => presence.typing.includes(member.id))
              .map((member) => member.display_name);
    const seen =
        room.type === "direct" &&
        messages.findLast(
            (message) =>
                message.sender_id === user.id &&
                !message.deleted_at &&
                message.id <= (peer?.last_read_message_id ?? 0),
        );

    useEffect(() => {
        try {
            if (draft) localStorage.setItem(draftKey, draft);
            else localStorage.removeItem(draftKey);
        } catch {
            // Some browsers disable local storage.
        }
    }, [draft, draftKey]);

    useEffect(() => {
        function mark() {
            if (
                loading ||
                !atBottom ||
                document.hidden ||
                (!visible && window.innerWidth <= 700) ||
                latestId <=
                    Math.max(room.last_read_message_id ?? 0, readTarget.current)
            )
                return;
            readTarget.current = latestId;
            onRead(latestId).catch(() => {
                if (readTarget.current === latestId) readTarget.current = 0;
            });
        }
        mark();
        document.addEventListener("visibilitychange", mark);
        return () => document.removeEventListener("visibilitychange", mark);
    }, [
        latestId,
        atBottom,
        loading,
        visible,
        room.last_read_message_id,
        onRead,
    ]);

    async function loadOlder() {
        if (!older || olderRequest.current === older) return;
        olderRequest.current = older;
        beforeHeight.current = list.current.scrollHeight;
        pinBottom.current = false;
        try {
            await onOlder();
        } catch {
            beforeHeight.current = null;
        } finally {
            olderRequest.current = null;
        }
    }

    function startReply(message) {
        setReply(message);
        composerInput.current?.focus();
    }

    async function reactTo(message, emoji) {
        try {
            await onReact(message.id, emoji);
            setReactionTarget(null);
        } catch (error) {
            setImageNotice({
                title: "Không thể thả cảm xúc",
                message: error.message,
            });
        }
    }

    useLayoutEffect(() => {
        const element = list.current;
        if (beforeHeight.current !== null) {
            element.scrollTop += element.scrollHeight - beforeHeight.current;
            beforeHeight.current = null;
        } else if (pinBottom.current) {
            element.scrollTop = element.scrollHeight;
        }
        if (!loading) seenLatest.current = latestId;
    }, [messages, loading, latestId]);

    async function send(event) {
        event.preventDefault();
        if (
            (!draft.trim() && !attachment) ||
            sending ||
            room.blocked ||
            (attachment && !cropped)
        )
            return;
        setSending(true);
        setError("");
        try {
            pinBottom.current = true;
            await onSend(draft.trim(), attachment, reply?.id);
            setDraft("");
            setAttachment(null);
            setReply(null);
        } catch (error) {
            if (attachment || error.status === 429) {
                setImageNotice({
                    title: attachment
                        ? "Không thể gửi ảnh"
                        : "Không thể gửi tin nhắn",
                    message: error.message,
                });
            } else {
                setError(error.message);
            }
        } finally {
            setSending(false);
        }
    }

    return (
        <section className="conversation" ref={motionScope} data-motion-scope>
            <header className="conversation-header" data-motion>
                <span className="mobile-back">
                    <IconButton label="Danh sách trò chuyện" onClick={goBack}>
                        <ArrowLeft size={20} />
                    </IconButton>
                </span>
                <Avatar
                    name={name}
                    src={peer?.avatar_url}
                    group={room.type === "group"}
                    size="medium"
                />
                <div>
                    <h2>{name}</h2>
                    <p>
                        <MemberStatus
                            member={peer}
                            presence={presence}
                            blocked={room.blocked}
                            groupCount={
                                room.type === "group"
                                    ? room.members.length
                                    : null
                            }
                        />
                    </p>
                </div>
                <IconButton
                    label={
                        favorite
                            ? "Bỏ yêu thích cuộc trò chuyện"
                            : "Yêu thích cuộc trò chuyện"
                    }
                    aria-pressed={favorite}
                    onClick={onFavorite}
                >
                    <Star />
                </IconButton>
                <IconButton
                    label="Tìm trong cuộc trò chuyện"
                    onClick={() => setSearchOpen(true)}
                >
                    <Search />
                </IconButton>
                <IconButton
                    label={details ? "Ẩn thông tin" : "Xem thông tin"}
                    onClick={onDetails}
                    aria-pressed={details}
                >
                    <PanelRight size={20} />
                </IconButton>
            </header>
            <div className="timeline-wrap">
                <div
                    className="timeline"
                    ref={list}
                    onScroll={() => {
                        const element = list.current;
                        pinBottom.current =
                            element.scrollHeight -
                                element.scrollTop -
                                element.clientHeight <
                            64;
                        setAtBottom(pinBottom.current);
                        if (element.scrollTop <= 32) loadOlder();
                    }}
                >
                    <div className="timeline-inner">
                        {older && (
                            <button
                                className="history-button"
                                onClick={loadOlder}
                            >
                                Tải tin nhắn cũ hơn
                            </button>
                        )}
                        {loading && (
                            <p className="timeline-empty">Đang tải tin nhắn…</p>
                        )}
                        {!loading && messages.length === 0 && (
                            <p className="timeline-empty">Chưa có tin nhắn</p>
                        )}
                        {messages.map((message, index) => {
                            const date = asDate(message.created_at);
                            const previous = messages[index - 1];
                            const newDay =
                                !previous ||
                                day.format(asDate(previous.created_at)) !==
                                    day.format(date);
                            const own = message.sender_id === user.id;
                            const quote =
                                messageById.get(message.reply_to_id) ??
                                message.reply;
                            const grouped =
                                !newDay &&
                                previous.sender_id === message.sender_id &&
                                date - asDate(previous.created_at) < 300000;
                            return (
                                <div key={message.id}>
                                    {newDay && (
                                        <div className="date-line">
                                            <span>{day.format(date)}</span>
                                        </div>
                                    )}
                                    <div
                                        className={`message ${own ? "own" : ""} ${grouped ? "grouped" : ""} ${arrivals && message.id > seenLatest.current ? "message-arrived" : ""}`}
                                    >
                                        {!own && (
                                            <div className="message-avatar">
                                                {!grouped && (
                                                    <Avatar
                                                        name={
                                                            message.sender_name
                                                        }
                                                        size="small"
                                                        src={
                                                            message.sender_avatar_url
                                                        }
                                                    />
                                                )}
                                            </div>
                                        )}
                                        <div className="message-body">
                                            {!grouped && (
                                                <div className="message-meta">
                                                    <strong>
                                                        {own
                                                            ? "Bạn"
                                                            : message.sender_name}
                                                    </strong>
                                                    <time
                                                        dateTime={date.toISOString()}
                                                    >
                                                        {clock.format(date)}
                                                    </time>
                                                </div>
                                            )}
                                            {message.deleted_at ? (
                                                <p className="bubble deleted-message">
                                                    Tin nhắn đã bị xóa
                                                </p>
                                            ) : (
                                                <div className="message-content">
                                                    {quote && (
                                                        <blockquote className="message-quote">
                                                            <strong>
                                                                {
                                                                    quote.sender_name
                                                                }
                                                            </strong>
                                                            <span>
                                                                {describeMessage(
                                                                    quote,
                                                                )}
                                                            </span>
                                                        </blockquote>
                                                    )}
                                                    {message.image_url && (
                                                        <button
                                                            type="button"
                                                            className="chat-image"
                                                            aria-label="Xem ảnh đính kèm"
                                                            onClick={() =>
                                                                setViewer(
                                                                    message.id,
                                                                )
                                                            }
                                                        >
                                                            <img
                                                                src={
                                                                    message.thumbnail_url ??
                                                                    message.image_url
                                                                }
                                                                alt="Ảnh đính kèm"
                                                                loading="lazy"
                                                            />
                                                        </button>
                                                    )}
                                                    {message.content && (
                                                        <div className="bubble">
                                                            {message.content}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {message.edited_at &&
                                                !message.deleted_at && (
                                                    <small className="edited-marker">
                                                        Đã chỉnh sửa
                                                    </small>
                                                )}
                                            {!message.deleted_at &&
                                                message.reactions?.length >
                                                    0 && (
                                                    <div className="message-reactions">
                                                        {message.reactions.map(
                                                            (reaction) => (
                                                                <button
                                                                    type="button"
                                                                    key={
                                                                        reaction.emoji
                                                                    }
                                                                    className="reaction-button"
                                                                    aria-label={`${reaction.emoji}, ${reaction.count} cảm xúc`}
                                                                    disabled={
                                                                        room.blocked
                                                                    }
                                                                    aria-pressed={reaction.user_ids.includes(
                                                                        user.id,
                                                                    )}
                                                                    onClick={() =>
                                                                        reactTo(
                                                                            message,
                                                                            reaction.emoji,
                                                                        )
                                                                    }
                                                                >
                                                                    {
                                                                        reaction.emoji
                                                                    }{" "}
                                                                    {
                                                                        reaction.count
                                                                    }
                                                                </button>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            {seen?.id === message.id && (
                                                <small className="edited-marker">
                                                    Đã xem
                                                </small>
                                            )}
                                        </div>
                                        {!message.deleted_at && (
                                            <div className="message-action">
                                                {!own && (
                                                    <IconButton
                                                        label="Báo cáo tin nhắn"
                                                        onClick={() =>
                                                            setReportTarget(
                                                                message,
                                                            )
                                                        }
                                                    >
                                                        <Flag />
                                                    </IconButton>
                                                )}
                                                {!room.blocked && (
                                                    <>
                                                        <IconButton
                                                            label="Trả lời tin nhắn"
                                                            onClick={() =>
                                                                startReply(
                                                                    message,
                                                                )
                                                            }
                                                        >
                                                            <Reply />
                                                        </IconButton>
                                                        <IconButton
                                                            label="Thả cảm xúc"
                                                            aria-expanded={
                                                                reactionTarget ===
                                                                message.id
                                                            }
                                                            onClick={() =>
                                                                setReactionTarget(
                                                                    (
                                                                        current,
                                                                    ) =>
                                                                        current ===
                                                                        message.id
                                                                            ? null
                                                                            : message.id,
                                                                )
                                                            }
                                                        >
                                                            <SmilePlus />
                                                        </IconButton>
                                                    </>
                                                )}
                                                {reactionTarget ===
                                                    message.id &&
                                                    !room.blocked && (
                                                        <div
                                                            className="reaction-picker"
                                                            aria-label="Chọn cảm xúc"
                                                        >
                                                            {reactionEmojis.map(
                                                                (emoji) => (
                                                                    <button
                                                                        type="button"
                                                                        key={
                                                                            emoji
                                                                        }
                                                                        onClick={() =>
                                                                            reactTo(
                                                                                message,
                                                                                emoji,
                                                                            )
                                                                        }
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ),
                                                            )}
                                                        </div>
                                                    )}
                                                {own && (
                                                    <IconButton
                                                        label="Sửa hoặc xóa tin nhắn"
                                                        onClick={() =>
                                                            setEditor(message)
                                                        }
                                                    >
                                                        <Pencil />
                                                    </IconButton>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {!atBottom && (
                    <button
                        className="jump"
                        onClick={() => {
                            list.current.scrollTop = list.current.scrollHeight;
                        }}
                        aria-label="Đến tin nhắn mới nhất"
                    >
                        <ArrowDown size={18} />
                    </button>
                )}
            </div>
            <form className="composer" onSubmit={send} data-motion>
                {activeTypists.length > 0 && (
                    <p className="typing-status" role="status">
                        {activeTypists.join(", ")} đang soạn tin…
                    </p>
                )}
                {room.blocked && (
                    <p className="blocked-composer">
                        Chat riêng đang bị chặn. Bạn có thể xem lịch sử hội
                        thoại.
                    </p>
                )}
                {reply && !room.blocked && (
                    <div className="composer-reply">
                        <Reply />
                        <div>
                            <strong>Trả lời {reply.sender_name}</strong>
                            <span>
                                {describeMessage(
                                    messageById.get(reply.id) ?? reply,
                                )}
                            </span>
                        </div>
                        <IconButton
                            label="Bỏ trích dẫn"
                            onClick={() => setReply(null)}
                        >
                            <X />
                        </IconButton>
                    </div>
                )}
                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}
                {attachment && !room.blocked && (
                    <div className="attachment-preview">
                        {attachmentUrl && (
                            <img src={attachmentUrl} alt="Ảnh chuẩn bị gửi" />
                        )}
                        <span>
                            {cropped ? attachment.name : "Cắt ảnh vuông để gửi"}
                        </span>
                        <IconButton
                            label="Cắt ảnh"
                            disabled={sending || room.blocked}
                            onClick={() => setCropping(true)}
                        >
                            <Crop />
                        </IconButton>
                        <IconButton
                            label="Bỏ ảnh"
                            disabled={sending || room.blocked}
                            onClick={() => setAttachment(null)}
                        >
                            <X />
                        </IconButton>
                    </div>
                )}
                <div className="composer-box">
                    <label
                        className="file-picker attach-button"
                        title="Đính kèm ảnh"
                    >
                        <ImagePlus />
                        <input
                            aria-label="Đính kèm ảnh"
                            type="file"
                            accept={imageTypes}
                            disabled={sending}
                            onChange={(event) => {
                                const file = event.target.files[0];
                                event.target.value = "";
                                if (!file) return;
                                try {
                                    validateImage(file);
                                    setAttachment(file);
                                    setCropped(false);
                                    setCropping(true);
                                    setError("");
                                } catch (error) {
                                    setImageNotice({
                                        title: "Không thể chọn ảnh",
                                        message: error.message,
                                    });
                                }
                            }}
                        />
                    </label>
                    <textarea
                        ref={composerInput}
                        rows="1"
                        maxLength={4000}
                        value={draft}
                        onChange={(event) => {
                            setDraft(event.target.value);
                            if (event.target.value.trim()) presence.whisper();
                        }}
                        disabled={room.blocked}
                        aria-label="Tin nhắn"
                        placeholder="Viết tin nhắn"
                        onKeyDown={(event) => {
                            if (
                                event.key === "Enter" &&
                                !event.shiftKey &&
                                !event.nativeEvent.isComposing
                            ) {
                                event.preventDefault();
                                event.currentTarget.form.requestSubmit();
                            }
                        }}
                    />
                    <button
                        type="submit"
                        aria-label="Gửi tin nhắn"
                        disabled={
                            sending ||
                            room.blocked ||
                            (attachment && !cropped) ||
                            (!draft.trim() && !attachment)
                        }
                    >
                        <Send size={19} />
                    </button>
                </div>
                <span className="composer-hint">
                    <kbd>Enter</kbd> để gửi <kbd>Shift</kbd> + <kbd>Enter</kbd>{" "}
                    để xuống dòng
                </span>
            </form>
            {editor && (
                <EditMessageDialog
                    message={editor}
                    onClose={() => setEditor(null)}
                    onChange={async (method, content) => {
                        await onChangeMessage(editor.id, method, content);
                        setEditor(null);
                    }}
                />
            )}
            {reportTarget && (
                <ReportDialog
                    message={reportTarget}
                    roomId={room.id}
                    api={api}
                    onClose={() => setReportTarget(null)}
                />
            )}
            {cropping && attachment && (
                <CropDialog
                    file={attachment}
                    onClose={() => setCropping(false)}
                    onSave={(file) => {
                        setAttachment(file);
                        setCropped(true);
                        setCropping(false);
                    }}
                />
            )}
            {viewedImage && (
                <ImageViewer
                    url={viewedImage}
                    onClose={() => setViewer(null)}
                />
            )}
            {imageNotice && (
                <NoticeDialog
                    {...imageNotice}
                    onClose={() => setImageNotice(null)}
                />
            )}
            {searchOpen && (
                <RoomSearchDialog
                    roomId={room.id}
                    api={api}
                    onClose={() => setSearchOpen(false)}
                />
            )}
        </section>
    );
}

const blankHistory = { messages: [], next_before: null };

function Workspace({ user, onLogout, onProfile }) {
    const motionScope = useRef(null);
    useInterfaceMotion(motionScope, user.id);
    const [preferences, updatePreferences] = useInterfacePreferences(user.id);
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [rooms, setRooms] = useState([]);
    const [relationships, setRelationships] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const [history, setHistory] = useState({});
    const [filter, setFilter] = useState("all");
    const [query, setQuery] = useState("");
    const [details, setDetails] = useState(false);
    const detailsPanel = useRef(null);
    const detailsBackdrop = useRef(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [modal, setModal] = useState(null);
    const [roomAction, setRoomAction] = useState(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState("");
    const [initial, setInitial] = useState(true);
    const room = rooms.find((item) => item.id === activeId);
    useDetailsMotion(
        detailsPanel,
        detailsBackdrop,
        details && Boolean(room),
        room?.id,
    );
    useEffect(() => {
        if (!details) return;
        const previousFocus = document.activeElement;
        detailsPanel.current
            ?.querySelector("button")
            ?.focus({ preventScroll: true });
        function closeOnEscape(event) {
            if (
                event.key === "Escape" &&
                !document.querySelector("dialog[open]")
            )
                setDetails(false);
        }
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            window.removeEventListener("keydown", closeOnEscape);
            if (previousFocus?.isConnected)
                previousFocus.focus({ preventScroll: true });
        };
    }, [details]);
    const current = history[activeId] ?? blankHistory;
    const roomsRequest = useRef(0);
    const friendshipsRequest = useRef(0);
    const active = useRef(activeId);
    const echoRef = useRef(null);
    const lastIncoming = useRef(new Map());
    const latestRooms = useRef(rooms);
    const { notify, controls } = useChatNotifications(user.id);
    const presence = useRoomPresence(
        echoRef,
        connected,
        room?.blocked ? null : activeId,
        user.id,
        room?.presence_version,
    );
    active.current = activeId;
    latestRooms.current = rooms;

    async function refreshRooms() {
        const version = ++roomsRequest.current;
        const data = await api("/rooms");
        if (version !== roomsRequest.current) return;
        setRooms(data);
        const allowed = new Set(data.map((item) => String(item.id)));
        setHistory((previous) =>
            Object.keys(previous).every((id) => allowed.has(id))
                ? previous
                : Object.fromEntries(
                      Object.entries(previous).filter(([id]) =>
                          allowed.has(id),
                      ),
                  ),
        );
        setActiveId((id) =>
            data.some((item) => item.id === id) ? id : (data[0]?.id ?? null),
        );
        setInitial(false);
    }

    async function refreshFriendships() {
        const version = ++friendshipsRequest.current;
        const data = await api("/friendships");
        if (version === friendshipsRequest.current) setRelationships(data);
    }

    function addMessages(roomId, messages, before, older = false) {
        setHistory((previous) => {
            const existing = previous[roomId];
            return {
                ...previous,
                [roomId]: {
                    messages: mergeMessages(existing?.messages ?? [], messages),
                    loaded: existing?.loaded || before !== undefined,
                    next_before:
                        older || !existing?.loaded
                            ? before
                            : existing.next_before,
                },
            };
        });
    }

    async function syncMessages(roomId, before) {
        if (!roomId) return;
        const page = await api(
            `/rooms/${roomId}/messages${before ? "?before=" + before : ""}`,
        );
        addMessages(roomId, page.messages, page.next_before, Boolean(before));
    }

    const showError = (error) => setError(error.message);

    useEffect(() => {
        function heartbeat() {
            api("/heartbeat", "POST")
                .then(refreshRooms)
                .catch(() => {});
        }
        heartbeat();
        const timer = setInterval(heartbeat, 40000);
        return () => clearInterval(timer);
    }, [user.id]);

    useEffect(() => {
        refreshRooms().catch(showError);
        refreshFriendships().catch(showError);
        const key = import.meta.env.VITE_REVERB_APP_KEY;
        if (!key) return;
        const tls = import.meta.env.VITE_REVERB_SCHEME === "https";
        window.Pusher = Pusher;
        const echo = new Echo({
            broadcaster: "reverb",
            key,
            wsHost:
                import.meta.env.VITE_REVERB_HOST || window.location.hostname,
            wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
            wssPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
            forceTLS: tls,
            enabledTransports: ["ws", "wss"],
            auth: {
                headers: { "X-CSRF-TOKEN": csrf, Accept: "application/json" },
            },
        });
        echoRef.current = echo;
        const connection = echo.connector.pusher.connection;
        const disconnected = () => setConnected(false);
        connection.bind("state_change", disconnected);
        echo.private(`users.${user.id}.${user.auth_version ?? 0}`)
            .subscribed(() => {
                setConnected(true);
                refreshRooms().catch(showError);
                refreshFriendships().catch(showError);
                syncMessages(active.current).catch(showError);
            })
            .listen(".chat.updated", ({ room_id, message }) => {
                if (message) {
                    addMessages(room_id, [message]);
                    if (
                        !message.revision &&
                        !message.deleted_at &&
                        message.sender_id !== user.id &&
                        message.id > (lastIncoming.current.get(room_id) ?? 0)
                    ) {
                        lastIncoming.current.set(room_id, message.id);
                        const incomingRoom = latestRooms.current.find(
                            (item) => item.id === room_id,
                        );
                        notify({
                            roomId: room_id,
                            roomName:
                                incomingRoom && roomName(incomingRoom, user),
                            senderName: message.sender_name,
                            text: describeMessage(message),
                        });
                    }
                } else if (room_id === active.current) {
                    syncMessages(room_id).catch((error) => {
                        if (error.status !== 403 && error.status !== 404)
                            showError(error);
                    });
                }
                refreshRooms().catch(showError);
            })
            .listen(".friendships.changed", () =>
                refreshFriendships().catch(showError),
            )
            .listen(".blocks.changed", () => {
                refreshRooms().catch(showError);
                refreshFriendships().catch(showError);
            })
            .error(disconnected);
        return () => {
            echoRef.current = null;
            connection.unbind("state_change", disconnected);
            echo.disconnect();
        };
    }, [user.id, user.auth_version, notify]);

    useEffect(() => {
        syncMessages(activeId).catch(showError);
    }, [activeId]);

    useEffect(() => {
        if (connected) return;
        const timer = setInterval(() => {
            refreshRooms().catch(showError);
            refreshFriendships().catch(showError);
            syncMessages(active.current).catch(showError);
        }, 5000);
        return () => clearInterval(timer);
    }, [connected]);

    const visible = rooms.filter(
        (item) =>
            (filter === "all" || filter === item.type) &&
            roomName(item, user)
                .toLocaleLowerCase("vi")
                .includes(query.toLocaleLowerCase("vi").trim()),
    );
    const incomingCount =
        relationships?.filter(
            (item) =>
                item.status === "pending" && item.requested_by !== user.id,
        ).length ?? 0;

    function toggleFavorite(id) {
        updatePreferences({
            favorites: preferences.favorites.includes(id)
                ? preferences.favorites.filter((value) => value !== id)
                : [...preferences.favorites, id],
        });
    }

    useEffect(() => {
        function shortcut(event) {
            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "k"
            ) {
                if (document.querySelector("dialog[open]")) return;
                event.preventDefault();
                setModal("switch");
            }
        }
        window.addEventListener("keydown", shortcut);
        return () => window.removeEventListener("keydown", shortcut);
    }, []);

    function openRoom(id) {
        setActiveId(id);
        setMobileOpen(true);
    }

    async function onRoomDone(id) {
        setModal(null);
        try {
            await refreshRooms();
            openRoom(id);
        } catch (error) {
            showError(error);
        }
    }

    async function chatWithFriend(id) {
        const result = await api("/rooms", "POST", {
            type: "direct",
            members: [id],
        });
        await refreshRooms();
        setFilter("all");
        setQuery("");
        setModal(null);
        openRoom(result.room_id);
    }

    return (
        <main
            ref={motionScope}
            data-motion-scope
            className={`workspace ${details ? "with-details" : ""} ${mobileOpen ? "show-chat" : ""}`}
        >
            <nav className="app-rail" aria-label="Điều hướng chính" data-motion>
                <button
                    className="rail-brand"
                    aria-label="Tất cả trò chuyện"
                    onClick={() => {
                        setFavoritesOnly(false);
                        setFilter("all");
                        setQuery("");
                        setMobileOpen(false);
                    }}
                >
                    <MessageCircle />
                </button>
                <div className="rail-items">
                    <IconButton
                        label="Cuộc trò chuyện"
                        aria-pressed={!favoritesOnly}
                        onClick={() => {
                            setFavoritesOnly(false);
                            setMobileOpen(false);
                        }}
                    >
                        <MessageCircle />
                    </IconButton>
                    <IconButton
                        label="Mở danh sách bạn bè"
                        onClick={() => setModal("friends")}
                    >
                        <Users />
                    </IconButton>
                    <IconButton
                        label="Cuộc trò chuyện yêu thích"
                        aria-pressed={favoritesOnly}
                        onClick={() => {
                            setFavoritesOnly(!favoritesOnly);
                            setMobileOpen(false);
                        }}
                    >
                        <Star />
                    </IconButton>
                </div>
                <div className="rail-bottom">
                    <IconButton
                        label="Chuyển nhanh"
                        onClick={() => setModal("switch")}
                    >
                        <Search />
                    </IconButton>
                    <IconButton
                        label="Tùy chỉnh giao diện"
                        onClick={() => setModal("preferences")}
                    >
                        <Settings2 />
                    </IconButton>
                </div>
            </nav>
            <aside className="sidebar">
                <div className="sidebar-top" data-motion>
                    <Brand />
                    <button
                        className="friends-link"
                        onClick={() => {
                            setModal("friends");
                            refreshFriendships().catch(showError);
                        }}
                    >
                        <Users size={16} /> Bạn bè
                        {incomingCount > 0 && (
                            <span aria-label={`${incomingCount} lời mời mới`}>
                                {incomingCount}
                            </span>
                        )}
                    </button>
                </div>
                <div className="sidebar-heading">
                    <h1>{favoritesOnly ? "Yêu thích" : "Trò chuyện"}</h1>
                    <IconButton
                        label="Tạo cuộc trò chuyện"
                        onClick={() => setModal("new")}
                    >
                        <Plus size={23} />
                    </IconButton>
                </div>
                <div className="sidebar-utilities">
                    <button onClick={() => setModal("switch")}>
                        <Search />
                        <span>Chuyển nhanh</span>
                        <kbd>⌘ / Ctrl K</kbd>
                    </button>
                    <IconButton
                        label="Cuộc trò chuyện yêu thích"
                        aria-pressed={favoritesOnly}
                        onClick={() => setFavoritesOnly(!favoritesOnly)}
                    >
                        <Star />
                    </IconButton>
                    <IconButton
                        label="Tùy chỉnh giao diện"
                        onClick={() => setModal("preferences")}
                    >
                        <Settings2 />
                    </IconButton>
                </div>
                <label className="search">
                    <Search size={17} />
                    <input
                        aria-label="Tìm cuộc trò chuyện"
                        placeholder="Tìm cuộc trò chuyện"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
                <div className="tabs sidebar-tabs">
                    {[
                        ["all", "Tất cả"],
                        ["direct", "Chat riêng"],
                        ["group", "Nhóm"],
                    ].map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            aria-pressed={filter === key}
                            className={filter === key ? "active" : ""}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="room-list" aria-label="Cuộc trò chuyện">
                    {visible
                        .filter(
                            (item) =>
                                !favoritesOnly ||
                                preferences.favorites.includes(item.id),
                        )
                        .map((item) => {
                            const name = roomName(item, user);
                            return (
                                <button
                                    className={`room-row ${item.id === activeId ? "active" : ""}`}
                                    key={item.id}
                                    onClick={() => openRoom(item.id)}
                                    aria-current={item.id === activeId}
                                >
                                    <Avatar
                                        name={name}
                                        group={item.type === "group"}
                                        src={
                                            item.members.find(
                                                (member) =>
                                                    member.id !== user.id,
                                            )?.avatar_url
                                        }
                                    />
                                    <span className="room-copy">
                                        <strong>{name}</strong>
                                        <small>
                                            {item.preview || "Chưa có tin nhắn"}
                                        </small>
                                    </span>
                                    {item.last_message_at && (
                                        <span className="room-row-meta">
                                            <time>
                                                {compact.format(
                                                    asDate(
                                                        item.last_message_at,
                                                    ),
                                                )}
                                            </time>
                                            {item.unread_count > 0 && (
                                                <span
                                                    className="unread-count"
                                                    aria-label={`${item.unread_count} tin chưa đọc`}
                                                >
                                                    {item.unread_count > 99
                                                        ? "99+"
                                                        : item.unread_count}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    {visible.filter(
                        (item) =>
                            !favoritesOnly ||
                            preferences.favorites.includes(item.id),
                    ).length === 0 && (
                        <p className="sidebar-empty">
                            {initial
                                ? "Đang tải…"
                                : favoritesOnly
                                  ? "Bấm ngôi sao trong hội thoại để lưu vào đây"
                                  : "Không có cuộc trò chuyện"}
                        </p>
                    )}
                </div>
                {controls}
                <footer className="account">
                    <button
                        type="button"
                        className="account-profile"
                        aria-label="Chỉnh sửa hồ sơ"
                        onClick={() => setModal("profile")}
                    >
                        <Avatar
                            name={user.display_name}
                            size="medium"
                            src={user.avatar_url}
                        />
                        <span>
                            <strong>{user.display_name}</strong>
                            <small>@{user.username}</small>
                        </span>
                        <Pencil />
                    </button>
                    <IconButton
                        label="Đăng xuất"
                        onClick={async () => {
                            try {
                                await api("/logout", "POST");
                                onLogout();
                            } catch (error) {
                                showError(error);
                            }
                        }}
                    >
                        <LogOut size={17} />
                    </IconButton>
                </footer>
            </aside>
            {room ? (
                <Conversation
                    key={room.id}
                    room={room}
                    user={user}
                    messages={current.messages}
                    older={current.next_before}
                    loading={!current.loaded}
                    visible={mobileOpen}
                    presence={presence}
                    favorite={preferences.favorites.includes(room.id)}
                    onFavorite={() => toggleFavorite(room.id)}
                    onRead={async (id) => {
                        await api(`/rooms/${room.id}/read`, "PATCH", {
                            message_id: id,
                        });
                        refreshRooms().catch(showError);
                    }}
                    onReact={async (id, emoji) => {
                        addMessages(room.id, [
                            await api(
                                `/rooms/${room.id}/messages/${id}/reactions`,
                                "POST",
                                { emoji },
                            ),
                        ]);
                    }}
                    onOlder={async () => {
                        try {
                            await syncMessages(room.id, current.next_before);
                        } catch (error) {
                            showError(error);
                            throw error;
                        }
                    }}
                    onSend={async (content, attachment, replyId) => {
                        const data = new FormData();
                        data.append("content", content);
                        if (attachment) data.append("image", attachment);
                        if (replyId)
                            data.append("reply_to_id", String(replyId));
                        addMessages(room.id, [
                            await api(
                                `/rooms/${room.id}/messages`,
                                "POST",
                                data,
                            ),
                        ]);
                        refreshRooms().catch(showError);
                    }}
                    onChangeMessage={async (id, method, content) => {
                        const data =
                            method === "PATCH" ? { content } : undefined;
                        addMessages(room.id, [
                            await api(
                                `/rooms/${room.id}/messages/${id}`,
                                method,
                                data,
                            ),
                        ]);
                        refreshRooms().catch(showError);
                    }}
                    goBack={() => setMobileOpen(false)}
                    details={details}
                    onDetails={() => setDetails(!details)}
                />
            ) : (
                <section className="main-empty">
                    <h2>Cuộc trò chuyện của bạn</h2>
                    <p>Chọn một phòng hoặc bắt đầu trò chuyện với ai đó.</p>
                    <button className="primary" onClick={() => setModal("new")}>
                        <Plus size={18} /> Trò chuyện mới
                    </button>
                </section>
            )}
            {room && (
                <>
                    <button
                        type="button"
                        ref={detailsBackdrop}
                        className="details-backdrop"
                        aria-label="Đóng bảng thông tin"
                        tabIndex={-1}
                        aria-hidden={!details}
                        onClick={() => setDetails(false)}
                    />
                    <aside
                        className="details"
                        ref={detailsPanel}
                        aria-label="Thông tin cuộc trò chuyện"
                        aria-hidden={!details}
                        inert={!details}
                    >
                        <header>
                            <h2>
                                Thành viên <span>{room.members.length}</span>
                            </h2>
                            <IconButton
                                label="Đóng thông tin"
                                onClick={() => setDetails(false)}
                            >
                                <X size={19} />
                            </IconButton>
                        </header>
                        <div className="detail-identity">
                            <Avatar
                                name={roomName(room, user)}
                                group={room.type === "group"}
                                src={
                                    room.members.find(
                                        (member) => member.id !== user.id,
                                    )?.avatar_url
                                }
                                size="large"
                            />
                            <h3>{roomName(room, user)}</h3>
                            <span>
                                {room.type === "group"
                                    ? "Không gian của nhóm"
                                    : "Cuộc trò chuyện riêng"}
                            </span>
                        </div>
                        <section className="members">
                            <ul>
                                {room.members.map((member) => (
                                    <li key={member.id}>
                                        <Avatar
                                            name={member.display_name}
                                            size="small"
                                            src={
                                                member.id === user.id
                                                    ? user.avatar_url
                                                    : member.avatar_url
                                            }
                                        />
                                        <span>
                                            <strong>
                                                {member.display_name}
                                                {member.id === user.id &&
                                                    " (bạn)"}
                                                {room.type === "group" &&
                                                    member.id ===
                                                        room.created_by && (
                                                        <small className="owner-label">
                                                            Trưởng nhóm
                                                        </small>
                                                    )}
                                            </strong>
                                            {member.id === user.id ||
                                            room.blocked ? (
                                                <small>
                                                    @{member.username}
                                                </small>
                                            ) : (
                                                <small>
                                                    <MemberStatus
                                                        member={member}
                                                        presence={presence}
                                                    />
                                                </small>
                                            )}
                                        </span>
                                        {room.type === "group" &&
                                            room.created_by === user.id &&
                                            member.id !== user.id && (
                                                <MemberActions
                                                    member={member}
                                                    onAction={(
                                                        action,
                                                        member,
                                                    ) =>
                                                        setRoomAction({
                                                            action,
                                                            member,
                                                            roomId: room.id,
                                                        })
                                                    }
                                                />
                                            )}
                                    </li>
                                ))}
                            </ul>
                            {room.type === "group" &&
                                room.created_by === user.id && (
                                    <button
                                        className="invite-button"
                                        onClick={() => setModal("invite")}
                                    >
                                        <UserPlus size={17} /> Thêm thành viên
                                    </button>
                                )}
                            {room.type === "group" && (
                                <GroupActions
                                    room={room}
                                    user={user}
                                    onAction={(action) =>
                                        setRoomAction({
                                            action,
                                            roomId: room.id,
                                        })
                                    }
                                />
                            )}
                            {room.type === "direct" &&
                                (!room.blocked || room.blocked_by_me) && (
                                    <button
                                        className="invite-button"
                                        onClick={() =>
                                            setRoomAction({
                                                action: "block",
                                                roomId: room.id,
                                                member: room.members.find(
                                                    (member) =>
                                                        member.id !== user.id,
                                                ),
                                            })
                                        }
                                    >
                                        <Ban />{" "}
                                        {room.blocked_by_me
                                            ? "Bỏ chặn"
                                            : "Chặn người dùng"}
                                    </button>
                                )}
                        </section>
                        <SharedMedia
                            key={room.id}
                            messages={current.messages}
                            older={current.next_before}
                            loading={!current.loaded}
                            onOlder={async () => {
                                try {
                                    await syncMessages(
                                        room.id,
                                        current.next_before,
                                    );
                                } catch (error) {
                                    showError(error);
                                    throw error;
                                }
                            }}
                        />
                        <div className="connection" role="status">
                            <i className={connected ? "connected" : ""} />
                            {connected
                                ? "Đã kết nối realtime"
                                : "Đang đồng bộ định kỳ"}
                        </div>
                    </aside>
                </>
            )}
            {error && (
                <div className="toast" role="alert">
                    {error}
                    <IconButton
                        label="Ẩn thông báo"
                        onClick={() => setError("")}
                    >
                        <X size={16} />
                    </IconButton>
                </div>
            )}
            {modal === "preferences" ? (
                <PreferencesDialog
                    onAdmin={
                        user.role === "admin" ? () => setModal("admin") : null
                    }
                    preferences={preferences}
                    onChange={updatePreferences}
                    onPassword={() => setModal("password")}
                    onClose={() => setModal(null)}
                />
            ) : modal === "admin" && user.role === "admin" ? (
                <AdminPanel
                    api={api}
                    user={user}
                    onClose={() => setModal("preferences")}
                />
            ) : modal === "password" ? (
                <PasswordDialog
                    onChanged={async () =>
                        onProfile((await api("/session")).user)
                    }
                    api={api}
                    onClose={() => setModal("preferences")}
                />
            ) : modal === "switch" ? (
                <QuickSwitchDialog
                    rooms={rooms}
                    user={user}
                    favorites={preferences.favorites}
                    onClose={() => setModal(null)}
                    onChoose={(id) => {
                        setFavoritesOnly(false);
                        setFilter("all");
                        setQuery("");
                        openRoom(id);
                        setModal(null);
                    }}
                />
            ) : modal === "profile" ? (
                <ProfileDialog
                    user={user}
                    onClose={() => setModal(null)}
                    onSave={async (data) => {
                        onProfile(await api("/profile", "POST", data));
                        setModal(null);
                        refreshRooms().catch(showError);
                    }}
                />
            ) : modal === "friends" ? (
                <FriendsDialog
                    relationships={relationships}
                    user={user}
                    onClose={() => setModal(null)}
                    refresh={refreshFriendships}
                    onChat={chatWithFriend}
                    onBlocks={() => setModal("blocks")}
                />
            ) : modal === "blocks" ? (
                <BlockedUsersDialog
                    api={api}
                    onClose={() => setModal("friends")}
                    onUpdated={() => {
                        refreshRooms().catch(showError);
                        refreshFriendships().catch(showError);
                    }}
                />
            ) : (
                modal && (
                    <PeopleDialog
                        key={modal}
                        mode={modal}
                        room={room}
                        onClose={() => setModal(null)}
                        onDone={onRoomDone}
                    />
                )
            )}
            {roomAction &&
                roomAction.roomId === room?.id &&
                (roomAction.action === "block" ? (
                    <BlockDialog
                        member={roomAction.member}
                        blocked={room.blocked_by_me}
                        api={api}
                        onClose={() => setRoomAction(null)}
                        onUpdated={() => {
                            setRoomAction(null);
                            refreshRooms().catch(showError);
                            refreshFriendships().catch(showError);
                        }}
                    />
                ) : (
                    <RoomManagementDialog
                        room={room}
                        user={user}
                        api={api}
                        action={roomAction.action}
                        member={roomAction.member}
                        onClose={() => setRoomAction(null)}
                        onUpdated={(action) => {
                            setRoomAction(null);
                            if (action === "leave") setMobileOpen(false);
                            refreshRooms().catch(showError);
                        }}
                    />
                ))}
        </main>
    );
}

function App() {
    const [user, setUser] = useState(undefined);
    const [error, setError] = useState("");
    function loadSession() {
        setError("");
        api("/session")
            .then((session) => setUser(session.user))
            .catch((error) => setError(error.message));
    }
    useEffect(() => {
        loadSession();
        window.addEventListener("heyday:session-expired", loadSession);
        return () =>
            window.removeEventListener("heyday:session-expired", loadSession);
    }, []);
    if (user === undefined)
        return (
            <div className="boot">
                <Brand />
                {error ? (
                    <p>
                        {error} <button onClick={loadSession}>Thử lại</button>
                    </p>
                ) : (
                    <p>Đang mở HeyDay…</p>
                )}
            </div>
        );
    return user &&
        !new URLSearchParams(window.location.search).has("reset_token") ? (
        <Workspace
            key={user.id}
            user={user}
            onProfile={setUser}
            onLogout={() => setUser(null)}
        />
    ) : (
        <Login onLogin={setUser} />
    );
}

createRoot(document.getElementById("app")).render(
    <>
        <DialogMotion />
        <App />
    </>,
);
