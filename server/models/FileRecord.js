const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true }, // random name of the encrypted file on disk
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FileRecord', fileSchema);
