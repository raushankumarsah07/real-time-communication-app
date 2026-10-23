const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const auth = require('../middleware/auth');
const Room = require('../models/Room');
const Message = require('../models/Message');
const FileRecord = require('../models/FileRecord');
const { encryptBuffer, decryptText, generateRoomCode } = require('../utils/crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const MAX_FILE_MB = 25;
const BLOCKED_EXT = ['.exe', '.bat', '.cmd', '.msi', '.scr', '.com', '.vbs', '.ps1', '.jar'];

// Files are kept in memory only long enough to encrypt them, then written encrypted
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_MB * 1024 * 1024 } });

// Loads the room and makes sure the logged-in user has joined it
async function loadRoom(req, res, next) {
  const room = await Room.findOne({ code: String(req.params.code).toLowerCase() });
  if (!room) return res.status(404).json({ message: 'Meeting not found. Check the code.' });
  if (!room.participants.some((p) => p.equals(req.user.id)))
    return res.status(403).json({ message: 'Join the meeting first.' });
  req.room = room;
  next();
}

const fileDto = (f, code) => ({
  _id: f._id,
  name: f.originalName,
  size: f.size,
  mimeType: f.mimeType,
  uploader: f.uploader,
  createdAt: f.createdAt,
  room: code,
});

// Create a meeting
router.post('/', auth, async (req, res) => {
  const name = (typeof req.body.name === 'string' ? req.body.name : '').trim().slice(0, 80) || 'Untitled meeting';
  const room = await Room.create({
    code: generateRoomCode(),
    name,
    host: req.user.id,
    participants: [req.user.id],
  });
  res.status(201).json({ code: room.code, name: room.name });
});

// My recent meetings
router.get('/', auth, async (req, res) => {
  const rooms = await Room.find({ participants: req.user.id }).sort({ updatedAt: -1 }).limit(20).lean();
  res.json(rooms.map((r) => ({ code: r.code, name: r.name, isHost: String(r.host) === req.user.id, createdAt: r.createdAt })));
});

// Join a meeting with its code
router.post('/:code/join', auth, async (req, res) => {
  const room = await Room.findOneAndUpdate(
    { code: String(req.params.code).toLowerCase() },
    { $addToSet: { participants: req.user.id } },
    { new: true }
  );
  if (!room) return res.status(404).json({ message: 'Meeting not found. Check the code.' });
  res.json({ code: room.code, name: room.name, isHost: String(room.host) === req.user.id });
});

// Chat history (decrypted for participants only)
router.get('/:code/messages', auth, loadRoom, async (req, res) => {
  const msgs = await Message.find({ room: req.room._id })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('sender', 'name')
    .lean();
  res.json(
    msgs.reverse().map((m) => ({ _id: m._id, user: m.sender, text: decryptText(m.content), createdAt: m.createdAt }))
  );
});

// Shared files list
router.get('/:code/files', auth, loadRoom, async (req, res) => {
  const files = await FileRecord.find({ room: req.room._id }).sort({ createdAt: -1 }).populate('uploader', 'name').lean();
  res.json(files.map((f) => fileDto(f, req.room.code)));
});

// Upload a file: encrypted with AES-256-GCM before touching the disk
router.post('/:code/files', auth, loadRoom, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a file to share.' });

  const originalName = path.basename(Buffer.from(req.file.originalname, 'latin1').toString('utf8')).slice(0, 120);
  if (BLOCKED_EXT.includes(path.extname(originalName).toLowerCase()))
    return res.status(400).json({ message: 'This file type is not allowed for security reasons.' });

  const storedName = crypto.randomBytes(16).toString('hex') + '.enc';
  await fs.promises.writeFile(path.join(UPLOAD_DIR, storedName), encryptBuffer(req.file.buffer));

  const rec = await FileRecord.create({
    room: req.room._id,
    uploader: req.user.id,
    originalName,
    storedName,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
  await rec.populate('uploader', 'name');

  const dto = fileDto(rec.toObject(), req.room.code);
  req.app.get('io').to(req.room.code).emit('file-shared', dto); // tell everyone in the call
  res.status(201).json(dto);
});

router.UPLOAD_DIR = UPLOAD_DIR;
router.MAX_FILE_MB = MAX_FILE_MB;
module.exports = router;
