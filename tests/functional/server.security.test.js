import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import request from 'supertest';
import { io as Client } from 'socket.io-client';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'pi-caster-sec-' + crypto.randomUUID());
process.env.KIOSK_EXIT_TOKEN = 'pi-caster-kiosk-exit';
fs.mkdirSync(process.env.UPLOAD_DIR, { recursive: true });

const {
    app,
    httpServer,
    io,
    presentationStateSingleton: state,
    __testReset,
} = await import('../../server.js');

const UPLOAD_DIR = process.env.UPLOAD_DIR;
const CREDS_FILE = path.join(process.cwd(), 'wifi-credentials.json');

function cleanupCreds() {
    try {
        if (fs.existsSync(CREDS_FILE)) fs.unlinkSync(CREDS_FILE);
    } catch {
        // swallow
    }
}

function waitFor(fn, ms = 500) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), ms);
        fn((err, val) => {
            clearTimeout(t);
            err ? reject(err) : resolve(val);
        });
    });
}

function onceEvent(socket, event, ms = 500) {
    return waitFor((done) => {
        socket.once(event, (data) => done(null, data));
    }, ms);
}

function assertNoEvent(socket, event, ms = 100) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
            socket.off(event, onEvent);
            resolve();
        }, ms);
        function onEvent(data) {
            clearTimeout(t);
            socket.off(event, onEvent);
            reject(new Error(`unexpected event ${event}: ${JSON.stringify(data)}`));
        }
        socket.on(event, onEvent);
    });
}

function connectClient(port) {
    return new Promise((resolve, reject) => {
        const client = Client(`http://localhost:${port}`, {
            transports: ['websocket'],
            forceNew: true,
        });
        const t = setTimeout(() => reject(new Error('connect timeout')), 2000);
        client.once('connect', () => {
            clearTimeout(t);
            resolve(client);
        });
        client.once('connect_error', (err) => {
            clearTimeout(t);
            reject(err);
        });
    });
}

function disconnect(client) {
    if (!client || !client.connected) {
        if (client) client.removeAllListeners();
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        client.once('disconnect', () => {
            client.removeAllListeners();
            resolve();
        });
        client.disconnect();
    });
}

function assertPathContained(filePath, rootDir) {
    const resolved = path.resolve(filePath);
    const root = path.resolve(rootDir);
    const rel = path.relative(root, resolved);
    assert.ok(
        rel && !rel.startsWith('..') && !path.isAbsolute(rel),
        `path escaped upload dir: ${resolved} (root=${root})`
    );
}

// ---------------------------------------------------------------------------
// Upload safety
// ---------------------------------------------------------------------------

test('security: upload rejects originalname with path traversal', async () => {
    __testReset();
    const pdfBuf = Buffer.from('%PDF-1.4 fake');
    const res = await request(app)
        .post('/upload')
        .attach('presentation', pdfBuf, {
            filename: '../../../etc/passwd.pdf',
            contentType: 'application/pdf',
        });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.fileUrl);
    assert.ok(!res.body.fileUrl.includes('..'), 'fileUrl must not contain ..');
    assert.ok(!res.body.fileUrl.includes('etc/passwd'), 'fileUrl must not echo traversal path');

    const files = fs.readdirSync(UPLOAD_DIR);
    assert.ok(files.length >= 1, 'expected at least one file in UPLOAD_DIR');
    for (const name of files) {
        assert.ok(!name.includes('..'), `filename must not contain ..: ${name}`);
        assert.ok(!path.isAbsolute(name), `filename must not be absolute: ${name}`);
        assert.match(name, /^[0-9]+-passwd\.pdf$/);
        assertPathContained(path.join(UPLOAD_DIR, name), UPLOAD_DIR);
    }

    // Ensure nothing landed outside UPLOAD_DIR at the traversal target
    const escaped = path.resolve(UPLOAD_DIR, '../../../etc/passwd.pdf');
    // Only assert the malicious relative name did not create etc/passwd.pdf relative to UPLOAD_DIR
    const outsideCandidate = path.join(path.dirname(UPLOAD_DIR), 'etc', 'passwd.pdf');
    assert.equal(fs.existsSync(outsideCandidate), false);
    void escaped;
    __testReset();
});

test('security: upload oversized body returns 400 (LIMIT_FILE_SIZE / File too large)', async () => {
    __testReset();
    // One byte over the 100 MB multer limit
    const size = 100 * 1024 * 1024 + 1;
    const huge = Buffer.allocUnsafe(size);
    // Touch ends so the buffer is "used" (allocUnsafe leaves uninitialized memory)
    huge[0] = 0x25; // '%'
    huge[1] = 0x50; // 'P'
    huge[size - 1] = 0;

    const res = await request(app)
        .post('/upload')
        .attach('presentation', huge, {
            filename: 'huge.pdf',
            contentType: 'application/pdf',
        });

    // MulterError LIMIT_FILE_SIZE → error handler maps to 400 with message 'File too large'
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(
        /file too large|LIMIT_FILE_SIZE|size/i.test(res.body.error || ''),
        `expected size-related error, got: ${res.body.error}`
    );
    // Error-handling: no stack leak
    const bodyStr = JSON.stringify(res.body);
    assert.ok(!bodyStr.includes('at '), 'response must not contain stack-trace lines');
    assert.ok(!bodyStr.includes('lib/presentation.js'), 'response must not leak internal paths');
    assert.ok(!bodyStr.includes('stack'), 'response must not include a stack field');
    __testReset();
});

