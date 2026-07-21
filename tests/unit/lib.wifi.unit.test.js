import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWifiInput } from '../../lib/wifi.js';

test('validateWifiInput', async (t) => {
    await t.test('rejects empty string ssid', () => {
        const result = validateWifiInput({ ssid: '', password: 'secret' });
        assert.deepStrictEqual(result, { ok: false, error: 'SSID required' });
    });

    await t.test('rejects undefined ssid', () => {
        const result = validateWifiInput({ password: 'secret' });
        assert.deepStrictEqual(result, { ok: false, error: 'SSID required' });
    });

    await t.test('rejects null ssid', () => {
        const result = validateWifiInput({ ssid: null, password: 'secret' });
        assert.deepStrictEqual(result, { ok: false, error: 'SSID required' });
    });

    await t.test('rejects ssid >32 bytes (ascii)', () => {
        const result = validateWifiInput({
            ssid: 'a'.repeat(50),
            password: 'secret',
        });
        assert.deepStrictEqual(result, {
            ok: false,
            error: 'SSID must be at most 32 bytes',
        });
    });

    await t.test('rejects ssid >32 bytes (multi-byte emoji)', () => {
        const result = validateWifiInput({
            ssid: '\u{1F600}'.repeat(9),
            password: 'secret',
        });
        assert.deepStrictEqual(result, {
            ok: false,
            error: 'SSID must be at most 32 bytes',
        });
    });

    await t.test('rejects control char in ssid (newline)', () => {
        const result = validateWifiInput({ ssid: 'my\nssid', password: 'secret' });
        assert.deepStrictEqual(result, {
            ok: false,
            error: 'SSID must not contain control characters',
        });
    });

    await t.test('rejects null byte in ssid', () => {
        const result = validateWifiInput({ ssid: 'ssid\u0000bad', password: 'secret' });
        assert.deepStrictEqual(result, {
            ok: false,
            error: 'SSID must not contain control characters',
        });
    });

    await t.test('rejects DEL char in ssid', () => {
        const result = validateWifiInput({ ssid: 'ssid\u007Fbad', password: 'secret' });
        assert.deepStrictEqual(result, {
            ok: false,
            error: 'SSID must not contain control characters',
        });
    });

    await t.test('rejects non-string ssid (number)', () => {
        const result = validateWifiInput({ ssid: 12345, password: 'secret' });
        assert.deepStrictEqual(result, { ok: false, error: 'SSID required' });
    });

    await t.test('rejects non-string ssid (object)', () => {
        const result = validateWifiInput({
            ssid: { name: 'foo' },
            password: 'secret',
        });
        assert.deepStrictEqual(result, { ok: false, error: 'SSID required' });
    });

    await t.test('rejects non-string password when provided', () => {
        const result = validateWifiInput({ ssid: 'validssid', password: 12345 });
        assert.deepStrictEqual(result, {
            ok: false,
            error: 'Password must be a string',
        });
    });

    await t.test('rejects password >63 chars', () => {
        const result = validateWifiInput({
            ssid: 'validssid',
            password: 'x'.repeat(64),
        });
        assert.deepStrictEqual(result, {
            ok: false,
            error: 'Password must be at most 63 characters',
        });
    });

    await t.test('accepts valid ssid and password pair', () => {
        const result = validateWifiInput({
            ssid: 'MyHomeNetwork',
            password: 'supersecret',
        });
        assert.deepStrictEqual(result, { ok: true });
    });

    await t.test('accepts missing password field', () => {
        const result = validateWifiInput({ ssid: 'MyHomeNetwork' });
        assert.deepStrictEqual(result, { ok: true });
    });
});
