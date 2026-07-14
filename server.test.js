import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { io as Client } from 'socket.io-client';
import { app, httpServer } from './server.js';

test('Server endpoints and sockets', async (t) => {
    // Start the server for tests
    await new Promise((resolve) => {
        httpServer.listen(0, resolve);
    });

    const port = httpServer.address().port;

    await t.test('GET / serves static index.html', async () => {
        const response = await request(app).get('/');
        assert.strictEqual(response.status, 200);
        assert.ok(response.text.includes('PiProjector Dashboard'));
    });

    await t.test('POST /upload without file returns 400', async () => {
        const response = await request(app).post('/upload');
        assert.strictEqual(response.status, 400);
        assert.strictEqual(response.text, 'No file uploaded.');
    });

    await t.test('WebSocket connections and events', async () => {
        const receiverSocket = Client(`http://localhost:${port}`);
        
        await new Promise((resolve) => {
            receiverSocket.on('connect', resolve);
        });

        assert.strictEqual(receiverSocket.connected, true);

        // Test that emitting register-receiver broadcasts receiver-ready
        const senderSocket = Client(`http://localhost:${port}`);
        await new Promise((resolve) => {
            senderSocket.on('connect', resolve);
        });

        await new Promise((resolve) => {
            senderSocket.on('receiver-ready', () => {
                assert.ok(true);
                resolve();
            });
            receiverSocket.emit('register-receiver');
        });

        receiverSocket.disconnect();
        senderSocket.disconnect();
    });

    // Cleanup
    httpServer.close();
});