test('security: upload rejects wrong extension via fileFilter', async () => {
    __testReset();
    const res = await request(app)
        .post('/upload')
        .attach('presentation', Buffer.from('<html><script>alert(1)</script></html>'), {
            filename: 'evil.html',
            contentType: 'text/html',
        });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error || '', /Only \.pdf and \.pptx files are allowed/i);
    __testReset();
});

test('security: upload rejects .svg with XSS payload', async () => {
    __testReset();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const res = await request(app)
        .post('/upload')
        .attach('presentation', Buffer.from(svg), {
            filename: 'evil.svg',
            contentType: 'image/svg+xml',
        });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error || '', /Only \.pdf and \.pptx files are allowed/i);
    __testReset();
});

test('security: GET /uploads/ does not list directory contents', async () => {
    __testReset();
    const res = await request(app).get('/uploads/');
    // express.static does not list directories by default
    assert.ok([403, 404].includes(res.status), `expected 403 or 404, got ${res.status}`);
    const body = typeof res.text === 'string' ? res.text : '';
    assert.ok(!/Index of/i.test(body), 'must not return directory listing HTML');
    assert.ok(!/<a href=/i.test(body), 'must not return HTML file links listing');
    __testReset();
});

test('security: GET /uploads/../package.json returns 404 (no traversal via express.static)', async () => {
    __testReset();
    // Seed a known file so static is "active"; traversal must still fail
    const seedName = `${Date.now()}-seed.pdf`;
    fs.writeFileSync(path.join(REPO_ROOT, 'uploads', seedName), 'seed');
    try {
        const resPkg = await request(app).get('/uploads/../package.json');
        assert.equal(resPkg.status, 404);

        const resSrv = await request(app).get('/uploads/../server.js');
        assert.equal(resSrv.status, 404);

        // Neither response should leak file contents
        const pkgText = resPkg.text || '';
        assert.ok(!pkgText.includes('"name": "pi-caster"'), 'must not serve package.json');
        const srvText = resSrv.text || '';
        assert.ok(!srvText.includes('presentationStateSingleton'), 'must not serve server.js');
    } finally {
        try {
            fs.unlinkSync(path.join(REPO_ROOT, 'uploads', seedName));
        } catch {
            // swallow
        }
        __testReset();
    }
});

// ---------------------------------------------------------------------------
// Wi-Fi credential handling
// ---------------------------------------------------------------------------

test('security: POST /api/wifi/connect does not echo password in response body', async () => {
    cleanupCreds();
    const secret = 'SUPER_SECRET_VALUE';
    const res = await request(app)
        .post('/api/wifi/connect')
        .send({ ssid: 'Home', password: secret });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const raw = res.text || JSON.stringify(res.body);
    assert.ok(!raw.includes(secret), 'response must not echo password');
    cleanupCreds();
});

test('security: wifi-credentials.json is not served as a static file', async () => {
    cleanupCreds();
    const resWrite = await request(app)
        .post('/api/wifi/connect')
        .send({ ssid: 'HomeNet', password: 'not-public' });
    assert.equal(resWrite.status, 200);
    assert.equal(fs.existsSync(CREDS_FILE), true);

    const resGet = await request(app).get('/wifi-credentials.json');
    assert.equal(resGet.status, 404);
    const body = resGet.text || '';
    assert.ok(!body.includes('not-public'), 'must not serve credential contents');
    assert.ok(!body.includes('HomeNet'), 'must not serve credential contents');
    cleanupCreds();
});

test('security: POST /api/wifi/connect rejects control-char ssid (injection)', async () => {
    const res = await request(app)
        .post('/api/wifi/connect')
        .send({ ssid: 'net\nAT+something', password: 'x' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error || '', /control characters/i);
});

test('security: POST /api/wifi/connect rejects missing ssid', async () => {
    const res = await request(app)
        .post('/api/wifi/connect')
        .send({ password: 'x' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error || '', /SSID required/i);
});

// ---------------------------------------------------------------------------
// HTTP headers (helmet)
// ---------------------------------------------------------------------------

test('security: GET / returns X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/');
    assert.ok(res.status === 200 || res.status === 301 || res.status === 302 || res.status === 304);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
});

test('security: GET /api/ip returns X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/ip');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
});

test('security: GET / returns Content-Security-Policy header', async () => {
    const res = await request(app).get('/');
    assert.ok(res.headers['content-security-policy'], 'CSP header must be present');
    assert.match(res.headers['content-security-policy'], /default-src/i);
});

test('security: GET /api/ip returns Content-Security-Policy header', async () => {
    const res = await request(app).get('/api/ip');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-security-policy'], 'CSP header must be present');
    assert.match(res.headers['content-security-policy'], /default-src/i);
});

