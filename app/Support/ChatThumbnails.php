<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;

class ChatThumbnails
{
    public function store(UploadedFile $image): string
    {
        $mime = $image->getMimeType();
        $bytes = $this->fromGd($image->getRealPath(), $mime)
            ?? $this->fromFfmpeg($image->getRealPath(), $mime);

        if ($bytes === null) {
            throw ValidationException::withMessages(['image' => 'Không tạo được ảnh thu nhỏ. Vui lòng chọn ảnh khác.']);
        }

        $path = 'chat-thumbnails/'.Str::uuid().'.png';
        abort_unless(Storage::disk('local')->put($path, $bytes), 500, 'Không lưu được ảnh thu nhỏ.');

        return $path;
    }

    private function fromGd(string $path, ?string $mime): ?string
    {
        $decode = match ($mime) {
            'image/jpeg' => 'imagecreatefromjpeg',
            'image/png' => 'imagecreatefrompng',
            'image/webp' => 'imagecreatefromwebp',
            default => null,
        };
        if ($decode === null || ! function_exists($decode)) {
            return null;
        }

        $source = @$decode($path);
        if ($source === false) {
            return null;
        }
        $size = min(320, imagesx($source));
        $thumbnail = imagescale($source, $size, $size);
        if ($thumbnail === false) {
            return null;
        }
        imagesavealpha($thumbnail, true);

        ob_start();
        try {
            return imagepng($thumbnail) ? ob_get_contents() : null;
        } finally {
            ob_end_clean();
        }
    }

    private function fromFfmpeg(string $path, ?string $mime): ?string
    {
        $demuxer = match ($mime) {
            'image/jpeg' => 'jpeg_pipe',
            'image/png' => 'png_pipe',
            'image/webp' => 'webp_pipe',
            default => null,
        };
        if ($demuxer === null) {
            return null;
        }

        $process = new Process([
            'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1',
            '-f', $demuxer, '-protocol_whitelist', 'file', '-i', $path, '-vf', 'scale=min(320\\,iw):-1',
            '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', 'pipe:1',
        ], timeout: 10);

        try {
            $exitCode = $process->run();
        } catch (\RuntimeException $error) {
            report($error);

            return null;
        }

        return $exitCode === 0 && $process->getOutput() !== '' ? $process->getOutput() : null;
    }
}
