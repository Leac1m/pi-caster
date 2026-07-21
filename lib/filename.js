import path from 'path';

export function sanitizeFilename(originalname) {
    const base = path.basename(originalname);
    const sanitized = base.replace(/[^A-Za-z0-9._-]/g, '_');
    return Date.now() + '-' + sanitized;
}
