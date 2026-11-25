import { useEffect, useState } from "react";
import { Check, LogOut, Search, Shield, UserMinus } from "lucide-react";
import { MediaDialog } from "./chat-dialogs";
import "../css/room-tools.css";

export const reactionEmojis = ["👍", "❤️", "😂", "😮", "😢"];

export function describeMessage(message) {
    if (message.deleted_at) return "Tin nhắn đã bị xóa";
    return message.content || (message.image_url ? "Ảnh đính kèm" : "Tin nhắn");
}

export function RoomSearchDialog({ roomId, api, onClose }) {
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(null);
    const [waiting, setWaiting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        setPage(null);
        setError("");
        if (!query.trim()) {
            setWaiting(false);
            return;
        }
        setWaiting(true);
        const request = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const result = await api(
                    `/rooms/${roomId}/search?q=${encodeURIComponent(query.trim())}`,
                    "GET",
                    undefined,
                    request.signal,
                );
                if (!request.signal.aborted) setPage(result);
            } catch (error) {
                if (!request.signal.aborted) setError(error.message);
            } finally {
                if (!request.signal.aborted) setWaiting(false);
            }
        }, 240);
        return () => {
            clearTimeout(timer);
            request.abort();
        };
    }, [api, query, roomId]);

    async function loadMore() {
        setWaiting(true);
        try {
            const result = await api(
                `/rooms/${roomId}/search?q=${encodeURIComponent(query.trim())}&before=${page.next_before}`,
            );
            setPage((current) =>
                current === page
                    ? {
                          ...result,
                          messages: [...current.messages, ...result.messages],
                      }
                    : current,
            );
        } catch (error) {
            setError(error.message);
        } finally {
            setWaiting(false);
        }
    }

    return (
        <MediaDialog
            title="Tìm trong cuộc trò chuyện"
            onClose={onClose}
            className="room-tool-dialog"
        >
            <label className="search room-tool-search">
                <Search />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nhập từ khóa"
                    aria-label="Tìm nội dung tin nhắn"
                    maxLength={100}
                />
            </label>
            {error ? (
                <p className="error" role="alert">
                    {error}
                </p>
            ) : waiting && !page ? (
                <p role="status">Đang tìm…</p>
            ) : page?.messages.length === 0 ? (
                <p role="status">Không tìm thấy tin nhắn</p>
            ) : null}
            {page && (
                <ul className="room-search-results">
                    {page.messages.map((message) => (
                        <li key={message.id}>
                            <header>
                                <strong>{message.sender_name}</strong>
                                <time>
                                    {new Date(
                                        message.created_at.replace(" ", "T") +
                                            "Z",
                                    ).toLocaleString("vi-VN")}
                                </time>
                            </header>
                            <p>{describeMessage(message)}</p>
                        </li>
                    ))}
                </ul>
            )}
            {page?.next_before && (
                <button
                    className="friend-outline"
                    onClick={loadMore}
                    disabled={waiting}
                >
                    Xem thêm kết quả
                </button>
            )}
        </MediaDialog>
    );
}

export function RoomManagementDialog({
    room,
    user,
    action,
    member,
    api,
    onClose,
    onUpdated,
}) {
    const [name, setName] = useState(room.name ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const owner = room.created_by === user.id;
    const titles = {
        rename: "Đổi tên nhóm",
        leave: "Rời nhóm",
        kick: "Xóa thành viên",
        transfer: "Chuyển quyền trưởng nhóm",
    };
    const descriptions = {
        leave:
            owner && room.members.length > 1
                ? "Hãy chuyển quyền trưởng nhóm cho một thành viên trước khi rời."
                : `Rời nhóm ${room.name}?`,
        kick: `Xóa ${member?.display_name} khỏi nhóm?`,
        transfer: `Chuyển quyền trưởng nhóm cho ${member?.display_name}?`,
    };

    async function submit(event) {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            if (action === "rename")
                await api(`/rooms/${room.id}`, "PATCH", { name: name.trim() });
            else if (action === "transfer")
                await api(`/rooms/${room.id}/owner`, "PATCH", {
                    user_id: member.id,
                });
            else
                await api(
                    `/rooms/${room.id}/members/${action === "leave" ? user.id : member.id}`,
                    "DELETE",
                );
            onUpdated(action);
        } catch (error) {
            setError(error.message);
            setBusy(false);
        }
    }

    return (
        <MediaDialog
            title={titles[action]}
            onClose={onClose}
            className="room-tool-dialog"
        >
            <form onSubmit={submit}>
                {action === "rename" ? (
                    <label>
                        Tên nhóm
                        <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                            maxLength={100}
                        />
                    </label>
                ) : (
                    <p>{descriptions[action]}</p>
                )}
                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}
                <div className="message-dialog-actions">
                    <button
                        type="button"
                        className="friend-outline"
                        onClick={onClose}
                    >
                        Quay lại
                    </button>
                    <button
                        className={
                            action === "leave" || action === "kick"
                                ? "primary danger"
                                : "primary"
                        }
                        disabled={
                            busy ||
                            (action === "rename" && !name.trim()) ||
                            (action === "leave" &&
                                owner &&
                                room.members.length > 1)
                        }
                    >
                        {action === "leave"
                            ? "Rời nhóm"
                            : action === "kick"
                              ? "Xóa thành viên"
                              : "Lưu thay đổi"}
                    </button>
                </div>
            </form>
        </MediaDialog>
    );
}

