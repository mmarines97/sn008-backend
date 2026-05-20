const express = require('express');
const pool = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM materials ORDER BY ref ASC');
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM materials WHERE id=$1', [req.params.id]);
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, async (req, res) => {
  const { ref, description, manufacturer, part_number, location, stock, min_stock, unit, expiry_date, msds_ref, notes } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO materials (ref,description,manufacturer,part_number,location,stock,min_stock,unit,expiry_date,msds_ref,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
      [ref,description,manufacturer,part_number,location,stock||0,min_stock||0,unit||'units',expiry_date||null,msds_ref,notes]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  const { ref, description, manufacturer, part_number, location, stock, min_stock, unit, expiry_date, msds_ref, notes } = req.body;
  try {
    const result = await pool.query(
      'UPDATE materials SET ref=$1,description=$2,manufacturer=$3,part_number=$4,location=$5,stock=$6,min_stock=$7,unit=$8,expiry_date=$9,msds_ref=$10,notes=$11,updated_at=NOW() WHERE id=$12 RETURNING *',
      [ref,description,manufacturer,part_number,location,stock||0,min_stock||0,unit||'units',expiry_date||null,msds_ref,notes,req.params.id]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM materials WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

