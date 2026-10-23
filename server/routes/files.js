const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const FileRecord = require('../models/FileRecord');
const Room = require('../models/Room');
const { decryptBuffer } = require('../utils/crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Download (decrypts on the fly; only meeting participants are allowed)
router.get('/:id/download', auth, async (req, res) => {
  const rec = await FileRecord.findById(req.params.id);
  if (!rec) return res.status(404).json({ message: 'File not found.' });

  const room = await Room.findById(rec.room);
  if (!room || !room.participants.some((p) => p.equals(req.user.id)))
    return res.status(403).json({ message: "You don't have access to this file." });

  const encrypted = await fs.promises.readFile(path.join(UPLOAD_DIR, rec.storedName));
  const plain = decryptBuffer(encrypted);

  res.set({ 'Content-Type': 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  res.attachment(rec.originalName);
  res.send(plain);
});

module.exports = router;
