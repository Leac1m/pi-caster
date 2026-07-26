import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import helmet from 'helmet';
import { getLocalIp } from './lib/ip.js';
import { sanitizeFilename } from './lib/filename.js';
import { presentationStateSingleton } from './lib/presentation.js';
import { validateWifiInput } from './lib/wifi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const state = presentationStateSingleton;

// Multer config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, sanitizeFilename(file.originalname));
    }
});

function fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' || ext === '.pptx') {
        cb(null, true);
    } else {
        cb(new Error('Only .pdf and .pptx files are allowed'));
    }
}

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter
});

app.use(helmet({
    // Existing public/*.html uses inline scripts/handlers; keep other helmet defaults.
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            workerSrc: ["'self'", "blob:"],
            fontSrc: ["'self'", "data:", "https:"],
            objectSrc: ["'self'", "blob:", "data:"],
            frameSrc: ["'self'", "blob:", "data:"],
        },
    },
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Local IP Route
app.get('/api/ip', (req, res) => {
    const { ip, isHotspot } = getLocalIp(os.networkInterfaces());
    res.json({ ip, isHotspot });
});

// Captive Portal Wi-Fi Scan
app.get('/api/wifi/scan', (req, res) => {
    const scanFile = path.join(__dirname, 'wifi-scan-results.json');
    if (fs.existsSync(scanFile)) {
        try {
            const data = fs.readFileSync(scanFile, 'utf8');
            res.json({ success: true, networks: JSON.parse(data) });
        } catch {
            res.json({ success: false, networks: [], error: 'Failed to parse scan results' });
        }
    } else {
        res.json({ success: false, networks: [], error: 'Scan results not available yet' });
    }
});

// Captive Portal Wi-Fi Connect
app.post('/api/wifi/connect', (req, res) => {
    const { ssid, password } = req.body;
    const validation = validateWifiInput({ ssid, password });
    if (!validation.ok) {
        return res.status(400).json({ success: false, error: validation.error });
    }

    const credsFile = path.join(process.cwd(), 'wifi-credentials.json');
    try {
        fs.writeFileSync(credsFile, JSON.stringify({ ssid, password }));
        res.json({ success: true, message: 'Credentials saved. Applying new network configuration...' });
    } catch (err) {
        console.error("Failed to write wifi credentials:", err);
        res.status(500).json({ success: false, error: 'Failed to save credentials' });
    }
});

// Kiosk Escape — exits Chromium kiosk and returns to desktop
// Called by ESC key in receiver.html or via magic URL.
// Guard: in production (Pi) this should only be reachable from the local machine
// or from the Pi's own hotspot LAN. For added safety, requires the kiosk-exit-token header.
const KIOSK_EXIT_TOKEN = process.env.KIOSK_EXIT_TOKEN || 'pi-caster-kiosk-exit';

app.post('/api/exit-kiosk', (req, res) => {
    const token = req.headers['x-exit-token'];
    if (token !== KIOSK_EXIT_TOKEN) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const script = path.join(__dirname, 'scripts', 'exit-kiosk.sh');
    if (!fs.existsSync(script)) {
        return res.status(500).json({ success: false, error: 'Exit script not found' });
    }

    const child = spawn('sudo', ['bash', script], {
        stdio: 'ignore',
        detached: true,
        uid: parseInt(process.env.SUDO_UID || '1000', 10),
    });
    child.unref();

    res.json({ success: true, message: 'Kiosk exit triggered.' });
});

// GET fallback for kiosk exit (e.g. typing the URL directly in the browser address bar)
app.get('/api/exit-kiosk', (req, res) => {
    const token = req.headers['x-exit-token'] || req.query.token;
    if (token !== KIOSK_EXIT_TOKEN) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const script = path.join(__dirname, 'scripts', 'exit-kiosk.sh');
    if (!fs.existsSync(script)) {
        return res.status(500).json({ success: false, error: 'Exit script not found' });
    }

    const child = spawn('sudo', ['bash', script], {
        stdio: 'ignore',
        detached: true,
        uid: parseInt(process.env.SUDO_UID || '1000', 10),
    });
    child.unref();

    res.json({ success: true, message: 'Kiosk exit triggered.' });
});

// File Upload Route
app.post('/upload', upload.single('presentation'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // Purge old presentation if it exists
    state.purge(fs);

    state.start({ path: req.file.path, url: `/uploads/${req.file.filename}` });

    // Notify receiver and any already connected remotes
    io.emit('presentation-start', { fileUrl: state.activePresentationUrl, slide: state.currentSlide });

    res.json({ success: true, fileUrl: state.activePresentationUrl });
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register-receiver', () => {
        state.receiverSocketId = socket.id;
        console.log('Receiver registered:', socket.id);
        socket.broadcast.emit('receiver-ready');
        if (state.activePresentationUrl) {
            socket.emit('presentation-start', { fileUrl: state.activePresentationUrl, slide: state.currentSlide });
        }
    });

    socket.on('register-remote', () => {
        state.remoteSocketId = socket.id;
        console.log('Remote registered:', socket.id);
        if (state.activePresentationUrl) {
            socket.emit('presentation-start', { fileUrl: state.activePresentationUrl, slide: state.currentSlide });
        }
    });

    // Presentation Control Events
    socket.on('slide-next', () => {
        state.next();
        if (state.receiverSocketId) io.to(state.receiverSocketId).emit('slide-next');
    });

    socket.on('slide-prev', () => {
        state.prev();
        if (state.receiverSocketId) io.to(state.receiverSocketId).emit('slide-prev');
    });

    socket.on('presentation-stop', () => {
        if (state.receiverSocketId) io.to(state.receiverSocketId).emit('presentation-stop');
        state.purge(fs);
    });

    // Screen Share Events
    socket.on('offer', (data) => {
        console.log('Offer received from', socket.id);
        if (state.receiverSocketId) {
            io.to(state.receiverSocketId).emit('offer', { sdp: data.sdp, senderId: socket.id });
        }
    });

    socket.on('answer', (data) => {
        console.log('Answer sent to', data.senderId);
        io.to(data.senderId).emit('answer', { sdp: data.sdp });
    });

    socket.on('ice-candidate', (data) => {
        if (data.target === 'receiver' && state.receiverSocketId) {
            io.to(state.receiverSocketId).emit('ice-candidate', { candidate: data.candidate, senderId: socket.id });
        } else if (data.targetId) {
            io.to(data.targetId).emit('ice-candidate', { candidate: data.candidate });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.id === state.receiverSocketId) {
            state.receiverSocketId = null;
            console.log('Receiver disconnected');
        }
        if (socket.id === state.remoteSocketId) {
            state.remoteSocketId = null;
            console.log('Remote disconnected');
            // We intentionally do NOT purge the presentation here.
            // This protects against accidental refreshes on the mobile device.
            // The file will be cleaned up on the next upload or explicit stop.
        }
    });
});

// Multer / upload error handler — never leak stack traces
app.use((err, req, res, next) => {
    if (err) {
        const status = err instanceof multer.MulterError || err.message ? 400 : 500;
        const message = err.message || 'Upload failed';
        return res.status(status).json({ success: false, error: message });
    }
    next();
});

function __testReset() {
    state.reset();
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
    try {
        if (fs.existsSync(uploadDir)) {
            for (const file of fs.readdirSync(uploadDir)) {
                try {
                    fs.unlinkSync(path.join(uploadDir, file));
                } catch {
                    // swallow
                }
            }
        }
    } catch {
        // swallow
    }
}

export { app, httpServer, io, presentationStateSingleton, __testReset };

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
    httpServer.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}
