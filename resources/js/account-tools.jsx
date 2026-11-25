import { useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { MediaDialog, NoticeDialog } from "./chat-dialogs";

function PasswordFields({ current = false }) {
    return (
        <>
            {current && (
                <label>
                    Mật khẩu hiện tại
                    <input
                        name="current_password"
                        type="password"
                        autoComplete="current-password"
                        required
                    />
                </label>
            )}
            <label>
                Mật khẩu mới
                <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    required
                    placeholder="Tối thiểu 8 ký tự"
                />
            </label>
            <label>
                Nhập lại mật khẩu mới
                <input
                    name="password_confirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    required
                />
            </label>
        </>
    );
}

export function RecoveryForm({ api, reset, onBack }) {
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);
    const [done, setDone] = useState(false);
    return (
        <div className="account-recovery">
            <button
                type="button"
                className="text-button recovery-back"
                onClick={onBack}
            >
                <ArrowLeft /> Đăng nhập
            </button>
            <h1>{reset ? "Đặt lại mật khẩu" : "Quên mật khẩu"}</h1>
            <p className="entry-description">
                {reset
                    ? "Chọn mật khẩu mới cho tài khoản HeyDay của bạn."
                    : "Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu."}
            </p>
            <form
                onSubmit={async (event) => {
                    event.preventDefault();
                    if (busy) return;
                    const data = Object.fromEntries(
                        new FormData(event.currentTarget),
                    );
                    setBusy(true);
                    try {
                        if (reset) {
                            if (data.password !== data.password_confirmation)
                                throw new Error("Hai mật khẩu chưa khớp.");
                            data.token = reset.token;
                            data.email = reset.email;
                        }
                        const result = await api(
                            reset ? "/password/reset" : "/password/forgot",
                            "POST",
                            data,
                        );
                        setDone(Boolean(reset));
                        setNotice({
                            title: reset
                                ? "Đã đặt lại mật khẩu"
                                : "Kiểm tra hộp thư",
                            message: result.message,
                        });
                    } catch (error) {
                        setNotice({
                            title: "Chưa thể tiếp tục",
                            message: error.message,
                        });
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                {reset ? (
                    <PasswordFields />
                ) : (
                    <label>
                        Email đăng ký
                        <input
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            maxLength={255}
                        />
                    </label>
                )}
                <button className="primary entry-submit" disabled={busy}>
                    {busy
                        ? "Đang xử lý…"
                        : reset
                          ? "Lưu mật khẩu mới"
                          : "Gửi liên kết"}
                    <ArrowRight />
                </button>
            </form>
            {notice && (
                <NoticeDialog
                    {...notice}
                    onClose={() => {
                        setNotice(null);
                        if (done) onBack();
                    }}
                />
            )}
        </div>
    );
}

export function PasswordDialog({ api, onClose, onChanged }) {
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);
    const [done, setDone] = useState(false);
    return (
        <>
            <MediaDialog title="Đổi mật khẩu" onClose={onClose}>
                <form
                    onSubmit={async (event) => {
                        event.preventDefault();
                        if (busy) return;
                        const data = Object.fromEntries(
                            new FormData(event.currentTarget),
                        );
                        setBusy(true);
                        try {
                            if (data.password !== data.password_confirmation)
                                throw new Error("Hai mật khẩu mới chưa khớp.");
                            const result = await api(
                                "/password/change",
                                "POST",
                                data,
                            );
                            await onChanged();
                            setDone(true);
                            setNotice({
                                title: "Đã đổi mật khẩu",
                                message: result.message,
                            });
                        } catch (error) {
                            setNotice({
                                title: "Chưa thể đổi mật khẩu",
                                message: error.message,
                            });
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <p className="dialog-intro">
                        <LockKeyhole /> Đổi mật khẩu sẽ kết thúc các phiên đăng
                        nhập khác
                    </p>
                    <PasswordFields current />
                    <button className="primary" disabled={busy}>
                        {busy ? "Đang lưu…" : "Lưu mật khẩu mới"}
                    </button>
                </form>
            </MediaDialog>
            {notice && (
                <NoticeDialog
                    {...notice}
                    onClose={() => {
                        setNotice(null);
                        if (done) onClose();
                    }}
                />
            )}
        </>
    );
}
