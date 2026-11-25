import { useEffect, useState } from "react";
import { Flag, ShieldCheck } from "lucide-react";
import { MediaDialog, NoticeDialog } from "./chat-dialogs";
import "../css/enterprise.css";

export function ReportDialog({ message, roomId, api, onClose }) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);
    const [sent, setSent] = useState(false);
    return (
        <>
            <MediaDialog title="Báo cáo tin nhắn" onClose={onClose}>
                <form
                    onSubmit={async (event) => {
                        event.preventDefault();
                        if (busy) return;
                        setBusy(true);
                        try {
                            const result = await api(
                                `/rooms/${roomId}/messages/${message.id}/report`,
                                "POST",
                                { reason },
                            );
                            setSent(true);
                            setNotice({
                                title: "Đã gửi báo cáo",
                                message: result.message,
                            });
                        } catch (error) {
                            setNotice({
                                title: "Chưa thể gửi báo cáo",
                                message: error.message,
                            });
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <p className="dialog-intro">
                        Báo cáo sẽ được chuyển tới quản trị viên để xem xét
                    </p>
                    <label>
                        Lý do
                        <textarea
                            required
                            minLength={5}
                            maxLength={1000}
                            rows="4"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Mô tả nội dung vi phạm…"
                        />
                    </label>
                    <button
                        className="primary"
                        disabled={busy || reason.trim().length < 5}
                    >
                        <Flag /> Gửi báo cáo
                    </button>
                </form>
            </MediaDialog>
            {notice && (
                <NoticeDialog
                    {...notice}
                    onClose={() => {
                        setNotice(null);
                        if (sent) onClose();
                    }}
                />
            )}
        </>
    );
}

const labels = {
    overview: "Tổng quan",
    users: "Tài khoản",
    reports: "Báo cáo",
    audit: "Nhật ký",
};
const actions = {
    suspend: "Khóa tài khoản",
    restore: "Mở khóa",
    make_admin: "Cấp quyền quản trị",
    make_user: "Thu hồi quyền quản trị",
    dismiss: "Đóng báo cáo",
    remove: "Gỡ tin nhắn vi phạm",
};

export function AdminPanel({ api, user, onClose }) {
    const [tab, setTab] = useState("overview");
    const [page, setPage] = useState(1);
    const [query, setQuery] = useState("");
    const [result, setResult] = useState(null);
    const data = result?.tab === tab ? result.payload : null;
    const [error, setError] = useState("");
    const [revision, setRevision] = useState(0);
    const [choice, setChoice] = useState(null);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const request = new AbortController();
        setResult(null);
        setError("");
        const timer = setTimeout(
            () => {
                api(
                    `/admin/${tab}?page=${page}&q=${encodeURIComponent(query)}`,
                    "GET",
                    undefined,
                    request.signal,
                )
                .then((payload) => setResult({ tab, payload }))
                    .catch((error) => {
                        if (!request.signal.aborted) setError(error.message);
                    });
            },
            tab === "users" ? 200 : 0,
        );
        return () => {
            clearTimeout(timer);
            request.abort();
        };
    }, [api, tab, page, query, revision]);

    function choose(record, action) {
        setChoice({ record, action });
        setReason("");
    }

    async function submit(event) {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
            const resource = tab === "users" ? "users" : "reports";
            await api(`/admin/${resource}/${choice.record.id}`, "POST", {
                action: choice.action,
                reason,
                resolution: reason,
            });
            setChoice(null);
            setRevision((current) => current + 1);
        } catch (error) {
            setError(error.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <MediaDialog
            title="Quản trị HeyDay"
            onClose={onClose}
            className="admin-panel"
        >
            <div className="admin-caption">
                <ShieldCheck /> {user.display_name} · Quản trị viên
            </div>
            <nav className="tabs admin-tabs" aria-label="Chức năng quản trị">
                {Object.entries(labels).map(([key, label]) => (
                    <button
                        type="button"
                        key={key}
                        className={key === tab ? "active" : ""}
                        onClick={() => {
                            setTab(key);
                            setPage(1);
                            setChoice(null);
                            setQuery("");
                        }}
                    >
                        {label}
                    </button>
                ))}
            </nav>
            {error && (
                <p className="error" role="alert">
                    {error}
                </p>
            )}
            {tab === "users" && (
                <label>
                    Tìm tài khoản
                    <input
                        aria-label="Tìm tài khoản quản trị"
                        maxLength={100}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(1);
                        }}
                    />
                </label>
            )}
            {!data && !error && <p role="status">Đang tải dữ liệu…</p>}
            {data && tab === "overview" && (
                <div className="admin-stats">
                    {[
                        ["users", "Tài khoản"],
                        ["suspended", "Đang bị khóa"],
                        ["rooms", "Phòng trò chuyện"],
                        ["messages", "Tin nhắn"],
                        ["open_reports", "Báo cáo chờ xử lý"],
                    ].map(([key, label]) => (
                        <div key={key}>
                            <span>{label}</span>
                            <strong>{data[key].toLocaleString("vi-VN")}</strong>
                        </div>
                    ))}
                </div>
            )}
            {data && tab !== "overview" && (
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                {(tab === "users"
                                    ? [
                                          "Tài khoản",
                                          "Email",
                                          "Quyền",
                                          "Trạng thái",
                                          "Thao tác",
                                      ]
                                    : tab === "reports"
                                      ? [
                                            "Người báo cáo",
                                            "Nội dung được báo cáo",
                                            "Lý do",
                                            "Trạng thái",
                                            "Xử lý",
                                        ]
                                      : [
                                            "Thời điểm",
                                            "Người thực hiện",
                                            "Thao tác",
                                            "Đối tượng",
                                        ]
                                ).map((title) => (
                                    <th key={title}>{title}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.data.map((record) => (
                                <tr key={record.id}>
                                    {tab === "users" ? (
                                        <>
                                            <td>
                                                <strong>
                                                    {record.display_name}
                                                </strong>
                                                <small>
                                                    @{record.username}
                                                </small>
                                            </td>
                                            <td>{record.email}</td>
                                            <td>
                                                {record.role === "admin"
                                                    ? "Quản trị viên"
                                                    : "Thành viên"}
                                            </td>
                                            <td>
                                                {record.suspended_at
                                                    ? "Đã khóa"
                                                    : "Hoạt động"}
                                            </td>
                                            <td>
                                                {record.id !== user.id && (
                                                    <div className="admin-actions">
                                                        <button
                                                            className="friend-outline"
                                                            onClick={() =>
                                                                choose(
                                                                    record,
                                                                    record.suspended_at
                                                                        ? "restore"
                                                                        : "suspend",
                                                                )
                                                            }
                                                        >
                                                            {record.suspended_at
                                                                ? "Mở khóa"
                                                                : "Khóa"}
                                                        </button>
                                                        <button
                                                            className="friend-outline"
                                                            onClick={() =>
                                                                choose(
                                                                    record,
                                                                    record.role ===
                                                                        "admin"
                                                                        ? "make_user"
                                                                        : "make_admin",
                                                                )
                                                            }
                                                        >
                                                            {record.role ===
                                                            "admin"
                                                                ? "Thu hồi quyền"
                                                                : "Cấp quyền"}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </>
                                    ) : tab === "reports" ? (
                                        <>
                                            <td>{record.reporter_name}</td>
                                            <td>
                                                <strong>
                                                    {record.sender_name}
                                                </strong>
                                                <p>
                                                    {record.snapshot ||
                                                        "Ảnh đính kèm"}
                                                </p>
                                                {record.image_url && (
                                                    <a
                                                        href={record.image_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-button"
                                                    >
                                                        Xem ảnh được báo cáo
                                                    </a>
                                                )}
                                            </td>
                                            <td>{record.reason}</td>
                                            <td>
                                                {
                                                    {
                                                        open: "Chờ xử lý",
                                                        removed: "Đã gỡ tin",
                                                        dismissed: "Đã đóng",
                                                    }[record.status]
                                                }
                                                <small>
                                                    {record.resolution}
                                                </small>
                                            </td>
                                            <td>
                                                {record.status === "open" && (
                                                    <div className="admin-actions">
                                                        <button
                                                            className="friend-outline"
                                                            onClick={() =>
                                                                choose(
                                                                    record,
                                                                    "dismiss",
                                                                )
                                                            }
                                                        >
                                                            Đóng
                                                        </button>
                                                        <button
                                                            className="friend-outline"
                                                            onClick={() =>
                                                                choose(
                                                                    record,
                                                                    "remove",
                                                                )
                                                            }
                                                        >
                                                            Gỡ tin
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td>{record.created_at}</td>
                                            <td>@{record.actor_username}</td>
                                            <td>
                                                {actions[record.action] ||
                                                    record.action}
                                            </td>
                                            <td>
                                                {record.entity_type} #
                                                {record.entity_id}
                                                <small>
                                                    {(() => {
                                                        try {
                                                            const details =
                                                                typeof record.details ===
                                                                "string"
                                                                    ? JSON.parse(
                                                                          record.details,
                                                                      )
                                                                    : record.details;
                                                            return (
                                                                details.reason ||
                                                                details.resolution
                                                            );
                                                        } catch {
                                                            return "";
                                                        }
                                                    })()}
                                                </small>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data.data.length === 0 && (
                        <p className="friends-empty">Chưa có dữ liệu</p>
                    )}
                </div>
            )}
            {data?.last_page > 1 && (
                <div className="admin-pagination">
                    <button
                        className="friend-outline"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                    >
                        Trước
                    </button>
                    <span>
                        Trang {page}/{data.last_page}
                    </span>
                    <button
                        className="friend-outline"
                        disabled={page >= data.last_page}
                        onClick={() => setPage(page + 1)}
                    >
                        Sau
                    </button>
                </div>
            )}
            {choice && (
                <MediaDialog
                    title={actions[choice.action]}
                    onClose={() => setChoice(null)}
                >
                    <form onSubmit={submit}>
                        <p>
                            {choice.record.display_name ||
                                "Báo cáo #" + choice.record.id}
                        </p>
                        <label>
                            Lý do xử lý
                            <textarea
                                aria-label="Lý do quản trị"
                                required
                                minLength={5}
                                maxLength={1000}
                                value={reason}
                                onChange={(event) =>
                                    setReason(event.target.value)
                                }
                            />
                        </label>
                        {error && (
                            <p className="error" role="alert">
                                {error}
                            </p>
                        )}
                        <button
                            className="primary"
                            disabled={busy || reason.trim().length < 5}
                        >
                            Xác nhận
                        </button>
                    </form>
                </MediaDialog>
            )}
        </MediaDialog>
    );
}
