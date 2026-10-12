<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Downscaled copies of an uploaded product photo, made once and kept on disk.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 * The catalogue's photos are the originals a shopkeeper uploaded from a phone:
 * 81 files, 58 MB, averaging 738 KB and peaking at 1.94 MB. Every one of them
 * was being sent in full to a 170px grid tile and a 64px video badge. On a
 * Pakistani mobile connection that is the whole experience — the grid crawls,
 * and the request that actually matters (the product the shopper just tapped)
 * is queued behind megabytes of thumbnails nobody needed at that size.
 *
 * So GET /image now takes an optional `w` and answers with the photo scaled to
 * that width. Nothing about the existing URLs changes: `/image?file=X` with no
 * `w` returns exactly the bytes it always did, which is what every cached
 * response, every stored product record and every older client already holds.
 *
 * ---------------------------------------------------------------------------
 * Rules
 * ---------------------------------------------------------------------------
 * ALLOWLISTED WIDTHS. `w` is snapped to one of WIDTHS rather than honoured
 * literally. A free-form integer is an invitation to fill a shared host's disk
 * with ten thousand near-identical renders of the same photo, and no layout in
 * the app needs 641px.
 *
 * WEBP OUT. The sources are phone JPEGs and cut-out PNGs; re-encoding a 1.2 MB
 * PNG as a smaller PNG still leaves hundreds of KB, while WebP at the same
 * visual quality lands around 30-60 KB and keeps the alpha channel that made
 * the file a PNG in the first place. Every browser that can run this React app
 * can decode WebP. If the host's GD was built without WebP the variant is
 * written in the source format instead — still far smaller than the original.
 *
 * FAILURE IS NOT AN ERROR. No GD, no write permission, a corrupt file, an image
 * so large that decoding it would be reckless: every one of those falls back to
 * streaming the original, which is exactly today's behaviour. This layer can
 * only ever make a response smaller; it can never make one fail.
 *
 * IMMUTABLE, LIKE THE ORIGINAL. Stored upload names already carry a timestamp
 * and a random token (Uploads::save), so a replaced photo is a new filename and
 * a new URL. A variant of one is just as immutable, and is cached for a year.
 */
class ImageVariants
{
    /** The only widths that may be rendered. Keep in step with src/lib/img.js. */
    public const WIDTHS = [160, 320, 480, 640, 960, 1280];

