const express = require('express');
const pool = require('../db');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, p.pn, p.description, u.name as technician
      FROM movements m
      LEFT JOIN parts p ON m.part_id = p.id
      LEFT JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at DESC
      LIMIT 500
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  const { part_id, type, quantity, aircraft_reg, work_order, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const part = await client.query('SELECT stock FROM parts WHERE id = $1', [part_id]);
    if (!part.rows[0]) throw new Error('Part not found');
    let newStock = part.rows[0].stock;
    if (type === 'issue') newStock -= quantity;
    else if (type === 'receipt') newStock += quantity;
    else newStock = quantity;
    if (newStock < 0) throw new Error('Insufficient stock');
    await client.query('UPDATE parts SET stock = $1, updated_at = NOW() WHERE id = $2', [newStock, part_id]);
    const result = await client.query(
      'INSERT INTO movements (part_id, user_id, type, quantity, aircraft_reg, work_order, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [part_id, req.user.id, type, quantity, aircraft_reg, work_order, notes]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

