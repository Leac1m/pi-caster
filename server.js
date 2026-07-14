import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Multer config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

let receiverSocketId = null;
let activePresentationPath = null;
let remoteSocketId = null;

// File Upload Route
app.post('/upload', upload.single('presentation'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    
    // Purge old presentation if it exists
    purgePresentation();

    activePresentationPath = req.file.path;
    const fileUrl = `/uploads/${req.file.filename}`;

    // Notify receiver
    if (receiverSocketId) {
        io.to(receiverSocketId).emit('presentation-start', { fileUrl });
    }

    res.json({ success: true, fileUrl });
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register-receiver', () => {
        receiverSocketId = socket.id;
        console.log('Receiver registered:', socket.id);
        socket.broadcast.emit('receiver-ready');
    });

    socket.on('register-remote', () => {
        remoteSocketId = socket.id;
        console.log('Remote registered:', socket.id);
    });

    // Presentation Control Events
    socket.on('slide-next', () => {
        if (receiverSocketId) io.to(receiverSocketId).emit('slide-next');
    });

    socket.on('slide-prev', () => {
        if (receiverSocketId) io.to(receiverSocketId).emit('slide-prev');
    });

    socket.on('presentation-stop', () => {
        if (receiverSocketId) io.to(receiverSocketId).emit('presentation-stop');
        purgePresentation();
    });

    // Screen Share Events
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
        if (socket.id === remoteSocketId) {
            remoteSocketId = null;
            console.log('Remote disconnected, stopping presentation');
            if (receiverSocketId) io.to(receiverSocketId).emit('presentation-stop');
            purgePresentation();
        }
    });
});

function purgePresentation() {
    if (activePresentationPath && fs.existsSync(activePresentationPath)) {
        try {
            fs.unlinkSync(activePresentationPath);
            console.log('Purged active presentation');
        } catch (e) {
            console.error('Failed to purge presentation', e);
        }
        activePresentationPath = null;
    }
}

export { app, httpServer, io };

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
    httpServer.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}
