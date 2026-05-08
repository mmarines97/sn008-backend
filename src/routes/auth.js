const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const pool = require('../db');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { password, totp_token } = req.body;
  const email = req.body.email?.toLowerCase().trim();
  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1 AND active = true', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.totp_enabled) {
      if (!totp_token) return res.status(206).json({ require_totp: true });
      const verified = speakeasy.totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token: totp_token,
        window: 1
      });
      if (!verified) return res.status(401).json({ error: 'Invalid authenticator code' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/totp/setup', auth, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({ name: 'Margham Stock (' + req.user.email + ')' });
    await pool.query('UPDATE users SET totp_secret=$1, totp_enabled=false WHERE id=$2', [secret.base32, req.user.id]);
    const qrUrl = await QRCode.toDataURL(secret.otpauth_url);
    res.json({ qr: qrUrl, secret: secret.base32 });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/totp/verify', auth, async (req, res) => {
  const { token } = req.body;
  try {
    const result = await pool.query('SELECT totp_secret FROM users WHERE id=$1', [req.user.id]);
    const user = result.rows[0];
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token,
      window: 1
    });
    if (!verified) return res.status(400).json({ error: 'Invalid code' });
    await pool.query('UPDATE users SET totp_enabled=true WHERE id=$1', [req.user.id]);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/totp/disable', auth, async (req, res) => {
  try {
    await pool.query('UPDATE users SET totp_secret=null, totp_enabled=false WHERE id=$1', [req.user.id]);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
