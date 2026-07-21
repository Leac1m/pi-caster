import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLocalIp } from '../../lib/ip.js';

test('getLocalIp', async (t) => {
    await t.test('returns first non-internal IPv4 address', () => {
        const interfaces = {
            eth0: [{ address: '192.168.1.100', family: 'IPv4', internal: false }],
            lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
        };
        const result = getLocalIp(interfaces);
        assert.deepStrictEqual(result, { ip: '192.168.1.100', isHotspot: false });
    });

    await t.test('skips loopback-only, returns localhost', () => {
        const interfaces = {
            lo: [
                { address: '127.0.0.1', family: 'IPv4', internal: true },
                { address: '::1', family: 'IPv6', internal: true },
            ],
        };
        const result = getLocalIp(interfaces);
        assert.deepStrictEqual(result, { ip: 'localhost', isHotspot: false });
    });

    await t.test('sets isHotspot true when ip is 10.42.0.1', () => {
        const interfaces = {
            wlan0: [{ address: '10.42.0.1', family: 'IPv4', internal: false }],
        };
        const result = getLocalIp(interfaces);
        assert.deepStrictEqual(result, { ip: '10.42.0.1', isHotspot: true });
    });

    await t.test('isHotspot false for other non-hotspot IPs', () => {
        const interfaces = {
            eth0: [{ address: '172.16.0.1', family: 'IPv4', internal: false }],
        };
        const result = getLocalIp(interfaces);
        assert.deepStrictEqual(result, { ip: '172.16.0.1', isHotspot: false });
    });

    await t.test('does not mutate the passed interfaces object', () => {
        const interfaces = {
            eth0: [{ address: '10.0.0.5', family: 'IPv4', internal: false }],
        };
        const copy = JSON.parse(JSON.stringify(interfaces));
        getLocalIp(interfaces);
        assert.deepStrictEqual(interfaces, copy);
    });
});
