import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import { io as Client } from 'socket.io-client';

process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'pi-caster-int-' + crypto.randomUUID());
fs.mkdirSync(process.env.UPLOAD_DIR, { recursive: true });

const {
    httpServer,
    presentationStateSingleton: state,
    __testReset,
} = await import('../../server.js');

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

function seedTmpFile(name = 'seeded.pdf') {
    const filePath = path.join(process.env.UPLOAD_DIR, name);
    fs.writeFileSync(filePath, 'fake-pdf-content');
    return filePath;
}

let port;
const openClients = new Set();

async function client(p = port) {
    const c = await connectClient(p);
    openClients.add(c);
    const origDisconnect = c.disconnect.bind(c);
    c.disconnect = () => {
        openClients.delete(c);
        return origDisconnect();
    };
    return c;
}

async function cleanupClients() {
    const list = [...openClients];
    openClients.clear();
    await Promise.all(list.map((c) => disconnect(c)));
}

test('Socket integration', async (t) => {
    await new Promise((resolve) => {
        httpServer.listen(0, resolve);
    });
    port = httpServer.address().port;

    t.after(async () => {
        await cleanupClients();
        await new Promise((resolve) => httpServer.close(resolve));
        try {
            fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
        } catch {
            // swallow
        }
    });

    t.beforeEach(() => {
        __testReset();
    });

    t.afterEach(async () => {
        await cleanupClients();
        __testReset();
    });

    // --- Per-event isolation ---

    await t.test('1. register-receiver sets receiverSocketId and broadcasts receiver-ready to others only', async () => {
        const other = await client();
        const receiver = await client();

        const readyPromise = onceEvent(other, 'receiver-ready');
        const noReadyOnSelf = assertNoEvent(receiver, 'receiver-ready', 150);

        receiver.emit('register-receiver');

        await readyPromise;
        await noReadyOnSelf;
        assert.equal(state.receiverSocketId, receiver.id);
    });

    await t.test('2. register-receiver replays presentation-start when active', async () => {
        const filePath = seedTmpFile('seeded.pdf');
        state.start({ path: filePath, url: '/uploads/seeded.pdf' });
        state.currentSlide = 3;

        const receiver = await client();
        const startPromise = onceEvent(receiver, 'presentation-start');
        receiver.emit('register-receiver');

        const payload = await startPromise;
        assert.deepEqual(payload, { fileUrl: '/uploads/seeded.pdf', slide: 3 });
    });

    await t.test('3. register-receiver does NOT emit presentation-start when no active presentation', async () => {
        const receiver = await client();
        const noStart = assertNoEvent(receiver, 'presentation-start', 100);
        receiver.emit('register-receiver');
        await noStart;
    });

    await t.test('4. register-remote sets remoteSocketId AND replays presentation-start when active', async () => {
        const filePath = seedTmpFile('seeded-remote.pdf');
        state.start({ path: filePath, url: '/uploads/seeded-remote.pdf' });
        state.currentSlide = 3;

        const remote = await client();
        const startPromise = onceEvent(remote, 'presentation-start');
        remote.emit('register-remote');

        const payload = await startPromise;
        assert.equal(state.remoteSocketId, remote.id);
        assert.deepEqual(payload, { fileUrl: '/uploads/seeded-remote.pdf', slide: 3 });
    });

    await t.test('5. register-remote does NOT broadcast receiver-ready', async () => {
        const other = await client();
        const remote = await client();

        const noReady = assertNoEvent(other, 'receiver-ready', 100);
        remote.emit('register-remote');
        await noReady;
        assert.equal(state.remoteSocketId, remote.id);
    });

    await t.test('6. slide-next from remote: increments slide, only receiver gets event', async () => {
        const receiver = await client();
        const remote = await client();
        const third = await client();

        receiver.emit('register-receiver');
        remote.emit('register-remote');
        await new Promise((r) => setTimeout(r, 50));

        assert.equal(state.currentSlide, 1);

        const nextPromise = onceEvent(receiver, 'slide-next');
        const noNextThird = assertNoEvent(third, 'slide-next', 100);

        remote.emit('slide-next');

        await nextPromise;
        await noNextThird;
        assert.equal(state.currentSlide, 2);
    });

    await t.test('7. slide-prev from currentSlide=1: state stays 1, receiver still gets event', async () => {
        // Documents current behavior: server emits slide-prev unconditionally even at floor.
        const receiver = await client();
        const remote = await client();

        receiver.emit('register-receiver');
        remote.emit('register-remote');
        await new Promise((r) => setTimeout(r, 50));

        state.currentSlide = 1;

        const prevPromise = onceEvent(receiver, 'slide-prev');
        remote.emit('slide-prev');

        await prevPromise;
        assert.equal(state.currentSlide, 1);
    });

    await t.test('8. slide-prev from currentSlide=2: state becomes 1', async () => {
        const receiver = await client();
        const remote = await client();

        receiver.emit('register-receiver');
        remote.emit('register-remote');
        await new Promise((r) => setTimeout(r, 50));

        state.currentSlide = 2;

        const prevPromise = onceEvent(receiver, 'slide-prev');
        remote.emit('slide-prev');

        await prevPromise;
        assert.equal(state.currentSlide, 1);
    });

    await t.test('9. presentation-stop: receiver gets event, purge deletes seeded file', async () => {
        const filePath = seedTmpFile('stop-me.pdf');
        state.start({ path: filePath, url: '/uploads/stop-me.pdf' });

        const receiver = await client();
        const remote = await client();
        receiver.emit('register-receiver');
        remote.emit('register-remote');
        await new Promise((r) => setTimeout(r, 50));

        assert.equal(fs.existsSync(filePath), true);

        const stopPromise = onceEvent(receiver, 'presentation-stop');
        remote.emit('presentation-stop');
        await stopPromise;

        assert.equal(fs.existsSync(filePath), false);
        assert.equal(state.activePresentationPath, null);
        assert.equal(state.activePresentationUrl, null);
    });

    await t.test('10. presentation-stop with NO receiver: no crash, file still purged', async () => {
        const filePath = seedTmpFile('stop-no-recv.pdf');
        state.start({ path: filePath, url: '/uploads/stop-no-recv.pdf' });

        const remote = await client();
        remote.emit('register-remote');
        await new Promise((r) => setTimeout(r, 50));

        assert.equal(state.receiverSocketId, null);
        remote.emit('presentation-stop');
        await new Promise((r) => setTimeout(r, 100));

        assert.equal(fs.existsSync(filePath), false);
        assert.equal(state.activePresentationPath, null);
    });

    await t.test('11. offer from sender: receiver gets sdp and senderId', async () => {
        const receiver = await client();
        const sender = await client();
        receiver.emit('register-receiver');
        await new Promise((r) => setTimeout(r, 50));

        const offerPromise = onceEvent(receiver, 'offer');
        sender.emit('offer', { sdp: 'fake-sdp-offer' });

        const payload = await offerPromise;
        assert.equal(payload.sdp, 'fake-sdp-offer');
        assert.equal(payload.senderId, sender.id);
    });

    await t.test('12. offer when no receiver: silently dropped', async () => {
        const sender = await client();
        const other = await client();

        const noOfferSender = assertNoEvent(sender, 'offer', 100);
        const noOfferOther = assertNoEvent(other, 'offer', 100);
        sender.emit('offer', { sdp: 'orphan-offer' });
        await noOfferSender;
        await noOfferOther;
    });

    await t.test('13. answer roundtrip: receiver answers offer to original sender', async () => {
        const receiver = await client();
        const sender = await client();
        receiver.emit('register-receiver');
        await new Promise((r) => setTimeout(r, 50));

        const offerPromise = onceEvent(receiver, 'offer');
        sender.emit('offer', { sdp: 'offer-sdp' });
        const offer = await offerPromise;

        const answerPromise = onceEvent(sender, 'answer');
        receiver.emit('answer', { sdp: 'answer-sdp', senderId: offer.senderId });

        const answer = await answerPromise;
        assert.equal(answer.sdp, 'answer-sdp');
    });

    await t.test('14. ice-candidate with target receiver: only receiver gets it', async () => {
        const receiver = await client();
        const sender = await client();
        const other = await client();
        receiver.emit('register-receiver');
        await new Promise((r) => setTimeout(r, 50));

        const icePromise = onceEvent(receiver, 'ice-candidate');
        const noIceOther = assertNoEvent(other, 'ice-candidate', 100);

        sender.emit('ice-candidate', { target: 'receiver', candidate: 'cand-1' });

        const payload = await icePromise;
        await noIceOther;
        assert.equal(payload.candidate, 'cand-1');
        assert.equal(payload.senderId, sender.id);
    });

    await t.test('15. ice-candidate with targetId: only that socket receives it', async () => {
        const a = await client();
        const b = await client();
        const c = await client();

        const icePromise = onceEvent(b, 'ice-candidate');
        const noIceA = assertNoEvent(a, 'ice-candidate', 100);
        const noIceC = assertNoEvent(c, 'ice-candidate', 100);

        a.emit('ice-candidate', { targetId: b.id, candidate: 'cand-targetId' });

        const payload = await icePromise;
        await noIceA;
        await noIceC;
        assert.equal(payload.candidate, 'cand-targetId');
    });

    await t.test('16. ice-candidate with neither target nor targetId: silently ignored', async () => {
        const a = await client();
        const b = await client();
        const c = await client();

        const noA = assertNoEvent(a, 'ice-candidate', 100);
        const noB = assertNoEvent(b, 'ice-candidate', 100);
        const noC = assertNoEvent(c, 'ice-candidate', 100);

        a.emit('ice-candidate', { candidate: 'orphan-cand' });
        await Promise.all([noA, noB, noC]);
    });

    // --- Multi-client scenarios ---

    await t.test('17. receiver + remote + sender coexist: offer/answer isolation', async () => {
        const receiver = await client();
        const remote = await client();
        const sender = await client();

        receiver.emit('register-receiver');
        remote.emit('register-remote');
        await new Promise((r) => setTimeout(r, 50));

        const offerPromise = onceEvent(receiver, 'offer');
        const noOfferRemote = assertNoEvent(remote, 'offer', 100);
        sender.emit('offer', { sdp: 'coexist-offer' });
        const offer = await offerPromise;
        await noOfferRemote;

        const answerPromise = onceEvent(sender, 'answer');
        const noAnswerRemote = assertNoEvent(remote, 'answer', 100);
        receiver.emit('answer', { sdp: 'coexist-answer', senderId: offer.senderId });
        await answerPromise;
        await noAnswerRemote;
    });

    await t.test('18. receiver disconnect clears receiverSocketId; subsequent offer dropped', async () => {
        const receiver = await client();
        const sender = await client();
        const watcher = await client();

        receiver.emit('register-receiver');
        await new Promise((r) => setTimeout(r, 50));
        assert.equal(state.receiverSocketId, receiver.id);

        await disconnect(receiver);
        openClients.delete(receiver);
        await new Promise((r) => setTimeout(r, 50));
        assert.equal(state.receiverSocketId, null);

        const noOffer = assertNoEvent(watcher, 'offer', 100);
        sender.emit('offer', { sdp: 'after-disconnect' });
        await noOffer;
    });

    await t.test('19. remote disconnect clears remoteSocketId but does NOT purge presentation', async () => {
        const filePath = seedTmpFile('remote-persist.pdf');
        state.start({ path: filePath, url: '/uploads/remote-persist.pdf' });

        const remote = await client();
        remote.emit('register-remote');
        await new Promise((r) => setTimeout(r, 50));
        assert.equal(state.remoteSocketId, remote.id);

        await disconnect(remote);
        openClients.delete(remote);
        await new Promise((r) => setTimeout(r, 50));

        assert.equal(state.remoteSocketId, null);
        assert.equal(fs.existsSync(filePath), true);
        assert.equal(state.activePresentationPath, filePath);
    });

    await t.test('20. receiver disconnect does NOT purge presentation', async () => {
        const filePath = seedTmpFile('recv-persist.pdf');
        state.start({ path: filePath, url: '/uploads/recv-persist.pdf' });

        const receiver = await client();
        receiver.emit('register-receiver');
        await new Promise((r) => setTimeout(r, 50));

        await disconnect(receiver);
        openClients.delete(receiver);
        await new Promise((r) => setTimeout(r, 50));

        assert.equal(state.receiverSocketId, null);
        assert.equal(fs.existsSync(filePath), true);
        assert.equal(state.activePresentationPath, filePath);
        assert.equal(state.activePresentationUrl, '/uploads/recv-persist.pdf');
    });

    await t.test('21. receiver reconnect gets presentation-start replay', async () => {
        const filePath = seedTmpFile('reconnect.pdf');
        state.start({ path: filePath, url: '/uploads/reconnect.pdf' });
        state.currentSlide = 4;

        const receiver1 = await client();
        const firstStart = onceEvent(receiver1, 'presentation-start');
        receiver1.emit('register-receiver');
        await firstStart;

        await disconnect(receiver1);
        openClients.delete(receiver1);
        await new Promise((r) => setTimeout(r, 50));

        assert.equal(fs.existsSync(filePath), true);
        assert.equal(state.activePresentationUrl, '/uploads/reconnect.pdf');

        const receiver2 = await client();
        const replay = onceEvent(receiver2, 'presentation-start');
        receiver2.emit('register-receiver');
        const payload = await replay;
        assert.deepEqual(payload, { fileUrl: '/uploads/reconnect.pdf', slide: 4 });
    });

    await t.test('22. multiple register-remote calls: last wins', async () => {
        const r1 = await client();
        const r2 = await client();

        r1.emit('register-remote');
        await new Promise((r) => setTimeout(r, 50));
        assert.equal(state.remoteSocketId, r1.id);

        r2.emit('register-remote');
        await new Promise((r) => setTimeout(r, 50));
        assert.equal(state.remoteSocketId, r2.id);
        assert.notEqual(state.remoteSocketId, r1.id);
    });

    // --- Payload validation ---

    await t.test('23. offer with data=null does not kill server; other clients still work', async () => {
        const badSender = await client();
        const other = await client();
        const receiver = await client();

        // Bad payload — server.js does data.sdp which throws on null.
        // Socket.IO isolates handler exceptions per-connection.
        badSender.emit('offer', null);
        await new Promise((r) => setTimeout(r, 100));

        // Server must still be responsive for other clients
        const readyPromise = onceEvent(other, 'receiver-ready', 1000);
        receiver.emit('register-receiver');
        await readyPromise;
        assert.equal(state.receiverSocketId, receiver.id);
    });

});
