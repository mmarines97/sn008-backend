const express = require('express');
const pool = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tooling ORDER BY tool_number ASC');
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tooling WHERE id=$1', [req.params.id]);
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, async (req, res) => {
  const { tool_number, description, serial_number, manufacturer, model, location, last_calibration, next_calibration, calibration_lab, certificate_ref, notes } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tooling (tool_number,description,serial_number,manufacturer,model,location,last_calibration,next_calibration,calibration_lab,certificate_ref,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
      [tool_number,description,serial_number,manufacturer,model,location,last_calibration||null,next_calibration||null,calibration_lab,certificate_ref,notes]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  const { tool_number, description, serial_number, manufacturer, model, location, status, last_calibration, next_calibration, calibration_lab, certificate_ref, notes } = req.body;
  try {
    const result = await pool.query(
      'UPDATE tooling SET tool_number=$1,description=$2,serial_number=$3,manufacturer=$4,model=$5,location=$6,status=$7,last_calibration=$8,next_calibration=$9,calibration_lab=$10,certificate_ref=$11,notes=$12,updated_at=NOW() WHERE id=$13 RETURNING *',
      [tool_number,description,serial_number,manufacturer,model,location,status,last_calibration||null,next_calibration||null,calibration_lab,certificate_ref,notes,req.params.id]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM tooling WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;


