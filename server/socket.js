const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Room = require('./models/Room');
const Message = require('./models/Message');
const { encryptText } = require('./utils/crypto');

const MAX_PARTICIPANTS = 6; // mesh WebRTC: every person connects to every other person
const MAX_BOARD_OPS = 30000;
const COLOR = /^#[0-9a-f]{6}$/i;
const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null);

// Validate whiteboard operations so a client can't send junk to other users
function cleanOp(op) {
  if (!op || typeof op !== 'object' || !COLOR.test(op.c)) return null;
  if (op.t === 'seg') {
    const o = { t: 'seg', c: op.c, w: num(op.w, 1, 80), x1: num(op.x1, 0, 1), y1: num(op.y1, 0, 1), x2: num(op.x2, 0, 1), y2: num(op.y2, 0, 1) };
    return Object.values(o).includes(null) ? null : o;
  }
  if (op.t === 'text' && typeof op.text === 'string' && op.text.trim()) {
    const o = { t: 'text', c: op.c, s: num(op.s, 10, 120), x: num(op.x, 0, 1), y: num(op.y, 0, 1), text: op.text.slice(0, 200) };
    return [o.s, o.x, o.y].includes(null) ? null : o;
  }
  return null;
}

module.exports = function setupSocket(io) {
  const boards = new Map(); // room code -> whiteboard ops (in memory)

  // Every socket must present a valid login token
  io.use(async (socket, next) => {
    try {
      const { id } = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      const user = await User.findById(id);
      if (!user) throw new Error('no user');
      socket.data.user = { _id: String(user._id), name: user.name };
      next();
    } catch {
      next(new Error('Authentication failed. Please log in again.'));
    }
  });

  io.on('connection', (socket) => {
    const inRoom = () => socket.data.code;

    socket.on('join-room', async ({ code } = {}, ack = () => {}) => {
      try {
        const room = await Room.findOne({ code: String(code).toLowerCase() });
        if (!room || !room.participants.some((p) => String(p) === socket.data.user._id))
          return ack({ error: 'Meeting not found or you have not joined it.' });

        const existing = await io.in(room.code).fetchSockets();
        if (existing.length >= MAX_PARTICIPANTS)
          return ack({ error: `This meeting is full (maximum ${MAX_PARTICIPANTS} people).` });

        socket.join(room.code);
        socket.data.code = room.code;
        socket.data.roomId = String(room._id);

        socket.to(room.code).emit('peer-joined', { socketId: socket.id, user: socket.data.user });
        ack({
          peers: existing.map((s) => ({ socketId: s.id, user: s.data.user })),
          board: boards.get(room.code) || [],
        });
      } catch (e) {
        console.error(e);
        ack({ error: 'Could not join the meeting.' });
      }
    });

    // WebRTC signalling relay (offer / answer / ICE). Media itself flows peer-to-peer.
    socket.on('signal', ({ to, data } = {}) => {
      const target = io.sockets.sockets.get(to);
      if (!target || !inRoom() || target.data.code !== inRoom()) return; // same room only
      target.emit('signal', { from: socket.id, data });
    });

    socket.on('media-state', (s = {}) => {
      if (!inRoom()) return;
      socket.to(inRoom()).emit('media-state', {
        socketId: socket.id,
        state: { mic: !!s.mic, cam: !!s.cam, sharing: !!s.sharing },
      });
    });

    socket.on('chat-message', async ({ text } = {}) => {
      if (!inRoom() || typeof text !== 'string' || !text.trim()) return;
      const clean = text.trim().slice(0, 2000);
      const msg = await Message.create({
        room: socket.data.roomId,
        sender: socket.data.user._id,
        content: encryptText(clean), // stored encrypted
      });
      io.to(inRoom()).emit('chat-message', { _id: msg._id, user: socket.data.user, text: clean, createdAt: msg.createdAt });
    });

    // Whiteboard
    socket.on('wb-op', (raw) => {
      if (!inRoom()) return;
      const op = cleanOp(raw);
      if (!op) return;
      const ops = boards.get(inRoom()) || [];
      if (ops.length < MAX_BOARD_OPS) ops.push(op);
      boards.set(inRoom(), ops);
      socket.to(inRoom()).emit('wb-op', op);
    });

    socket.on('wb-clear', () => {
      if (!inRoom()) return;
      boards.set(inRoom(), []);
      socket.to(inRoom()).emit('wb-clear');
    });

    socket.on('disconnect', async () => {
      const code = inRoom();
      if (!code) return;
      socket.to(code).emit('peer-left', { socketId: socket.id });
      if ((await io.in(code).fetchSockets()).length === 0) boards.delete(code); // free memory
    });
  });
};
