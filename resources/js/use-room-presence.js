import { useEffect, useRef, useState } from "react";

export function useRoomPresence(echo, connected, roomId, userId, version) {
    const [presence, setPresence] = useState({
        roomId: null,
        members: [],
        typists: [],
    });
    const active = useRef(null);

    useEffect(() => {
        if (!connected || !roomId || !echo.current) return;
        const client = echo.current;
        const name = `room-presence.${roomId}.${version ?? 0}`;
        const timers = new Map();
        let disposed = false;
        let lastTyping = 0;
        const update = (apply) => {
            if (!disposed)
                setPresence((current) =>
                    apply(
                        current.roomId === roomId
                            ? current
                            : { roomId, members: [], typists: [] },
                    ),
                );
        };

        const channel = client
            .join(name)
            .here((members) =>
                update((current) => ({
                    ...current,
                    members: members.map((member) => Number(member.id)),
                })),
            )
            .joining((member) =>
                update((current) => ({
                    ...current,
                    members: [
                        ...new Set([...current.members, Number(member.id)]),
                    ],
                })),
            )
            .leaving((member) =>
                update((current) => ({
                    ...current,
                    members: current.members.filter(
                        (id) => id !== Number(member.id),
                    ),
                })),
            )
            .listenForWhisper("typing", (event, metadata) => {
                const id = Number(metadata?.user_id);
                if (!Number.isSafeInteger(id) || id === userId) return;
                clearTimeout(timers.get(id));
                update((current) => ({
                    ...current,
                    typists: [...new Set([...current.typists, id])],
                }));
                timers.set(
                    id,
                    setTimeout(() => {
                        timers.delete(id);
                        update((current) => ({
                            ...current,
                            typists: current.typists.filter(
                                (typing) => typing !== id,
                            ),
                        }));
                    }, 3200),
                );
            });

        active.current = () => {
            if (
                !channel.subscription?.subscribed ||
                Date.now() - lastTyping < 1900
            )
                return;
            lastTyping = Date.now();
            channel.whisper("typing", {});
        };

        return () => {
            active.current = null;
            disposed = true;
            timers.forEach(clearTimeout);
            client.leave(name);
        };
    }, [echo, connected, roomId, userId, version]);

    return {
        online: connected && presence.roomId === roomId ? presence.members : [],
        typing: connected && presence.roomId === roomId ? presence.typists : [],
        whisper: () => active.current?.(),
    };
}
