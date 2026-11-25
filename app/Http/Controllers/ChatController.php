<?php

namespace App\Http\Controllers;

use App\Events\ChatUpdated;
use App\Models\User;
use App\Support\ChatThumbnails;
use App\Support\UserBlocks;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class ChatController extends Controller
{
    public function users(Request $request)
    {
        $query = $request->validate(['q' => ['nullable', 'string', 'max:100']])['q'] ?? '';
        $pattern = $this->searchPattern(ltrim($query, '@'));
        $id = $request->user()->id;
        $users = DB::table('users')->select('id', 'username', 'display_name')->where('id', '<>', $id)->whereNull('suspended_at');

        return UserBlocks::hideFrom($users, $id)
            ->where(fn ($users) => $users
                ->whereRaw("lower(username) LIKE ? ESCAPE '!'", [$pattern])
                ->orWhereRaw("lower(display_name) LIKE ? ESCAPE '!'", [$pattern]))
            ->orderBy('display_name')->limit(20)->get();
    }

    public function rooms(Request $request)
    {
        $id = $request->user()->id;
        $latest = DB::table('messages')->select('id')
            ->whereColumn('room_id', 'rooms.id')->orderByDesc('id')->limit(1);
        $unread = DB::table('messages as unread')->selectRaw('count(*)')
            ->whereColumn('unread.room_id', 'rooms.id')
            ->whereColumn('unread.sender_id', '<>', 'mine.user_id')
            ->whereNull('unread.deleted_at')
            ->whereRaw('unread.id > coalesce(mine.last_read_message_id, 0)');
        $rooms = DB::table('rooms')
            ->join('room_members as mine', 'mine.room_id', '=', 'rooms.id')
            ->leftJoin('messages as latest', 'latest.id', '=', DB::raw('('.$latest->toSql().')'))
            ->where('mine.user_id', $id)
            ->select('rooms.*', 'latest.created_at as last_message_at', 'mine.last_read_message_id', 'mine.last_read_at')
            ->selectSub($unread, 'unread_count')
            ->selectRaw("case when latest.deleted_at is not null then 'Tin nhắn đã bị xóa' when latest.content = '' and latest.image_path is not null then 'Ảnh' else latest.content end as preview")
            ->orderByRaw('coalesce(latest.created_at, rooms.created_at) desc')->orderByDesc('rooms.id')->get();

        $members = DB::table('room_members')->join('users', 'users.id', '=', 'room_members.user_id')
            ->whereIn('room_id', $rooms->pluck('id'))->orderBy('display_name')
            ->get(['room_id', 'users.id', 'username', 'display_name', 'avatar_path', 'last_seen_at', 'room_members.role as role', 'last_read_at', 'last_read_message_id'])
            ->map(function ($member) {
                $member->avatar_url = User::avatarUrl($member->id, $member->avatar_path);
                unset($member->avatar_path);

                return $member;
            })->groupBy('room_id');
        $blocked = UserBlocks::relatedIds($id)->flip();
        $blockedByMe = DB::table('user_blocks')->where('blocker_id', $id)->pluck('blocked_id')->flip();

        return $rooms->each(function ($room) use ($members, $id, $blocked, $blockedByMe) {
            $room->members = $members->get($room->id, collect());
            $room->unread_count = (int) $room->unread_count;
            $peer = $room->type === 'direct' ? $room->members->firstWhere('id', '<>', $id) : null;
            $room->blocked = $peer !== null && $blocked->has($peer->id);
            $room->blocked_by_me = $peer !== null && $blockedByMe->has($peer->id);
        });
    }

    public function create(Request $request)
    {
        $data = $request->validate([
            'type' => ['required', 'in:direct,group'],
            'name' => ['required_if:type,group', 'nullable', 'string', 'max:100'],
            'members' => ['required', 'array', $request->input('type') === 'direct' ? 'size:1' : 'max:30'],
            'members.*' => ['required', 'integer', 'distinct', 'exists:users,id', 'not_in:'.$request->user()->id],
        ]);
        $user = $request->user()->id;
        $ids = array_map('intval', $data['members']);
        $ids[] = $user;
        sort($ids);
        $room = DB::transaction(function () use ($data, $ids, $user) {
            if ($data['type'] === 'direct') {
                UserBlocks::lockPair($ids[0], $ids[1]);
                $this->ensurePairCanChat($ids[0], $ids[1]);
                $existing = DB::table('rooms')->where('type', 'direct')
                    ->whereIn('id', DB::table('room_members')->select('room_id')->whereIn('user_id', $ids)
                        ->groupBy('room_id')->havingRaw('count(*) = 2'))->value('id');
                if ($existing !== null) {
                    return $existing;
                }
            }
            $room = DB::table('rooms')->insertGetId([
                'name' => $data['type'] === 'group' ? $data['name'] : null,
                'type' => $data['type'],
                'created_by' => $user,
            ]);
            DB::table('room_members')->insert(array_map(
                fn ($id) => [
                    'room_id' => $room,
                    'user_id' => $id,
                    'role' => $data['type'] === 'group' && $id === $user ? 'owner' : 'member',
                ],
                $ids,
            ));

            return $room;
        }, 3);
        $this->notify($room);

        return ['room_id' => $room];
    }

    public function messages(Request $request, int $room)
    {
        $this->requireMember($request, $room);
        $data = $request->validate(['before' => ['sometimes', 'integer', 'min:1']]);

        return $this->page($this->messageQuery()->where('messages.room_id', $room), $data['before'] ?? null);
    }

    public function search(Request $request, int $room)
    {
        $this->requireMember($request, $room);
        $data = $request->validate([
            'q' => ['required', 'string', 'max:100'],
            'before' => ['sometimes', 'integer', 'min:1'],
        ]);
        $query = $this->messageQuery()->where('messages.room_id', $room)
            ->whereNull('messages.deleted_at')
            ->whereRaw("lower(messages.content) LIKE ? ESCAPE '!'", [$this->searchPattern($data['q'])]);

        return $this->page($query, $data['before'] ?? null);
    }

    public function send(Request $request, int $room, ChatThumbnails $thumbnails)
    {
        $this->requireMember($request, $room);
        $data = $request->validate([
            'content' => ['required_without:image', 'nullable', 'string', 'max:4000'],
            'reply_to_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'image' => ['sometimes', 'required', 'image', 'mimes:jpeg,png,webp', 'max:5120', 'dimensions:ratio=1,max_width=4096,max_height=4096'],
        ], ['image.dimensions' => 'Ảnh phải được cắt vuông và có kích thước tối đa 4096 × 4096.']);

        $path = null;
        $thumbnail = null;
        try {
            if (isset($data['image'])) {
                $thumbnail = $thumbnails->store($data['image']);
                $path = $data['image']->store('chat', 'local');
                abort_if($path === false, 500, 'Không lưu được ảnh.');
            }

            $message = DB::transaction(function () use ($request, $room, $data, $path, $thumbnail) {
                $lockedRoom = $this->lockRoom($request, $room);
                $user = $request->user()->id;
                if ($lockedRoom->type === 'direct') {
                    $peer = DB::table('room_members')->where('room_id', $room)->where('user_id', '<>', $user)->value('user_id');
                    abort_if($peer === null, 409, 'Cuộc trò chuyện riêng không còn đủ thành viên.');
                    UserBlocks::lockPair($user, $peer);
                    $this->ensurePairCanChat($user, $peer);
                }

                $reply = $data['reply_to_id'] ?? null;
                if ($reply !== null && ! DB::table('messages')->where('room_id', $room)
                    ->where('id', $reply)->whereNull('deleted_at')->exists()) {
                    throw ValidationException::withMessages(['reply_to_id' => 'Tin nhắn được trích dẫn không còn khả dụng.']);
                }

                $id = DB::table('messages')->insertGetId([
                    'room_id' => $room,
                    'sender_id' => $user,
                    'content' => $data['content'] ?? '',
                    'image_path' => $path,
                    'thumbnail_path' => $thumbnail,
                    'reply_to_id' => $reply,
                ]);

                return $this->messageById($id);
            }, 3);
        } catch (Throwable $error) {
            $this->deleteMedia([$path, $thumbnail]);
            throw $error;
        }
        $this->notify($room, $message);

        return response()->json($message, 201);
    }

    public function read(Request $request, int $room)
    {
        $data = $request->validate(['message_id' => ['required', 'integer', 'min:1']]);
        $user = $request->user()->id;
        $messageId = (int) $data['message_id'];

        [$receipt, $changed] = DB::transaction(function () use ($request, $room, $user, $messageId) {
            $this->lockRoom($request, $room);
            abort_unless(DB::table('messages')->where('room_id', $room)->where('id', $messageId)->exists(), 404);
            $query = DB::table('room_members')->where('room_id', $room)->where('user_id', $user);
            $columns = ['last_read_message_id', 'last_read_at'];
            $current = (clone $query)->first($columns);
            if ($messageId <= ($current->last_read_message_id ?? 0)) {
                return [$current, false];
            }
            $query->update(['last_read_message_id' => $messageId, 'last_read_at' => now()]);

            return [$query->first($columns), true];
        }, 3);
        if ($changed) {
            $this->notify($room);
        }

        return $receipt;
    }

    public function react(Request $request, int $room, int $message)
    {
        $data = $request->validate(['emoji' => ['required', Rule::in(['👍', '❤️', '😂', '😮', '😢'])]]);
        $user = $request->user()->id;
        $result = DB::transaction(function () use ($request, $room, $message, $user, $data) {
            $this->lockRoom($request, $room);
            $query = DB::table('messages')->where('room_id', $room)->where('id', $message);
            $original = (clone $query)->first(['revision', 'deleted_at']);
            abort_unless($original !== null, 404);
            abort_if($original->deleted_at !== null, 409, 'Tin nhắn đã bị xóa.');
            $reaction = ['message_id' => $message, 'user_id' => $user, 'emoji' => $data['emoji']];
            if (! DB::table('message_reactions')->where($reaction)->delete()) {
                DB::table('message_reactions')->insert($reaction);
            }
            $query->update(['revision' => $original->revision + 1]);

            return $this->messageById($message);
        }, 3);
        $this->notify($room, $result);

        return $result;
    }

    public function edit(Request $request, int $room, int $message)
    {
        $data = $request->validate(['content' => ['required', 'string', 'max:4000']]);

        return $this->mutateMessage($request, $room, $message, [
            'content' => $data['content'],
            'edited_at' => now(),
        ]);
    }

    public function remove(Request $request, int $room, int $message)
    {
        return $this->mutateMessage($request, $room, $message, [
            'content' => '',
            'image_path' => null,
            'thumbnail_path' => null,
            'reply_to_id' => null,
            'deleted_at' => now(),
        ]);
    }

    public function image(Request $request, int $room, int $message)
    {
        return $this->serveImage($request, $room, $message);
    }

    public function thumbnail(Request $request, int $room, int $message)
    {
        return $this->serveImage($request, $room, $message, true);
    }

    public function invite(Request $request, int $room)
    {
        $data = $request->validate(['user_id' => ['required', 'integer', 'exists:users,id']]);
        DB::transaction(function () use ($request, $room, $data) {
            $group = $this->lockRoom($request, $room);
            abort_unless($group->type === 'group' && (int) $group->created_by === $request->user()->id, 403);
            DB::table('room_members')->insertOrIgnore([
                'room_id' => $room,
                'user_id' => $data['user_id'],
                'role' => 'member',
            ]);
        }, 3);
        $this->notify($room);

        return response()->noContent();
    }

    private function mutateMessage(Request $request, int $room, int $id, array $changes)
    {
        [$message, $removedMedia] = DB::transaction(function () use ($request, $room, $id, $changes) {
            $this->lockRoom($request, $room);
            $query = DB::table('messages')->where('room_id', $room)->where('id', $id);
            $original = (clone $query)->first();
            abort_unless($original !== null, 404);
            abort_unless((int) $original->sender_id === $request->user()->id, 403);
            abort_if($original->deleted_at !== null, 409, 'Tin nhắn đã bị xóa.');
            $query->update($changes + ['revision' => $original->revision + 1]);

            $removedMedia = [];
            if (isset($changes['deleted_at'])) {
                DB::table('message_reactions')->where('message_id', $id)->delete();
                $removedMedia = [$original->image_path, $original->thumbnail_path];
            }

            return [$this->messageById($id), $removedMedia];
        }, 3);
        $this->deleteMedia($removedMedia);
        $this->notify($room, $message);

        return $message;
    }

    private function serveImage(Request $request, int $room, int $message, bool $thumbnail = false)
    {
        $this->requireMember($request, $room);
        $row = DB::table('messages')
            ->join('room_members', 'room_members.room_id', '=', 'messages.room_id')
            ->where('room_members.user_id', $request->user()->id)
            ->where('messages.room_id', $room)->where('messages.id', $message)
            ->whereNull('messages.deleted_at')
            ->first(['image_path', 'thumbnail_path']);
        $path = $thumbnail ? ($row?->thumbnail_path ?? $row?->image_path) : $row?->image_path;
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, null, [
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function requireMember(Request $request, int $room): void
    {
        abort_unless(DB::table('room_members')->where('room_id', $room)
            ->where('user_id', $request->user()->id)->exists(), 403);
    }

    private function lockRoom(Request $request, int $room): object
    {
        $record = DB::table('rooms')->where('id', $room)->lockForUpdate()->first();
        abort_unless($record !== null, 403);
        $this->requireMember($request, $room);

        return $record;
    }

    private function ensurePairCanChat(int $one, int $two): void
    {
        abort_if(UserBlocks::between($one, $two), 403, 'Bạn không thể nhắn tin trong cuộc trò chuyện này.');
    }

    private function searchPattern(string $query): string
    {
        return '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($query)).'%';
    }

    private function page(Builder $query, int|string|null $before): array
    {
        $rows = $query->when($before !== null, fn ($query) => $query->where('messages.id', '<', $before))
            ->orderByDesc('messages.id')->limit(51)->get();
        $page = $rows->take(50);

        return [
            'messages' => $this->serializeMessages($page->reverse()->values()),
            'next_before' => $rows->count() > 50 ? $page->last()->id : null,
        ];
    }

    private function messageQuery(): Builder
    {
        return DB::table('messages')->join('users', 'users.id', '=', 'messages.sender_id')
            ->leftJoin('messages as reply', function ($join) {
                $join->on('reply.id', '=', 'messages.reply_to_id')->on('reply.room_id', '=', 'messages.room_id');
            })
            ->leftJoin('users as reply_sender', 'reply_sender.id', '=', 'reply.sender_id')
            ->select(
                'messages.*', 'users.display_name as sender_name', 'users.avatar_path as sender_avatar',
                'reply.id as quoted_id', 'reply_sender.display_name as quoted_sender', 'reply.content as quoted_content',
                'reply.deleted_at as quoted_deleted_at', 'reply.image_path as quoted_image',
            );
    }

    private function messageById(int $id): object
    {
        return $this->serializeMessages($this->messageQuery()->where('messages.id', $id)->get())->first();
    }

    private function serializeMessages(Collection $messages): Collection
    {
        $reactions = DB::table('message_reactions')->whereIn('message_id', $messages->pluck('id'))
            ->orderBy('emoji')->orderBy('user_id')->get()->groupBy('message_id');

        return $messages->map(function ($message) use ($reactions) {
            $base = "/api/rooms/{$message->room_id}/messages";
            $message->image_url = $message->image_path === null ? null : "$base/{$message->id}/image";
            $message->thumbnail_url = $message->thumbnail_path === null
                ? $message->image_url
                : "$base/{$message->id}/thumbnail";
            $message->sender_avatar_url = User::avatarUrl($message->sender_id, $message->sender_avatar);
            $message->reply = $message->quoted_id === null ? null : [
                'id' => $message->quoted_id,
                'sender_name' => $message->quoted_sender,
                'content' => $message->quoted_deleted_at === null ? $message->quoted_content : '',
                'deleted_at' => $message->quoted_deleted_at,
                'image_url' => $message->quoted_image === null || $message->quoted_deleted_at !== null
                    ? null : "$base/{$message->quoted_id}/image",
            ];
            $message->reactions = $reactions->get($message->id, collect())->groupBy('emoji')
                ->map(fn ($users, $emoji) => [
                    'emoji' => $emoji,
                    'count' => $users->count(),
                    'user_ids' => $users->pluck('user_id')->values(),
                ])->values();
            unset(
                $message->image_path, $message->thumbnail_path, $message->sender_avatar,
                $message->quoted_id, $message->quoted_sender, $message->quoted_content,
                $message->quoted_deleted_at, $message->quoted_image,
            );

            return $message;
        });
    }

    private function deleteMedia(array $paths): void
    {
        $paths = array_values(array_filter($paths, 'is_string'));
        if ($paths !== []) {
            Storage::disk('local')->delete($paths);
        }
    }

    private function notify(int $room, ?object $message = null): void
    {
        $ids = DB::table('room_members')->where('room_id', $room)->pluck('user_id')->all();

        foreach (array_chunk($ids, 100) as $recipients) {
            try {
                event(new ChatUpdated($recipients, $room, $message));
            } catch (Throwable $error) {
                report($error);
            }
        }
    }
}
