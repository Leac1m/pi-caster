export function validateWifiInput({ ssid, password }) {
    if (typeof ssid !== 'string' || ssid.length === 0) {
        return { ok: false, error: 'SSID required' };
    }
    if (Buffer.byteLength(ssid, 'utf8') > 32) {
        return { ok: false, error: 'SSID must be at most 32 bytes' };
    }
    for (let i = 0; i < ssid.length; i++) {
        const code = ssid.charCodeAt(i);
        if (code <= 0x1f || code === 0x7f) {
            return { ok: false, error: 'SSID must not contain control characters' };
        }
    }
    if (password !== undefined && password !== null) {
        if (typeof password !== 'string') {
            return { ok: false, error: 'Password must be a string' };
        }
        if (password.length > 63) {
            return { ok: false, error: 'Password must be at most 63 characters' };
        }
    }
    return { ok: true };
}
