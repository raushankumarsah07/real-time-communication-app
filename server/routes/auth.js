const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ _id: u._id, name: u.name, email: u.email });
const str = (v) => (typeof v === 'string' ? v : ''); // rejects objects like {$ne: ""} (NoSQL injection)

router.post('/register', async (req, res) => {
  const name = str(req.body.name).trim();
  const email = str(req.body.email).trim().toLowerCase();
  const password = str(req.body.password);

  if (!name) return res.status(400).json({ message: 'Enter your name.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });

  if (await User.findOne({ email })) return res.status(409).json({ message: 'An account with this email already exists.' });

  const user = await User.create({ name: name.slice(0, 50), email, password: await bcrypt.hash(password, 12) });
  res.status(201).json({ token: sign(user._id), user: pub(user) });
});

router.post('/login', async (req, res) => {
  const email = str(req.body.email).trim().toLowerCase();
  const password = str(req.body.password);
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: 'Incorrect email or password.' });
  res.json({ token: sign(user._id), user: pub(user) });
});

router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ message: 'Account not found.' });
  res.json(pub(user));
});

module.exports = router;