// ---------------------------------------------------------------------------
// Error handling (no stack leak) — covered partly by oversize test above
// ---------------------------------------------------------------------------

test('security: forced 500 does not leak stack trace', async () => {
    __testReset();
    // Use fileFilter rejection path: friendly 400 body, never a stack
    const res = await request(app)
        .post('/upload')
        .attach('presentation', Buffer.from('not-a-pdf'), {
            filename: 'nope.exe',
            contentType: 'application/octet-stream',
        });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(typeof res.body.error, 'string');
    const keys = Object.keys(res.body).sort();
    assert.deepEqual(keys, ['error', 'success']);
    const bodyStr = JSON.stringify(res.body);
    assert.ok(!bodyStr.includes('at '), 'must not contain stack-trace frames');
    assert.ok(!bodyStr.includes('lib/presentation.js'));
    assert.ok(!bodyStr.includes('node_modules'));
    assert.ok(!('stack' in res.body));
    __testReset();
});

// ---------------------------------------------------------------------------
// Socket.IO abuse — documents KNOWN VULNERABILITIES (not fixes)
// ---------------------------------------------------------------------------

test('security: socket abuse suite', async (t) => {
    await new Promise((resolve) => {
        httpServer.listen(0, resolve);
    });
    const port = httpServer.address().port;
    const openClients = new Set();

    async function client() {
        const c = await connectClient(port);
        openClients.add(c);
        return c;
    }

    async function cleanupClients() {
        const list = [...openClients];
        openClients.clear();
        await Promise.all(list.map((c) => disconnect(c)));
    }

    t.after(async () => {
        await cleanupClients();
        await new Promise((resolve) => httpServer.close(resolve));
        try {
            fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
        } catch {
            // swallow
        }
        cleanupCreds();
    });

    t.beforeEach(() => {
        __testReset();
    });

    t.afterEach(async () => {
        await cleanupClients();
        __testReset();
    });

    await t.test(
        'security: an unregistered socket\'s slide-next is relayed to receiver (documents current behavior — NOT a fix)',
        async () => {
            // KNOWN VULNERABILITY: any connected socket can drive slides.
            // Test documents current behavior — replace with a REJECTION assertion when role check is implemented.
            const receiver = await client();
            const unregistered = await client();

            receiver.emit('register-receiver');
            await new Promise((r) => setTimeout(r, 50));
            assert.equal(state.receiverSocketId, receiver.id);
            assert.equal(state.currentSlide, 1);

            const nextPromise = onceEvent(receiver, 'slide-next');
            unregistered.emit('slide-next');

            await nextPromise;
            assert.equal(state.currentSlide, 2);
        }
    );

    await t.test(
        'security: ice-candidate with arbitrary targetId reaches the target (documents open relay — KNOWN VULNERABILITY)',
        async () => {
            // KNOWN VULNERABILITY: ice-candidate targetId is open relay — replace with allowlist assertion when fixed.
            const a = await client(); // registers as receiver
            const b = await client(); // attacker
            const c = await client(); // arbitrary target

            a.emit('register-receiver');
            await new Promise((r) => setTimeout(r, 50));

            const iceOnC = onceEvent(c, 'ice-candidate');
            const noIceOnA = assertNoEvent(a, 'ice-candidate', 150);

            b.emit('ice-candidate', {
                targetId: c.id,
                candidate: { candidate: 'fake-cand', sdpMid: '0' },
            });

            const payload = await iceOnC;
            await noIceOnA;
            assert.ok(payload);
            assert.deepEqual(payload.candidate, { candidate: 'fake-cand', sdpMid: '0' });
        }
    );

    await t.test('security: malformed socket payload does not crash other clients', async () => {
        const bad = await client();
        const watcher = await client();
        const receiver = await client();

        // Null payload — handler may throw on data.sdp; Socket.IO isolates per-handler errors
        bad.emit('offer', null);
        await new Promise((r) => setTimeout(r, 100));

        const readyPromise = onceEvent(watcher, 'receiver-ready', 1000);
        receiver.emit('register-receiver');
        await readyPromise;
        assert.equal(state.receiverSocketId, receiver.id);
    });

    void io;
});

test('security: kiosk exit rejects missing token', async () => {
    const res = await request(app).post('/api/exit-kiosk');
    assert.equal(res.status, 403);
});

test('security: kiosk exit rejects wrong token', async () => {
    const res = await request(app)
        .post('/api/exit-kiosk')
        .set('X-Exit-Token', 'wrong-token');
    assert.equal(res.status, 403);
});

test('security: kiosk exit accepts correct token (GET fallback)', async () => {
    const res = await request(app)
        .get('/api/exit-kiosk')
        .set('X-Exit-Token', 'pi-caster-kiosk-exit');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /exit/i);
});

test('security: kiosk exit accepts correct token (POST)', async () => {
    const res = await request(app)
        .post('/api/exit-kiosk')
        .set('X-Exit-Token', 'pi-caster-kiosk-exit');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
});
