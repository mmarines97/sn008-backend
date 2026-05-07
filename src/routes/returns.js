const express = require('express');
const pool = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, 
        p.pn, p.description,
        u.name as requester_name,
        m.aircraft_reg, m.work_order
      FROM return_requests r
      LEFT JOIN parts p ON r.part_id = p.id
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN movements m ON r.movement_id = m.id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, async (req, res) => {
  const { movement_id, part_id, quantity, reason } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO return_requests (movement_id, part_id, user_id, quantity, reason) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [movement_id, part_id, req.user.id, quantity, reason]
    );
    res.json(result.rows[0]);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/approve', auth, adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rr = await client.query('SELECT * FROM return_requests WHERE id=$1', [req.params.id]);
    if (!rr.rows[0]) throw new Error('Request not found');
    const request = rr.rows[0];
    if (request.status !== 'pending') throw new Error('Already reviewed');
    await client.query(
      'UPDATE parts SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
      [request.quantity, request.part_id]
    );
    await client.query(
      'INSERT INTO movements (part_id, user_id, type, quantity, notes) VALUES ($1,$2,$3,$4,$5)',
      [request.part_id, req.user.id, 'return', request.quantity, 'Return approved']
    );
    await client.query(
      'UPDATE return_requests SET status=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3',
      ['approved', req.user.id, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.put('/:id/reject', auth, adminOnly, async (req, res) => {
  try {
    await pool.query(
      'UPDATE return_requests SET status=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3',
      ['rejected', req.user.id, req.params.id]
    );
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

