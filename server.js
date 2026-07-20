import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import os from 'os';

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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

let receiverSocketId = null;
let activePresentationPath = null;
let remoteSocketId = null;

// Local IP Route
app.get('/api/ip', (req, res) => {
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';
    let isHotspot = false;
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                if (localIp === '10.42.0.1') {
                    isHotspot = true;
                }
                break;
            }
        }
        if (localIp !== 'localhost') break;
    }
    res.json({ ip: localIp, isHotspot: isHotspot });
});

// Captive Portal Wi-Fi Scan
app.get('/api/wifi/scan', (req, res) => {
    const scanFile = path.join(__dirname, 'wifi-scan-results.json');
    if (fs.existsSync(scanFile)) {
        try {
            const data = fs.readFileSync(scanFile, 'utf8');
            res.json({ success: true, networks: JSON.parse(data) });
        } catch (e) {
            res.json({ success: false, networks: [], error: 'Failed to parse scan results' });
        }
    } else {
        res.json({ success: false, networks: [], error: 'Scan results not available yet' });
    }
});

// Captive Portal Wi-Fi Connect
app.post('/api/wifi/connect', (req, res) => {
    const { ssid, password } = req.body;
    if (!ssid) {
        return res.status(400).json({ success: false, error: 'SSID required' });
    }
    
    const credsFile = path.join(__dirname, 'wifi-credentials.json');
    try {
        fs.writeFileSync(credsFile, JSON.stringify({ ssid, password }));
        res.json({ success: true, message: 'Credentials saved. Applying new network configuration...' });
    } catch (e) {
        console.error("Failed to write wifi credentials:", e);
        res.status(500).json({ success: false, error: 'Failed to save credentials' });
    }
});

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
