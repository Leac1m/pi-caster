import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, 'public')));

let receiverSocketId = null;

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register-receiver', () => {
        receiverSocketId = socket.id;
        console.log('Receiver registered:', socket.id);
        socket.broadcast.emit('receiver-ready');
    });

    socket.on('offer', (data) => {
        console.log('Offer received from', socket.id);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('offer', { sdp: data.sdp, senderId: socket.id });
        }
    });

    socket.on('answer', (data) => {
        console.log('Answer sent to', data.senderId);
        io.to(data.senderId).emit('answer', { sdp: data.sdp });
    });

    socket.on('ice-candidate', (data) => {
        if (data.target === 'receiver' && receiverSocketId) {
            io.to(receiverSocketId).emit('ice-candidate', { candidate: data.candidate, senderId: socket.id });
        } else if (data.targetId) {
            io.to(data.targetId).emit('ice-candidate', { candidate: data.candidate });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.id === receiverSocketId) {
            receiverSocketId = null;
            console.log('Receiver disconnected');
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