    /**
     * Source types worth rescaling, by what the FILE actually is — never by what
     * it is called. Several uploads in this catalogue are PNGs saved under a
     * .jpg name (a phone screenshot renamed, most likely): 1.9 MB of PNG behind
     * "England Jugnu1.jpg". Trusting the extension meant handing those to
     * imagecreatefromjpeg(), which fails, which quietly fell back to streaming
     * the 1.9 MB original — exactly the files that needed shrinking most.
     *
     * SVG is resolution-independent and GIF may animate, so neither is here.
     */
    private const RASTER = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG  => 'png',
        IMAGETYPE_WEBP => 'webp',
        IMAGETYPE_BMP  => 'bmp',
    ];

    /**
     * Guard against decoding something absurd on a shared host. GD needs roughly
     * 4 bytes of memory per pixel for a truecolour image, so 40 MP is ~160 MB —
     * already past what most cPanel PHP pools allow, and far past any photograph
     * that belongs in a product catalogue.
     */
    private const MAX_SOURCE_PIXELS = 40000000;

    /** Visually lossless enough for a product photo, at roughly a third of q=95. */
    private const QUALITY = 82;

    /**
     * A variant has to beat the original by this much to be worth serving. Below
     * it, the extra file on disk and the second code path buy nothing, so the
     * original is streamed exactly as before.
     */
    private const WORTH_IT = 0.9;

    /** Snap a requested width to the allowlist, or null when there is nothing to do. */
    public static function normaliseWidth(mixed $raw): ?int
    {
        if ($raw === null || $raw === '' || !is_numeric($raw)) {
            return null;
        }
        $want = (int) $raw;
        if ($want <= 0) {
            return null;
        }
        foreach (self::WIDTHS as $w) {
            if ($want <= $w) {
                return $w;
            }
        }
        return null; // wider than anything we render -> serve the original
    }

    /**
     * Path to the cached variant of `$source` at `$width`, rendering it if this
     * is the first ask. Returns null whenever the original should be served
     * instead — which is every failure mode, by design.
     */
    public static function path(string $source, int $width): ?string
    {
        if (!extension_loaded('gd')) {
            return null;
        }

        // getimagesize() sniffs the header, so this is the file's real type.
        $info = @getimagesize($source);
        if (!$info || ($info[0] ?? 0) <= 0 || ($info[1] ?? 0) <= 0) {
            return null;
        }
        $type = $info[2] ?? 0;
        if (!isset(self::RASTER[$type])) {
            return null;
        }
        $kind = self::RASTER[$type];

        // Never upscale: a 1024px-wide source asked for at 1280 is rendered at
        // 1024. It is still worth rendering, though, and an earlier version got
        // this wrong by returning the original here — which is how a 1.6 MB PNG
        // that happens to be 1024px wide was still being sent in full to a
        // phone. The file is oversized because of its FORMAT, not its
        // dimensions, and re-encoding it alone takes it to about 60 KB. What
        // guards against pointless work now is the size comparison at the end,
        // which is the honest test: a variant is used only if it is actually
        // smaller.
        $target = min($width, (int) $info[0]);
        if ($info[0] * $info[1] > self::MAX_SOURCE_PIXELS) {
            return null;
        }

        // WebP keeps alpha and is a fraction of the size. Without it, fall back
        // to a format that can carry whatever the source carried.
        $outExt = function_exists('imagewebp') ? 'webp' : ($kind === 'jpg' ? 'jpg' : 'png');

        // Keyed on the file's identity (name + mtime + size) rather than on the
        // name alone. Stored uploads are not supposed to be replaced in place,
        // but external tooling touches this folder too, and a stale render is
        // the one failure this cache must not have.
        $key = sha1(basename($source) . '|' . (string) @filemtime($source) . '|' . (string) @filesize($source));
        $dir = self::dir();
        if ($dir === null) {
            return null;
        }
        // Keyed on the EFFECTIVE width, so every request that lands on the same
        // render shares one file — a 1024px source asked for at 960 and at 1280
        // is one variant, not two.
        $out = $dir . '/' . $key . '-' . $target . '.' . $outExt;

        if (is_file($out)) {
            $size = filesize($out);
            // A zero-length file is a render that died midway (a process killed,
            // a full disk). Drop it and try again rather than serving nothing.
            if ($size > 0) {
                return $size < @filesize($source) * self::WORTH_IT ? $out : null;
            }
            @unlink($out);
        }

        if (!self::render($source, $out, $info, $target, $kind, $outExt)) {
            return null;
        }

        // Worth it? Some sources — a small, already-optimised JPEG — re-encode
        // to something no smaller. Keep the file (so the next request does not
        // redo the work to reach the same conclusion) but serve the original.
        return filesize($out) < @filesize($source) * self::WORTH_IT ? $out : null;
    }

    /** MIME for a rendered variant (the extension is ours, so this is total). */
    public static function mime(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'webp'  => 'image/webp',
            'png'   => 'image/png',
            default => 'image/jpeg',
        };
    }

    /** The variants folder, created on demand. Null if it cannot be used. */
    private static function dir(): ?string
    {
        $dir = Uploads::dir();
        if ($dir === '') {
            return null;
        }
        $out = $dir . '/_variants';
        if (!is_dir($out) && !@mkdir($out, 0775, true) && !is_dir($out)) {
            return null;
        }
        return is_writable($out) ? $out : null;
    }

    /**
     * Decode, scale, encode. Written under a temporary name in the same folder
     * and renamed into place, so two requests racing for the same new variant
     * can never let a reader see a half-written file.
     */
    private static function render(
        string $source,
        string $out,
        array $info,
        int $width,
        string $kind,
        string $outExt,
    ): bool {
        $src = self::decode($source, $kind);
        if (!$src) {
            return false;
        }

        $height = max(1, (int) round($info[1] * ($width / $info[0])));
        $dst = @imagecreatetruecolor($width, $height);
        if (!$dst) {
            imagedestroy($src);
            return false;
        }

        // Alpha has to be set up BEFORE the copy, or a transparent PNG comes out
        // on a black background — which is what most of this catalogue's product
        // cut-outs are.
        if ($outExt !== 'jpg') {
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 0, 0, 0, 127));
        } else {
            imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        }

        $ok = @imagecopyresampled($dst, $src, 0, 0, 0, 0, $width, $height, $info[0], $info[1]);
        imagedestroy($src);

        if ($ok) {
            $tmp = $out . '.' . bin2hex(random_bytes(4)) . '.tmp';
            $written = match ($outExt) {
                'webp'  => @imagewebp($dst, $tmp, self::QUALITY),
                'png'   => @imagepng($dst, $tmp, 6),
                default => @imagejpeg($dst, $tmp, self::QUALITY),
            };
            $ok = $written && is_file($tmp) && filesize($tmp) > 0 && @rename($tmp, $out);
            if (!$ok) {
                @unlink($tmp);
            }
        }

        imagedestroy($dst);
        return (bool) $ok;
    }

    /**
     * GD handle for a source file, or null when this build cannot read the
     * format. `$kind` comes from getimagesize(), i.e. from the file's header —
     * see the note on RASTER for why the extension is not trusted here.
     */
    private static function decode(string $path, string $kind)
    {
        $fn = match ($kind) {
            'jpg'   => 'imagecreatefromjpeg',
            'png'   => 'imagecreatefrompng',
            'webp'  => 'imagecreatefromwebp',
            'bmp'   => 'imagecreatefrombmp',
            default => null,
        };
        if ($fn === null || !function_exists($fn)) {
            return null;
        }
        // A truncated or malformed upload makes GD emit warnings and return
        // false; neither must reach the response, which is why every call in
        // this class is silenced and checked rather than trusted.
        $img = @$fn($path);
        return $img ?: null;
    }
}