export function GroupActions({ room, user, onAction }) {
    return (
        <div className="group-actions">
            {room.created_by === user.id && (
                <button
                    onClick={() => onAction("rename")}
                    className="friend-outline"
                >
                    Đổi tên nhóm
                </button>
            )}
            <button
                onClick={() => onAction("leave")}
                className="friend-outline"
            >
                <LogOut /> Rời nhóm
            </button>
        </div>
    );
}

export function MemberActions({ member, onAction }) {
    return (
        <details className="member-actions">
            <summary aria-label={`Quản lý ${member.display_name}`}>
                <Shield />
            </summary>
            <div>
                <button
                    className="friend-outline"
                    onClick={() => onAction("transfer", member)}
                >
                    <Check /> Chuyển quyền
                </button>
                <button
                    className="friend-outline"
                    onClick={() => onAction("kick", member)}
                >
                    <UserMinus /> Xóa khỏi nhóm
                </button>
            </div>
        </details>
    );
}

export function BlockDialog({ member, blocked, api, onClose, onUpdated }) {
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    return (
        <MediaDialog
            title={blocked ? "Bỏ chặn người dùng" : "Chặn người dùng"}
            onClose={onClose}
        >
            <form
                onSubmit={async (event) => {
                    event.preventDefault();
                    if (busy) return;
                    setBusy(true);
                    try {
                        if (blocked)
                            await api(`/blocks/${member.id}`, "DELETE");
                        else
                            await api("/blocks", "POST", {
                                user_id: member.id,
                            });
                        onUpdated();
                    } catch (error) {
                        setError(error.message);
                        setBusy(false);
                    }
                }}
            >
                <p>
                    {blocked
                        ? `Bỏ chặn ${member.display_name}?`
                        : `Chặn ${member.display_name} sẽ ngừng chat riêng và lời mời kết bạn giữa hai người.`}
                </p>
                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}
                <div className="message-dialog-actions">
                    <button
                        type="button"
                        className="friend-outline"
                        onClick={onClose}
                    >
                        Quay lại
                    </button>
                    <button
                        className={blocked ? "primary" : "primary danger"}
                        disabled={busy}
                    >
                        {blocked ? "Bỏ chặn" : "Chặn"}
                    </button>
                </div>
            </form>
        </MediaDialog>
    );
}

export function BlockedUsersDialog({ api, onClose, onUpdated }) {
    const [users, setUsers] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(null);
    useEffect(() => {
        const request = new AbortController();
        api("/blocks", "GET", undefined, request.signal)
            .then(setUsers)
            .catch((error) => {
                if (!request.signal.aborted) setError(error.message);
            });
        return () => request.abort();
    }, [api]);
    return (
        <MediaDialog
            title="Tài khoản đã chặn"
            onClose={onClose}
            className="room-tool-dialog"
        >
            {error && (
                <p className="error" role="alert">
                    {error}
                </p>
            )}
            {!users && !error && <p role="status">Đang tải…</p>}
            {users?.length === 0 && <p>Chưa chặn tài khoản nào</p>}
            <ul className="friends-list">
                {users?.map((user) => (
                    <li key={user.id} className="blocked-user">
                        <span>
                            <strong>{user.display_name}</strong>
                            <small>@{user.username}</small>
                        </span>
                        <button
                            className="friend-outline"
                            disabled={busy !== null}
                            onClick={async () => {
                                setBusy(user.id);
                                setError("");
                                try {
                                    await api(`/blocks/${user.id}`, "DELETE");
                                    setUsers((current) =>
                                        current.filter(
                                            (item) => item.id !== user.id,
                                        ),
                                    );
                                    onUpdated();
                                } catch (error) {
                                    setError(error.message);
                                } finally {
                                    setBusy(null);
                                }
                            }}
                        >
                            Bỏ chặn
                        </button>
                    </li>
                ))}
            </ul>
        </MediaDialog>
    );
}
