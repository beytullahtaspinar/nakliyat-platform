import {
  AUDIO_BITRATE,
  MAX_VIDEO_SECONDS,
  PHOTO_MAX_SIDE,
  VIDEO_BITRATE,
  VIDEO_MAX_SIDE,
} from "./rules";

export type Compressed = {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  durationSec?: number;
};

export class MediaError extends Error {}

const fit = (width: number, height: number, maxSide: number) => {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  // Video kodlayıcıları çift sayı ister
  return { width: Math.max(2, Math.round((width * scale) / 2) * 2), height: Math.max(2, Math.round((height * scale) / 2) * 2) };
};

async function decodeImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    // Telefon fotoğraflarındaki dönüş bilgisi (EXIF) uygulanır
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
    } catch {
      throw new MediaError("Bu fotoğraf açılamadı. JPEG veya PNG olarak tekrar dene.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Fotoğrafı en uzun kenarı 1600 px (ya da maxSide) olacak şekilde küçültüp WebP'ye (desteklenmezse JPEG) çevirir.
 * Yeniden kodlama, konum (GPS) dahil tüm EXIF bilgisini de siler.
 */
export async function compressImage(file: File, maxSide = PHOTO_MAX_SIDE): Promise<Compressed> {
  const source = await decodeImage(file);
  return encodeImage(source, maxSide);
}

/**
 * Aynı fotoğrafın birden çok boyutu (ör. firma sayfası: büyük + küçük önizleme). Dosya bir kez açılır.
 */
export async function compressImageSizes(file: File, maxSides: number[]): Promise<Compressed[]> {
  const source = await decodeImage(file);
  try {
    const out: Compressed[] = [];
    for (const side of maxSides) out.push(await encodeImage(source, side, false));
    return out;
  } finally {
    if ("close" in source && typeof source.close === "function") source.close();
  }
}

async function encodeImage(
  source: CanvasImageSource & { width: number; height: number },
  maxSide: number,
  release = true,
): Promise<Compressed> {
  const { width, height } = fit(source.width, source.height, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new MediaError("Fotoğraf hazırlanamadı.");
  ctx.fillStyle = "#fff"; // saydam PNG'ler siyah görünmesin
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  if (release && "close" in source && typeof source.close === "function") source.close();

  let blob = await toBlob(canvas, "image/webp", 0.8);
  // Eski Safari WebP kodlayamaz, sessizce PNG döner: o durumda JPEG
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.82);
  if (!blob) throw new MediaError("Fotoğraf hazırlanamadı.");
  return { blob, mimeType: blob.type, width, height };
}

/**
 * Videoyu tarayıcıda 720p'ye küçültür, ilk 60 saniyeyi alır, konum gibi meta verileri siler.
 * Öncelik H.264 MP4 (her yerde oynar); tarayıcı H.264 kodlayamıyorsa VP9/VP8 WebM.
 * Kütüphane (mediabunny) yalnızca video seçildiğinde yüklenir; sayfa açılışını etkilemez.
 */
export async function compressVideo(
  file: File,
  onProgress: (ratio: number) => void,
  signal: AbortSignal,
): Promise<Compressed> {
  if (typeof VideoEncoder === "undefined") {
    throw new MediaError("Bu tarayıcı videoyu küçültemiyor. Telefonunun güncel tarayıcısıyla (Chrome veya Safari) dene.");
  }
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack().catch(() => null);
    if (!track) throw new MediaError("Video dosyası okunamadı.");
    const duration = await input.computeDuration();
    const end = Math.min(duration, MAX_VIDEO_SECONDS);
    const size = fit(await track.getDisplayWidth(), await track.getDisplayHeight(), VIDEO_MAX_SIDE);
    const quality = new mb.Quality({ bitrate: VIDEO_BITRATE });

    const mp4 = (await mb.canEncodeVideo("avc", { ...size, quality })) ? "avc" : null;
    const videoCodec = mp4 ?? (await mb.getFirstEncodableVideoCodec(["vp9", "vp8"], { ...size, quality }));
    if (!videoCodec) {
      throw new MediaError("Bu tarayıcı videoyu küçültemiyor. Telefonunun güncel tarayıcısıyla (Chrome veya Safari) dene.");
    }
    const audioCodec = await mb.getFirstEncodableAudioCodec(mp4 ? ["aac", "opus"] : ["opus"], {
      numberOfChannels: 1,
      sampleRate: 48_000,
    });
    const mimeType = mp4 ? "video/mp4" : "video/webm";

    const output = new mb.Output({
      format: mp4 ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat(),
      target: new mb.BufferTarget(),
    });
    const conversion = await mb.Conversion.init({
      input,
      output,
      video: { ...size, fit: "contain", codec: videoCodec, frameRate: 30, quality },
      // Ses kodlanamıyorsa video sessiz yüklenir
      audio: audioCodec
        ? { codec: audioCodec, numberOfChannels: 1, sampleRate: 48_000, quality: new mb.Quality({ bitrate: AUDIO_BITRATE }) }
        : { discard: true },
      trim: { start: 0, end },
      tags: {},
      showWarnings: false,
    });
    if (!conversion.isValid) throw new MediaError("Bu video biçimi desteklenmiyor.");
    conversion.onProgress = (p) => onProgress(p);
    const abort = () => void conversion.cancel();
    signal.addEventListener("abort", abort, { once: true });
    try {
      await conversion.execute();
    } finally {
      signal.removeEventListener("abort", abort);
    }

    const buffer = output.target.buffer;
    if (!buffer) throw new MediaError("Video hazırlanamadı.");
    return { blob: new Blob([buffer], { type: mimeType }), mimeType, ...size, durationSec: Math.round(end) };
  } catch (err) {
    if (err instanceof MediaError || signal.aborted) throw err;
    console.error(err);
    throw new MediaError("Video hazırlanamadı. Daha kısa bir video ya da fotoğraf eklemeyi dene.");
  } finally {
    input.dispose();
  }
}
