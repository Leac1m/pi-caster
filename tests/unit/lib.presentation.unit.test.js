import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PresentationState } from '../../lib/presentation.js';

test('PresentationState', async (t) => {
    await t.test('start() sets path, url, and resets currentSlide to 1', () => {
        const ps = new PresentationState();
        ps.start({ path: '/tmp/test.pdf', url: '/pres/test.pdf' });
        assert.strictEqual(ps.activePresentationPath, '/tmp/test.pdf');
        assert.strictEqual(ps.activePresentationUrl, '/pres/test.pdf');
        assert.strictEqual(ps.currentSlide, 1);
    });

    await t.test('next() increments currentSlide', () => {
        const ps = new PresentationState();
        ps.next();
        assert.strictEqual(ps.currentSlide, 2);
        ps.next();
        assert.strictEqual(ps.currentSlide, 3);
    });

    await t.test('prev() decrements currentSlide', () => {
        const ps = new PresentationState();
        ps.next();
        ps.next();
        assert.strictEqual(ps.currentSlide, 3);
        ps.prev();
        assert.strictEqual(ps.currentSlide, 2);
    });

    await t.test('prev() floors at 1', () => {
        const ps = new PresentationState();
        assert.strictEqual(ps.currentSlide, 1);
        ps.prev();
        assert.strictEqual(ps.currentSlide, 1);
    });

    await t.test('mixed next/prev never goes below 1', () => {
        const ps = new PresentationState();
        ps.next();
        ps.next();
        ps.prev();
        ps.prev();
        ps.prev();
        ps.prev();
        assert.strictEqual(ps.currentSlide, 1);
    });

    await t.test('purge() deletes tmp file and clears state', () => {
        const tmpFile = path.join(os.tmpdir(), crypto.randomUUID() + '.pdf');
        fs.writeFileSync(tmpFile, 'test content');

        const ps = new PresentationState();
        ps.start({ path: tmpFile, url: '/pres/test.pdf' });
        ps.next();
        ps.next();
        assert.strictEqual(ps.currentSlide, 3);

        ps.purge();

        assert.strictEqual(ps.activePresentationPath, null);
        assert.strictEqual(ps.activePresentationUrl, null);
        assert.strictEqual(ps.currentSlide, 1);
        assert.ok(!fs.existsSync(tmpFile));
    });

    await t.test('purge() no-op when activePresentationPath is null', () => {
        const ps = new PresentationState();
        assert.doesNotThrow(() => {
            ps.purge();
        });
        assert.strictEqual(ps.activePresentationPath, null);
        assert.strictEqual(ps.activePresentationUrl, null);
        assert.strictEqual(ps.currentSlide, 1);
    });

    await t.test('purge() swallows fs errors and still clears state', () => {
        const fakeFs = {
            existsSync: () => true,
            unlinkSync: () => {
                throw new Error('EACCES: permission denied');
            },
        };
        const ps = new PresentationState(fakeFs);
        ps.start({ path: '/fake/path.pdf', url: '/pres/fake.pdf' });

        assert.doesNotThrow(() => {
            ps.purge();
        });

        assert.strictEqual(ps.activePresentationPath, null);
        assert.strictEqual(ps.activePresentationUrl, null);
        assert.strictEqual(ps.currentSlide, 1);
    });

    await t.test('reset() nulls all fields', () => {
        const ps = new PresentationState();
        ps.receiverSocketId = 'socket1';
        ps.remoteSocketId = 'socket2';
        ps.start({ path: '/tmp/test.pdf', url: '/pres/test.pdf' });
        ps.next();
        ps.next();

        ps.reset();

        assert.strictEqual(ps.receiverSocketId, null);
        assert.strictEqual(ps.remoteSocketId, null);
        assert.strictEqual(ps.activePresentationPath, null);
        assert.strictEqual(ps.activePresentationUrl, null);
        assert.strictEqual(ps.currentSlide, 1);
    });

    await t.test('stop() delegates to purge', () => {
        const tmpFile = path.join(os.tmpdir(), crypto.randomUUID() + '.pdf');
        fs.writeFileSync(tmpFile, 'test content');

        const ps = new PresentationState();
        ps.start({ path: tmpFile, url: '/pres/test.pdf' });

        ps.stop();

        assert.strictEqual(ps.activePresentationPath, null);
        assert.strictEqual(ps.activePresentationUrl, null);
        assert.strictEqual(ps.currentSlide, 1);
        assert.ok(!fs.existsSync(tmpFile));
    });
});
