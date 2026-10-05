import { randomBytes } from 'node:crypto';
import { mkdirSync, openSync, readSync, closeSync, unlink } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { LIMITS } from '../shared/constants';
import { badRequest } from './http';

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export const UPLOAD_URL_PREFIX = '/uploads/';

export function createUploader(uploadDir: string) {
  mkdirSync(uploadDir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (_req, file, cb) => cb(null, randomBytes(16).toString('hex') + EXTENSIONS[file.mimetype]),
    }),
    limits: { fileSize: LIMITS.uploadBytes, files: 12 },
    fileFilter: (_req, file, cb) => {
      if (EXTENSIONS[file.mimetype]) cb(null, true);
      else cb(badRequest('Only PNG, JPEG, WebP and GIF images are allowed'));
    },
  });
}

/** Check the file's magic bytes so a renamed non-image can't sneak through. */
function looksLikeImage(file: string): boolean {
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(12);
    readSync(fd, head, 0, 12, 0);
    const ascii = (start: number, end: number) => head.subarray(start, end).toString('latin1');
    return (
      (head[0] === 0x89 && ascii(1, 4) === 'PNG') ||
      (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) ||
      ascii(0, 4) === 'GIF8' ||
      (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
    );
  } finally {
    closeSync(fd);
  }
}

/** Validates freshly uploaded files and returns their public URLs. Invalid files are removed. */
export function acceptUploads(files: Express.Multer.File[]): string[] {
  const bad = files.filter((f) => !looksLikeImage(f.path));
  if (bad.length) {
    for (const f of files) unlink(f.path, () => {});
    throw badRequest('That file does not look like an image');
  }
  return files.map((f) => UPLOAD_URL_PREFIX + f.filename);
}

export function discardUploads(files: Express.Multer.File[] | undefined) {
  for (const f of files ?? []) unlink(f.path, () => {});
}

/** Best-effort removal of files we stored, given their public URLs. External URLs are ignored. */
export function removeStoredFiles(uploadDir: string, urls: (string | null | undefined)[]) {
  for (const url of urls) {
    if (!url?.startsWith(UPLOAD_URL_PREFIX)) continue;
    const name = path.basename(url);
    if (!/^[a-f0-9]{32}\.(png|jpg|webp|gif)$/.test(name)) continue;
    unlink(path.join(uploadDir, name), () => {});
  }
}
