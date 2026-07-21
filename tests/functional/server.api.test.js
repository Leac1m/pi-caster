import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { describe, test, before, beforeEach, after, afterEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';

// ---------------------------------------------------------------------------
// 1. Environment must be set BEFORE server.js is imported (ESM hoisting).
// ---------------------------------------------------------------------------
const uploadDir = path.join(os.tmpdir(), 'pi-caster-test-' + crypto.randomUUID());
process.env.UPLOAD_DIR = uploadDir;
process.env.NODE_ENV = 'test';

const { app, __testReset } = await import('../../server.js');

// Serve uploads from the same temporary directory multer uses, so that
// GET /uploads/<file> works correctly during functional tests.
app.use('/uploads', express.static(uploadDir));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '../..');
const scanFilePath = path.join(serverDir, 'wifi-scan-results.json');

const originalCwd = process.cwd();

// ---------------------------------------------------------------------------
// Shared helpers / fixtures
// ---------------------------------------------------------------------------
const dummyPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>> >>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
203
%%EOF`;

// ---------------------------------------------------------------------------
// Global hooks
// ---------------------------------------------------------------------------
beforeEach(() => {
    __testReset();
});

after(() => {
    if (fs.existsSync(uploadDir)) {
        fs.rmSync(uploadDir, { recursive: true, force: true });
    }
    if (fs.existsSync(scanFilePath)) {
        fs.unlinkSync(scanFilePath);
    }
    const backupPath = scanFilePath + '.bak';
    if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
    }
    if (process.cwd() !== originalCwd) {
        process.chdir(originalCwd);
    }
});

// ===========================================================================
// Static Routes
// ===========================================================================
describe('Static Routes', () => {
    test('GET / → 200, <h1>PiProjector</h1> and <title>PiProjector Dashboard</title> present', async () => {
        const res = await request(app).get('/').expect(200);
        assert.ok(res.text.includes('<h1>PiProjector</h1>'));
        assert.ok(res.text.includes('<title>PiProjector Dashboard</title>'));
    });

    test('GET /receiver → 200, body includes id="waiting-overlay" and id="remote-video"', async () => {
        const res = await request(app).get('/receiver').expect(200);
        assert.ok(res.text.includes('id="waiting-overlay"'));
        assert.ok(res.text.includes('id="remote-video"'));
    });

    test('GET /remote → 200, body includes Remote Control', async () => {
        const res = await request(app).get('/remote').expect(200);
        assert.ok(res.text.includes('Remote Control'));
    });

    test('GET /sender → 200, body includes Share Screen', async () => {
        const res = await request(app).get('/sender').expect(200);
        assert.ok(res.text.includes('Share Screen'));
    });

    test('GET /captive → 200, body includes cast.pi', async () => {
        const res = await request(app).get('/captive').expect(200);
        assert.ok(res.text.includes('cast.pi'));
    });

    test('GET /index also resolves (extensions fallback) → 200 with same body as /', async () => {
        const res = await request(app).get('/index').expect(200);
        assert.ok(res.text.includes('<h1>PiProjector</h1>'));
        assert.ok(res.text.includes('<title>PiProjector Dashboard</title>'));
    });

    test('GET /unknown-path-xyz → 404', async () => {
        await request(app).get('/unknown-path-xyz').expect(404);
    });
});

// ===========================================================================
// API Routes
// ===========================================================================
describe('API Routes', () => {
    test('GET /api/ip → 200, json { ip: string, isHotspot: boolean }', async () => {
        const res = await request(app).get('/api/ip').expect(200);
        assert.strictEqual(typeof res.body.ip, 'string');
        assert.strictEqual(typeof res.body.isHotspot, 'boolean');
    });

    describe('/api/wifi/scan', () => {
        afterEach(async () => {
            if (fs.existsSync(scanFilePath)) {
                await fs.promises.unlink(scanFilePath);
            }
        });

        test('GET /api/wifi/scan when scan file absent → 200, success:false, networks:[], error present', async () => {
            let backupPath = null;
            if (fs.existsSync(scanFilePath)) {
                backupPath = scanFilePath + '.bak';
                await fs.promises.rename(scanFilePath, backupPath);
            }
            try {
                const res = await request(app).get('/api/wifi/scan').expect(200);
                assert.strictEqual(res.body.success, false);
                assert.deepStrictEqual(res.body.networks, []);
                assert.strictEqual(res.body.error, 'Scan results not available yet');
            } finally {
                if (backupPath && fs.existsSync(backupPath)) {
                    await fs.promises.rename(backupPath, scanFilePath);
                }
            }
        });

        test('GET /api/wifi/scan when valid JSON present → 200, success:true, networks deep-equals contents', async () => {
            const networks = [{ ssid: 'TestNet', signal: -50 }];
            await fs.promises.writeFile(scanFilePath, JSON.stringify(networks));
            const res = await request(app).get('/api/wifi/scan').expect(200);
            assert.strictEqual(res.body.success, true);
            assert.deepStrictEqual(res.body.networks, networks);
        });

        test('GET /api/wifi/scan when file is corrupt JSON → 200, success:false, parse error', async () => {
            await fs.promises.writeFile(scanFilePath, 'not json {');
            const res = await request(app).get('/api/wifi/scan').expect(200);
            assert.strictEqual(res.body.success, false);
            assert.deepStrictEqual(res.body.networks, []);
            assert.strictEqual(res.body.error, 'Failed to parse scan results');
        });
    });

    describe('/api/wifi/connect', () => {
        let wifiTmpDir;

        before(() => {
            wifiTmpDir = path.join(os.tmpdir(), 'pi-caster-wifi-test-' + crypto.randomUUID());
            fs.mkdirSync(wifiTmpDir, { recursive: true });
            process.chdir(wifiTmpDir);
        });

        afterEach(() => {
            const credsPath = path.join(wifiTmpDir, 'wifi-credentials.json');
            if (fs.existsSync(credsPath)) {
                fs.unlinkSync(credsPath);
            }
        });

        after(() => {
            if (process.cwd() !== originalCwd) {
                process.chdir(originalCwd);
            }
            if (fs.existsSync(wifiTmpDir)) {
                fs.rmSync(wifiTmpDir, { recursive: true, force: true });
            }
        });

        test('POST /api/wifi/connect with no body → 400, error: SSID required', async () => {
            const res = await request(app).post('/api/wifi/connect').expect(400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.error, 'SSID required');
        });

        test('POST /api/wifi/connect with empty ssid → 400, error: SSID required', async () => {
            const res = await request(app).post('/api/wifi/connect').send({ ssid: '' }).expect(400);
            assert.strictEqual(res.body.success, false);
            assert.strictEqual(res.body.error, 'SSID required');
        });

        test('POST /api/wifi/connect with valid ssid + password → 200, success:true, file written', async () => {
            const res = await request(app)
                .post('/api/wifi/connect')
                .send({ ssid: 'MyNetwork', password: 'secret123' })
                .expect(200);
            assert.strictEqual(res.body.success, true);
            assert.ok(res.body.message);
            assert.ok(!JSON.stringify(res.body).includes('secret123'), 'password must not be echoed');

            const credsPath = path.join(wifiTmpDir, 'wifi-credentials.json');
            assert.ok(fs.existsSync(credsPath));
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            assert.strictEqual(creds.ssid, 'MyNetwork');
            assert.strictEqual(creds.password, 'secret123');
        });

        test('POST /api/wifi/connect with ssid >32 bytes → 400', async () => {
            const ssid = 'a'.repeat(33);
            const res = await request(app)
                .post('/api/wifi/connect')
                .send({ ssid, password: 'x' })
                .expect(400);
            assert.strictEqual(res.body.error, 'SSID must be at most 32 bytes');
        });

        test('POST /api/wifi/connect with control char in ssid → 400', async () => {
            const res = await request(app)
                .post('/api/wifi/connect')
                .send({ ssid: 'hello\x01world' })
                .expect(400);
            assert.strictEqual(res.body.error, 'SSID must not contain control characters');
        });

        test('POST /api/wifi/connect write-failure → 500, error: Failed to save credentials', async () => {
            if (process.getuid && process.getuid() === 0) {
                console.log('Skipping write-failure test: cannot test EACCES as root');
                return;
            }

            const noWriteDir = path.join(wifiTmpDir, 'no-write');
            fs.mkdirSync(noWriteDir);
            fs.chmodSync(noWriteDir, 0o500);
            const previousCwd = process.cwd();
            process.chdir(noWriteDir);
            try {
                const res = await request(app)
                    .post('/api/wifi/connect')
                    .send({ ssid: 'Net', password: 'pw' })
                    .expect(500);
                assert.strictEqual(res.body.success, false);
                assert.strictEqual(res.body.error, 'Failed to save credentials');
            } finally {
                process.chdir(previousCwd);
                fs.chmodSync(noWriteDir, 0o700);
                fs.rmSync(noWriteDir, { recursive: true, force: true });
            }
        });
    });
});

// ===========================================================================
// Upload Routes
// ===========================================================================
describe('Upload Routes', () => {
    test('POST /upload with no file → 400 text No file uploaded.', async () => {
        const res = await request(app).post('/upload').expect(400);
        assert.strictEqual(res.text, 'No file uploaded.');
    });

    test('POST /upload with valid pdf → 200, success:true, file created on disk', async () => {
        const res = await request(app)
            .post('/upload')
            .attach('presentation', Buffer.from(dummyPdfContent), 'small.pdf')
            .expect(200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.fileUrl.startsWith('/uploads/'));
        assert.ok(res.body.fileUrl.endsWith('.pdf'));

        const files = fs.readdirSync(uploadDir);
        assert.strictEqual(files.length, 1);
        const filePath = path.join(uploadDir, files[0]);
        const content = fs.readFileSync(filePath, 'utf8');
        assert.ok(content.startsWith('%PDF-1.4'));
    });

    test('POST /upload with valid pptx → 200, fileUrl endsWith .pptx', async () => {
        const res = await request(app)
            .post('/upload')
            .attach('presentation', Buffer.from('fake pptx content'), 'small.pptx')
            .expect(200);
        assert.strictEqual(res.body.success, true);
        assert.ok(res.body.fileUrl.endsWith('.pptx'));
    });

    test('POST /upload with wrong extension → 400, error mentions allowed types', async () => {
        const res = await request(app)
            .post('/upload')
            .attach('presentation', Buffer.from('text'), 'small.txt')
            .expect(400);
        assert.ok(res.body.error.includes('Only .pdf and .pptx files are allowed'));
    });

    test('POST /upload with originalname containing path traversal → saved file stays inside UPLOAD_DIR', async () => {
        const res = await request(app)
            .post('/upload')
            .attach('presentation', Buffer.from(dummyPdfContent), '../../../etc/passwd.pdf')
            .expect(200);
        assert.strictEqual(res.body.success, true);

        const files = fs.readdirSync(uploadDir);
        assert.strictEqual(files.length, 1);
        const filePath = path.resolve(uploadDir, files[0]);
        assert.ok(filePath.startsWith(path.resolve(uploadDir)));
        assert.ok(!files[0].includes('..'));
    });

    test('POST /upload when one is already active → purges previous file', async () => {
        const res1 = await request(app)
            .post('/upload')
            .attach('presentation', Buffer.from(dummyPdfContent), 'first.pdf')
            .expect(200);
        const fileName1 = path.basename(res1.body.fileUrl);
        const filePath1 = path.join(uploadDir, fileName1);
        assert.ok(fs.existsSync(filePath1));

        await request(app)
            .post('/upload')
            .attach('presentation', Buffer.from(dummyPdfContent), 'second.pdf')
            .expect(200);

        assert.strictEqual(fs.existsSync(filePath1), false, 'previous file should be purged');
    });

    test('GET /uploads/<uploaded file> → 200 with the correct content', async () => {
        const res = await request(app)
            .post('/upload')
            .attach('presentation', Buffer.from(dummyPdfContent), 'fetch.pdf')
            .expect(200);
        const fileUrl = res.body.fileUrl;

        const getRes = await request(app).get(fileUrl).expect(200);
        assert.ok(getRes.body.toString('utf8').startsWith('%PDF-1.4'));
    });
});

// ===========================================================================
// Static Uploads Security
// ===========================================================================
describe('Static Uploads Security', () => {
    test('GET /uploads/../server.js → MUST not serve server.js (404)', async () => {
        await request(app).get('/uploads/../server.js').expect(404);
    });
});

// ===========================================================================
// Security Headers
// ===========================================================================
describe('Security Headers', () => {
    test('GET / has X-Content-Type-Options: nosniff (helmet)', async () => {
        const res = await request(app).get('/').expect(200);
        assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    });

    test('GET / has Content-Security-Policy header', async () => {
        const res = await request(app).get('/').expect(200);
        assert.ok(res.headers['content-security-policy']);
    });
});
