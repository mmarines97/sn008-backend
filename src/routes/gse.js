const express = require('express');
const pool = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

// GET all GSE
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM gse ORDER BY gse_number ASC');
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET single GSE with discrepancies
router.get('/:id', auth, async (req, res) => {
  try {
    const gse = await pool.query('SELECT * FROM gse WHERE id=$1', [req.params.id]);
    const disc = await pool.query(
      'SELECT d.*, u.name as reported_by_name, r.name as resolved_by_name FROM gse_discrepancies d LEFT JOIN users u ON d.reported_by=u.id LEFT JOIN users r ON d.resolved_by=r.id WHERE d.gse_id=$1 ORDER BY d.created_at DESC',
      [req.params.id]
    );
    res.json({ ...gse.rows[0], discrepancies: disc.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// CREATE GSE
router.post('/', auth, adminOnly, async (req, res) => {
  const { gse_number, description, serial_number, manufacturer, model, location, last_inspection, next_inspection, notes } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO gse (gse_number,description,serial_number,manufacturer,model,location,last_inspection,next_inspection,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [gse_number,description,serial_number,manufacturer,model,location||'SN008 Hangar',last_inspection||null,next_inspection||null,notes]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// UPDATE GSE
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { gse_number, description, serial_number, manufacturer, model, location, status, last_inspection, next_inspection, notes } = req.body;
  try {
    const result = await pool.query(
      'UPDATE gse SET gse_number=$1,description=$2,serial_number=$3,manufacturer=$4,model=$5,location=$6,status=$7,last_inspection=$8,next_inspection=$9,notes=$10,updated_at=NOW() WHERE id=$11 RETURNING *',
      [gse_number,description,serial_number,manufacturer,model,location,status,last_inspection||null,next_inspection||null,notes,req.params.id]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE GSE
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM gse_discrepancies WHERE gse_id=$1', [req.params.id]);
    await pool.query('DELETE FROM gse WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET all discrepancies
router.get('/:id/discrepancies', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT d.*, u.name as reported_by_name, r.name as resolved_by_name FROM gse_discrepancies d LEFT JOIN users u ON d.reported_by=u.id LEFT JOIN users r ON d.resolved_by=r.id WHERE d.gse_id=$1 ORDER BY d.created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// OPEN discrepancy
router.post('/:id/discrepancies', auth, async (req, res) => {
  const { type, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO gse_discrepancies (gse_id,reported_by,type,description) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, req.user.id, type, description]
    );
    // Update GSE status
    const statusMap = { broken: 'unserviceable', to_be_repaired: 'to_be_repaired', to_be_replaced: 'to_be_replaced' };
    if (statusMap[type]) {
      await pool.query('UPDATE gse SET status=$1,updated_at=NOW() WHERE id=$2', [statusMap[type], req.params.id]);
    }
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// CLOSE discrepancy
router.put('/:gse_id/discrepancies/:disc_id/close', auth, adminOnly, async (req, res) => {
  const { resolution_notes } = req.body;
  try {
    await pool.query(
      'UPDATE gse_discrepancies SET status=$1,resolved_by=$2,resolved_at=NOW(),resolution_notes=$3 WHERE id=$4',
      ['closed', req.user.id, resolution_notes, req.params.disc_id]
    );
    // Check if any open discrepancies remain
    const open = await pool.query('SELECT id FROM gse_discrepancies WHERE gse_id=$1 AND status=$2', [req.params.gse_id, 'open']);
    if (open.rows.length === 0) {
      await pool.query('UPDATE gse SET status=$1,updated_at=NOW() WHERE id=$2', ['serviceable', req.params.gse_id]);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;


