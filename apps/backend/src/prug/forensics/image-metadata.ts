/**
 * Container-level inspection of a single uploaded photo.
 *
 * Everything here is deterministic and offline: format detection, EXIF, editor
 * and AI-generator markers, and the perceptual fingerprint. The vision pass
 * adds judgement on top of these facts — it never replaces them.
 */

import { createHash } from 'crypto';
import { ForensicFinding, PhotoMetadataSummary } from '../prug.types';
import { isJpeg, parseJpeg } from './jpeg';
import { isPng, parsePng } from './png';
import { ExifData, parseExif, parseExifDate } from './exif';
import { fingerprint } from './perceptual-hash';

/** Software strings that imply pixel-level editing rather than capture. */
const EDITOR_SIGNATURES: Array<{
  pattern: RegExp;
  label: string;
  severity: 'medium' | 'high';
}> = [
  { pattern: /photoshop/i, label: 'Adobe Photoshop', severity: 'high' },
  { pattern: /gimp/i, label: 'GIMP', severity: 'high' },
  { pattern: /affinity\s*photo/i, label: 'Affinity Photo', severity: 'high' },
  { pattern: /pixelmator/i, label: 'Pixelmator', severity: 'high' },
  {
    pattern: /paint\.net|paintshop/i,
    label: 'Paint.NET / PaintShop',
    severity: 'high',
  },
  {
    pattern: /facetune|retouch|remini|picsart|meitu/i,
    label: 'Retouching app',
    severity: 'high',
  },
  { pattern: /canva|figma|sketch/i, label: 'Design tool', severity: 'high' },
  {
    pattern: /lightroom|capture one|darktable|snapseed|vsco/i,
    label: 'RAW/photo editor',
    severity: 'medium',
  },
];

/** Markers left by generative image tools. */
const AI_SIGNATURES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /midjourney/i, label: 'Midjourney' },
  {
    pattern: /stable\s*diffusion|automatic1111|comfyui|invokeai/i,
    label: 'Stable Diffusion',
  },
  { pattern: /dall[\s._-]?e/i, label: 'DALL·E' },
  { pattern: /firefly/i, label: 'Adobe Firefly' },
  { pattern: /imagen|gemini|nano\s*banana/i, label: 'Google Imagen' },
  { pattern: /flux\.1|black\s*forest\s*labs/i, label: 'FLUX' },
  {
    pattern: /trainedAlgorithmicMedia|compositeSynthetic|algorithmicMedia/i,
    label: 'C2PA synthetic media claim',
  },
  { pattern: /openai|grok|sora/i, label: 'Generative model tag' },
];

const MIN_LONG_EDGE = 1000;
const MIN_MACRO_LONG_EDGE = 1400;

export interface PhotoInspection {
  metadata: PhotoMetadataSummary;
  findings: ForensicFinding[];
  exif: ExifData | null;
  /** EXIF thumbnail bytes, kept for the thumbnail/main consistency check. */
  thumbnail: Buffer | null;
}

function detectSignature<T extends { pattern: RegExp }>(
  candidates: T[],
  haystack: string,
): T | null {
  for (const candidate of candidates) {
    if (candidate.pattern.test(haystack)) return candidate;
  }
  return null;
}

/**
 * Inspect one photo. `isMacro` raises the sharpness/resolution bar for shots
 * whose whole purpose is close detail.
 */
