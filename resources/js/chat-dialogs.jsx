import { useEffect, useId, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { gsap } from "gsap";

function useModalClose(dialog, onClose) {
    const callback = useRef(onClose);
    const tween = useRef(null);
    callback.current = onClose;
    useEffect(() => () => tween.current?.kill(), []);
    return () => {
        if (tween.current) return;
        if (
            !dialog.current ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            callback.current();
            return;
        }
        tween.current = gsap.to(dialog.current, {
            opacity: 0,
            y: 4,
            scale: 0.99,
            duration: 0.12,
            ease: "power2.in",
            overwrite: true,
            onComplete: () => callback.current(),
        });
    };
}

export const imageTypes = "image/jpeg,image/png,image/webp";

export function validateImage(file) {
    if (
        !imageTypes.split(",").includes(file.type) ||
        file.size > 5 * 1024 * 1024
    ) {
        throw new Error("Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.");
    }
}

export function useImagePreview(file) {
    const [url, setUrl] = useState(null);
    useEffect(() => {
        if (!file) {
            setUrl(null);
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);
    return url;
}

export function MediaDialog({ title, onClose, children, className = "" }) {
    const dialog = useRef(null);
    const heading = useRef(null);
    const dismiss = useModalClose(dialog, onClose);
    useEffect(() => {
        dialog.current.showModal();
        heading.current.focus();
    }, []);
    return (
        <dialog
            ref={dialog}
            className={className}
            aria-label={title}
            onCancel={(event) => {
                event.preventDefault();
                dismiss();
            }}
        >
            <header>
                <h2 ref={heading} tabIndex={-1}>
                    {title}
                </h2>
                <button
                    type="button"
                    className="icon-button"
                    aria-label="Đóng"
                    onClick={dismiss}
                >
                    <X />
                </button>
            </header>
            {children}
        </dialog>
    );
}

export function NoticeDialog({ title, message, onClose }) {
    const dialog = useRef(null);
    const titleId = useId();
    const messageId = useId();
    useEffect(() => {
        dialog.current.showModal();
    }, []);

    function dismiss() {
        dialog.current.close();
        onClose();
    }

    return (
        <dialog
            ref={dialog}
            className="notice-dialog"
            role="alertdialog"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            onCancel={(event) => {
                event.preventDefault();
                dismiss();
            }}
        >
            <h2 id={titleId}>{title}</h2>
            <p id={messageId}>{message}</p>
            <button
                type="button"
                className="primary"
                autoFocus
                onClick={dismiss}
            >
                Đã hiểu
            </button>
        </dialog>
    );
}

function ImageCrop({ file, canvas, round = false, onError }) {
    const url = useImagePreview(file);
    const [image, setImage] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [horizontal, setHorizontal] = useState(0);
    const [vertical, setVertical] = useState(0);
    useEffect(() => {
        if (!url) return;
        const source = new Image();
        source.onload = () => setImage(source);
        source.onerror = () =>
            onError("Không đọc được ảnh này. Hãy chọn ảnh khác.");
        source.src = url;
        return () => {
            source.onload = null;
            source.onerror = null;
        };
    }, [url, onError]);

    useEffect(() => {
        if (!image) return;
        const target = canvas.current;
        const context = target.getContext("2d");
        const size = target.width;
        const scale =
            (size * zoom) / Math.min(image.naturalWidth, image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.clearRect(0, 0, size, size);
        context.fillStyle = "#fffefa";
        context.fillRect(0, 0, size, size);
        context.drawImage(
            image,
            ((size - width) * (100 - horizontal)) / 200,
            ((size - height) * (100 - vertical)) / 200,
            width,
            height,
        );
    }, [canvas, image, zoom, horizontal, vertical]);

    return (
        <div className="crop-editor">
            <canvas
                ref={canvas}
                width={round ? 512 : 1024}
                height={round ? 512 : 1024}
                className={round ? "round-crop" : ""}
                aria-label="Xem trước vùng cắt"
                data-ready={Boolean(image)}
            />
            <div className="crop-controls">
                <label>
                    Thu phóng
                    <input
                        type="range"
                        min="1"
                        max="3"
                        step=".05"
                        value={zoom}
                        onChange={(event) =>
                            setZoom(Number(event.target.value))
                        }
                    />
                </label>
                <label>
                    Căn ngang
                    <input
                        type="range"
                        min="-100"
                        max="100"
                        value={horizontal}
                        onChange={(event) =>
                            setHorizontal(Number(event.target.value))
                        }
                    />
                </label>
                <label>
                    Căn dọc
                    <input
                        type="range"
                        min="-100"
                        max="100"
                        value={vertical}
                        onChange={(event) =>
                            setVertical(Number(event.target.value))
                        }
                    />
                </label>
            </div>
        </div>
    );
}

async function exportImage(canvas) {
    if (canvas?.dataset.ready !== "true") throw new Error("Ảnh chưa sẵn sàng.");
    const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) throw new Error("Không thể cắt ảnh này.");
    return new File([blob], "anh-da-cat.jpg", { type: "image/jpeg" });
}

export function ProfileDialog({ user, onClose, onSave }) {
    const [name, setName] = useState(user.display_name);
    const [selection, setSelection] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [errorTitle, setErrorTitle] = useState("Không thể chọn ảnh");
    const canvas = useRef(null);
    return (
        <>
            <MediaDialog title="Hồ sơ của bạn" onClose={onClose}>
                <form
                    onSubmit={async (event) => {
                        event.preventDefault();
                        if (busy) return;
                        setBusy(true);
                        setError("");
                        try {
                            const data = new FormData();
                            data.append("display_name", name.trim());
                            if (selection)
                                data.append(
                                    "avatar",
                                    await exportImage(canvas.current),
                                );
                            await onSave(data);
                        } catch (error) {
                            setErrorTitle("Không thể lưu hồ sơ");
                            setError(error.message);
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <label>
                        Tên hiển thị
                        <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            maxLength={100}
                            required
                        />
                    </label>
                    {!selection && user.avatar_url && (
                        <img
                            className="profile-preview"
                            src={user.avatar_url}
                            alt="Ảnh đại diện hiện tại"
                        />
                    )}
                    <label className="file-picker">
                        <Camera /> Chọn ảnh đại diện
                        <input
                            type="file"
                            accept={imageTypes}
                            onChange={(event) => {
                                const file = event.target.files[0];
                                event.target.value = "";
                                if (!file) return;
                                setErrorTitle("Không thể chọn ảnh");
                                try {
                                    validateImage(file);
                                    setSelection((old) => ({
                                        file,
                                        key: (old?.key ?? 0) + 1,
                                    }));
                                    setError("");
                                } catch (error) {
                                    setError(error.message);
                                }
                            }}
                        />
                    </label>
                    {selection && (
                        <ImageCrop
                            key={selection.key}
                            file={selection.file}
                            canvas={canvas}
                            onError={setError}
                            round
                        />
                    )}
                    <button className="primary" disabled={busy || !name.trim()}>
                        {busy ? "Đang lưu…" : "Lưu hồ sơ"}
                    </button>
                </form>
            </MediaDialog>
            {error && (
                <NoticeDialog
                    title={errorTitle}
                    message={error}
                    onClose={() => setError("")}
                />
            )}
        </>
    );
}

export function CropDialog({ file, onClose, onSave }) {
    const canvas = useRef(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    return (
        <>
            <MediaDialog title="Cắt ảnh đính kèm" onClose={onClose}>
                <ImageCrop file={file} canvas={canvas} onError={setError} />
                <button
                    className="primary"
                    disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        try {
                            onSave(await exportImage(canvas.current));
                        } catch (error) {
                            setError(error.message);
                            setBusy(false);
                        }
                    }}
                >
                    Dùng ảnh đã cắt
                </button>
            </MediaDialog>
            {error && (
                <NoticeDialog
                    title="Không thể cắt ảnh"
                    message={error}
                    onClose={() => setError("")}
                />
            )}
        </>
    );
}

export function ImageViewer({ url, onClose }) {
    return (
        <MediaDialog
            title="Ảnh trong cuộc trò chuyện"
            className="image-viewer"
            onClose={onClose}
        >
            <img src={url} alt="Ảnh đính kèm ở kích thước lớn" />
        </MediaDialog>
    );
}

export function EditMessageDialog({ message, onClose, onChange }) {
    const [content, setContent] = useState(message.content);
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit(method) {
        if (busy) return;
        setBusy(true);
        try {
            await onChange(method, content.trim());
        } catch (error) {
            setError(error.message);
            setBusy(false);
        }
    }

    return (
        <MediaDialog
            title={confirm ? "Xóa tin nhắn" : "Sửa tin nhắn"}
            onClose={onClose}
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    submit(confirm ? "DELETE" : "PATCH");
                }}
            >
                {confirm ? (
                    <p>Tin nhắn sẽ bị xóa với mọi thành viên trong phòng.</p>
                ) : (
                    <label>
                        Nội dung
                        <textarea
                            rows="3"
                            maxLength={4000}
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                        />
                    </label>
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
                        disabled={busy}
                        onClick={() => setConfirm(!confirm)}
                    >
                        {confirm ? "Quay lại" : "Xóa tin nhắn"}
                    </button>
                    <button
                        className={confirm ? "primary danger" : "primary"}
                        disabled={
                            busy ||
                            (!confirm &&
                                (!content.trim() ||
                                    content.trim() === message.content))
                        }
                    >
                        {confirm ? "Xóa với mọi người" : "Lưu thay đổi"}
                    </button>
                </div>
            </form>
        </MediaDialog>
    );
}
