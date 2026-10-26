const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// In-memory storage for profiles (Replace with Database for production)
const profiles = {};
let profileCounter = 1;

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and DOCX files are allowed'));
        }
    }
});

// --- API Routes ---

// GET /api/profiles - List all profiles
app.get('/api/profiles', (req, res) => {
    const profileList = Object.values(profiles).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        resumeName: p.resumeName,
        updatedAt: p.updatedAt
    }));
    res.json(profileList);
});

// POST /api/profiles - Create a profile
app.post('/api/profiles', upload.single('resume'), (req, res) => {
    try {
        const { name, category } = req.body;
        if (!name || !category || !req.file) {
            return res.status(400).json({ error: 'Name, category, and resume are required.' });
        }

        const id = String(profileCounter++);
        const newProfile = {
            id,
            name,
            category,
            resumePath: req.file.path,
            resumeName: req.file.originalname,
            updatedAt: new Date().toISOString()
        };

        profiles[id] = newProfile;
        res.status(201).json(newProfile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/profiles/:id - Get specific profile
app.get('/api/profiles/:id', (req, res) => {
    const profile = profiles[req.params.id];
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
});

// PATCH /api/profiles/:id - Update profile
app.patch('/api/profiles/:id', upload.single('resume'), (req, res) => {
    const profile = profiles[req.params.id];
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { name, category } = req.body;
    if (name) profile.name = name;
    if (category) profile.category = category;
    if (req.file) {
        // Delete old resume if exists
        if (profile.resumePath && fs.existsSync(profile.resumePath)) {
            fs.unlinkSync(profile.resumePath);
        }
        profile.resumePath = req.file.path;
        profile.resumeName = req.file.originalname;
    }

    profile.updatedAt = new Date().toISOString();
    res.json(profile);
});

// DELETE /api/profiles/:id - Delete profile
app.delete('/api/profiles/:id', (req, res) => {
    const profile = profiles[req.params.id];
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    if (profile.resumePath && fs.existsSync(profile.resumePath)) {
        fs.unlinkSync(profile.resumePath);
    }
    delete profiles[req.params.id];
    res.status(204).send();
});

// POST /api/search - Trigger Playwright search
app.post('/api/search', (req, res) => {
    const { profileId, settings } = req.body;
    const profile = profiles[profileId];
    if (!profile) return res.status(400).json({ error: 'Invalid profile ID' });

    console.log(`Triggering search for candidate: ${profile.name} with settings:`, settings);

    // In a real scenario, this would use a worker queue (like BullMQ)
    // to run: npx playwright test tests/linkedin-auto.spec.js
    // and pass CANDIDATE=profileId

    res.json({
        message: 'Search started successfully',
        searchId: `search_${Date.now()}`,
        status: 'processing'
    });
});

app.listen(PORT, () => {
    console.log(`Backend API running on http://localhost:${PORT}`);
});