export function inspectPhoto(
  buf: Buffer,
  options: { isMacro?: boolean } = {},
): PhotoInspection | null {
  const findings: ForensicFinding[] = [];
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const print = fingerprint(buf);

  let metadata: PhotoMetadataSummary;
  let exif: ExifData | null = null;
  let thumbnail: Buffer | null = null;
  let xmp = '';

  if (isJpeg(buf)) {
    const jpeg = parseJpeg(buf);
    if (!jpeg) return null;

    exif = jpeg.exif;
    thumbnail = jpeg.exif?.thumbnail ?? null;
    xmp = jpeg.xmp || '';

    metadata = {
      format: 'jpeg',
      width: jpeg.width,
      height: jpeg.height,
      byteSize: buf.length,
      sha256,
      hasExif: !!jpeg.exif && jpeg.exif.tagCount > 0,
      cameraMake: jpeg.exif?.make,
      cameraModel: jpeg.exif?.model,
      software: jpeg.exif?.software,
      dateTimeOriginal: jpeg.exif?.dateTimeOriginal,
      modifyDate: jpeg.exif?.modifyDate,
      gps:
        jpeg.exif?.gpsLatitude !== undefined &&
        jpeg.exif?.gpsLongitude !== undefined
          ? {
              latitude: jpeg.exif.gpsLatitude,
              longitude: jpeg.exif.gpsLongitude,
            }
          : undefined,
      markers: {
        adobeApp14: jpeg.hasAdobeApp14,
        photoshopIrb: jpeg.hasPhotoshopIrb,
        c2pa: jpeg.hasC2pa,
        xmpHistory: /stEvt:action|photoshop:History|xmpMM:History/i.test(xmp),
      },
      jpegQuality: jpeg.quantQuality[0],
      progressive: jpeg.progressive,
      trailingBytes: jpeg.trailingBytes,
      fingerprint: print ? { dhash: print.dhash, phash: print.phash } : null,
    };

    if (jpeg.truncated) {
      findings.push({
        code: 'truncated_file',
        severity: 'medium',
        source: 'metadata',
        message:
          'The JPEG has no end-of-image marker; the file may be truncated or hand-assembled.',
        messageFa:
          'فایل JPEG نشانه پایان تصویر ندارد؛ ممکن است ناقص یا دست‌ساز باشد.',
        weight: 8,
      });
    }
  } else if (isPng(buf)) {
    const png = parsePng(buf);
    if (!png) return null;

    if (png.exifChunk) exif = parseExif(png.exifChunk);
    const textBlob = Object.entries(png.textChunks)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    xmp = png.textChunks['XML:com.adobe.xmp'] || '';

    metadata = {
      format: 'png',
      width: png.width,
      height: png.height,
      byteSize: buf.length,
      sha256,
      hasExif: !!exif && exif.tagCount > 0,
      cameraMake: exif?.make,
      cameraModel: exif?.model,
      software: exif?.software || png.textChunks['Software'],
      dateTimeOriginal: exif?.dateTimeOriginal,
      modifyDate: exif?.modifyDate || png.textChunks['Creation Time'],
      markers: {
        adobeApp14: false,
        photoshopIrb: false,
        c2pa: png.hasC2pa,
        xmpHistory: /stEvt:action|photoshop:History|xmpMM:History/i.test(
          textBlob,
        ),
      },
      trailingBytes: png.trailingBytes,
      fingerprint: print ? { dhash: print.dhash, phash: print.phash } : null,
    };

    // A PNG straight out of a camera is unusual; it usually means a screenshot
    // or an export from an editing tool.
    findings.push({
      code: 'png_source',
      severity: 'low',
      source: 'metadata',
      message:
        'Photo submitted as PNG. Cameras produce JPEG or HEIC; PNG usually means a screenshot or an export.',
      messageFa:
        'عکس با فرمت PNG ارسال شده است. دوربین‌ها JPEG یا HEIC تولید می‌کنند؛ PNG معمولاً یعنی اسکرین‌شات یا خروجی نرم‌افزار.',
      weight: 10,
    });

    xmp = `${xmp}\n${textBlob}`;
  } else {
    return null;
  }

  const softwareBlob = [
    metadata.software,
    exif?.artist,
    exif?.copyright,
    exif?.lensModel,
    xmp,
  ]
    .filter(Boolean)
    .join('\n');

  // --- Generative-image markers -------------------------------------------
  const aiSignature = detectSignature(AI_SIGNATURES, softwareBlob);
  if (aiSignature) {
    metadata.markers.aiGenerator = aiSignature.label;
    findings.push({
      code: 'ai_generated_marker',
      severity: 'critical',
      source: 'metadata',
      message: `The file carries a generative-image marker (${aiSignature.label}). A certificate cannot be issued from synthetic imagery.`,
      messageFa: `فایل نشانه تولید با هوش مصنوعی دارد (${aiSignature.label}). با تصویر مصنوعی نمی‌توان شناسنامه صادر کرد.`,
      weight: 100,
      details: { marker: aiSignature.label },
    });
  }

  // --- Editing software ----------------------------------------------------
  const editor = detectSignature(EDITOR_SIGNATURES, softwareBlob);
  if (editor) {
    findings.push({
      code: 'editor_software',
      severity: editor.severity,
      source: 'metadata',
      message: `The photo was written by ${editor.label}, so it is not straight out of the camera.`,
      messageFa: `این عکس با ${editor.label} ذخیره شده و مستقیماً خروجی دوربین نیست.`,
      weight: editor.severity === 'high' ? 35 : 15,
      details: { software: metadata.software },
    });
  }

  if (metadata.markers.photoshopIrb || metadata.markers.adobeApp14) {
    findings.push({
      code: 'adobe_processing_marker',
      severity: 'medium',
      source: 'metadata',
      message:
        'The file contains Adobe processing markers (APP13/APP14) left by an image editor.',
      messageFa:
        'فایل حاوی نشانه‌های پردازش Adobe (APP13/APP14) است که نرم‌افزار ویرایش تصویر باقی گذاشته.',
      weight: 15,
    });
  }

  if (metadata.markers.xmpHistory) {
    findings.push({
      code: 'xmp_edit_history',
      severity: 'high',
      source: 'metadata',
      message:
        'XMP metadata contains an edit history, which records that the image was modified after capture.',
      messageFa:
        'فراداده XMP تاریخچه ویرایش دارد؛ یعنی تصویر پس از ثبت تغییر کرده است.',
      weight: 30,
    });
  }

  // --- Provenance ----------------------------------------------------------
  if (metadata.markers.c2pa && !aiSignature) {
    findings.push({
      code: 'c2pa_present',
      severity: 'info',
      source: 'metadata',
      message:
        'The file carries C2PA content credentials. Verify the claim signature during manual review.',
      messageFa:
        'فایل دارای اعتبارنامه محتوای C2PA است. امضای آن در بازبینی دستی بررسی شود.',
      weight: 0,
    });
  }

  // --- Capture evidence ----------------------------------------------------
  if (!metadata.hasExif) {
    findings.push({
      code: 'no_exif',
      severity: 'medium',
      source: 'metadata',
      message:
        'No EXIF data. Metadata is stripped by screenshots, messaging apps, downloads and some editors.',
      messageFa:
        'فراداده EXIF وجود ندارد. اسکرین‌شات، پیام‌رسان‌ها، دانلود از وب و برخی ویرایشگرها آن را حذف می‌کنند.',
      weight: 18,
    });
  } else if (!metadata.cameraMake && !metadata.cameraModel) {
    findings.push({
      code: 'no_camera_identity',
      severity: 'medium',
      source: 'metadata',
      message:
        'EXIF is present but records no camera make or model, which is typical of re-saved files.',
      messageFa:
        'EXIF وجود دارد اما نام سازنده یا مدل دوربین در آن نیست؛ این حالت در فایل‌های دوباره‌ذخیره‌شده رایج است.',
      weight: 12,
    });
  }

  // --- Timeline ------------------------------------------------------------
  const captured = parseExifDate(exif?.dateTimeOriginal);
  const modified = parseExifDate(exif?.modifyDate);
  if (captured && modified) {
    const deltaMinutes = (modified.getTime() - captured.getTime()) / 60_000;
    if (deltaMinutes > 10) {
      findings.push({
        code: 'post_capture_modification',
        severity: deltaMinutes > 60 * 24 ? 'high' : 'medium',
        source: 'metadata',
        message: `The file was last written ${Math.round(deltaMinutes)} minutes after it was taken, indicating post-capture processing.`,
        messageFa: `فایل ${Math.round(deltaMinutes)} دقیقه پس از عکس‌برداری دوباره نوشته شده؛ نشانه پردازش بعد از ثبت است.`,
        weight: deltaMinutes > 60 * 24 ? 25 : 12,
        details: { deltaMinutes: Math.round(deltaMinutes) },
      });
    }
  }

  // --- Geometry ------------------------------------------------------------
  if (exif?.pixelXDimension && exif?.pixelYDimension) {
    const exifPixels = exif.pixelXDimension * exif.pixelYDimension;
    const actualPixels = metadata.width * metadata.height;
    // Orientation swaps the axes, so compare total pixel counts rather than sides.
    if (
      exifPixels > 0 &&
      Math.abs(exifPixels - actualPixels) / exifPixels > 0.02
    ) {
      findings.push({
        code: 'dimension_mismatch',
        severity: 'high',
        source: 'metadata',
        message: `EXIF records ${exif.pixelXDimension}x${exif.pixelYDimension} but the image is ${metadata.width}x${metadata.height}; the photo was cropped or resized after capture.`,
        messageFa: `EXIF ابعاد ${exif.pixelXDimension}x${exif.pixelYDimension} را ثبت کرده اما تصویر ${metadata.width}x${metadata.height} است؛ عکس پس از ثبت برش یا تغییر اندازه داده شده.`,
        weight: 28,
        details: {
          exifWidth: exif.pixelXDimension,
          exifHeight: exif.pixelYDimension,
          actualWidth: metadata.width,
          actualHeight: metadata.height,
        },
      });
    }
  }

  const longEdge = Math.max(metadata.width, metadata.height);
  const requiredEdge = options.isMacro ? MIN_MACRO_LONG_EDGE : MIN_LONG_EDGE;
  if (longEdge < requiredEdge) {
    findings.push({
      code: 'low_resolution',
      severity: 'medium',
      source: 'pixel',
      message: `Long edge is ${longEdge}px; at least ${requiredEdge}px is needed to assess this shot.`,
      messageFa: `بزرگ‌ترین ضلع تصویر ${longEdge} پیکسل است؛ برای ارزیابی این نما حداقل ${requiredEdge} پیکسل لازم است.`,
      weight: 15,
      details: { longEdge, requiredEdge },
    });
  }

  if (
    metadata.jpegQuality !== undefined &&
    metadata.jpegQuality > 0 &&
    metadata.jpegQuality < 60
  ) {
    findings.push({
      code: 'heavy_recompression',
      severity: 'low',
      source: 'pixel',
      message: `JPEG quality is approximately ${metadata.jpegQuality}, which suggests the image has been re-saved or forwarded through a messaging app.`,
      messageFa: `کیفیت JPEG حدود ${metadata.jpegQuality} است؛ احتمالاً تصویر دوباره ذخیره یا از طریق پیام‌رسان ارسال شده است.`,
      weight: 10,
      details: { quality: metadata.jpegQuality },
    });
  }

  if (metadata.trailingBytes > 64) {
    findings.push({
      code: 'trailing_data',
      severity: 'low',
      source: 'metadata',
      message: `${metadata.trailingBytes} bytes follow the end of the image data.`,
      messageFa: `${metadata.trailingBytes} بایت داده پس از پایان تصویر وجود دارد.`,
      weight: 5,
    });
  }

  if (!print) {
    findings.push({
      code: 'fingerprint_unavailable',
      severity: 'medium',
      source: 'pixel',
      message:
        'The image could not be decoded for fingerprinting (progressive or unusual encoding), so duplicate checks cannot run on it.',
      messageFa:
        'امکان رمزگشایی تصویر برای اثر انگشت وجود نداشت (کدگذاری تدریجی یا غیرمعمول)، بنابراین بررسی تکراری بودن روی آن انجام نمی‌شود.',
      weight: 12,
    });
  }

  return { metadata, findings, exif, thumbnail };
}
