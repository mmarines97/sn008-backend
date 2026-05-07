const express = require('express');
const pool = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parts ORDER BY pn ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  const { pn, description, location, stock, min_stock, unit, notes } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO parts (pn, description, location, stock, min_stock, unit, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [pn, description, location, stock, min_stock, unit, notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  const { pn, description, location, stock, min_stock, unit, notes } = req.body;
  try {
    const result = await pool.query(
      'UPDATE parts SET pn=$1, description=$2, location=$3, stock=$4, min_stock=$5, unit=$6, notes=$7, updated_at=NOW() WHERE id=$8 RETURNING *',
      [pn, description, location, stock, min_stock, unit, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM parts WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


