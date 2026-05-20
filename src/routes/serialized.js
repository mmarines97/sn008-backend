const express = require('express');
const pool = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM serialized_parts ORDER BY pn ASC');
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM serialized_parts WHERE id=$1', [req.params.id]);
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, async (req, res) => {
  const { pn, description, serial_number, status, aircraft_reg, logbook_ref, jira_ticket, position, installed_at, notes } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO serialized_parts (pn,description,serial_number,status,aircraft_reg,logbook_ref,jira_ticket,position,installed_at,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [pn,description,serial_number,status||'available',aircraft_reg,logbook_ref,jira_ticket,position,installed_at||null,notes]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  const { pn, description, serial_number, status, aircraft_reg, logbook_ref, jira_ticket, position, installed_at, notes } = req.body;
  try {
    const result = await pool.query(
      'UPDATE serialized_parts SET pn=$1,description=$2,serial_number=$3,status=$4,aircraft_reg=$5,logbook_ref=$6,jira_ticket=$7,position=$8,installed_at=$9,notes=$10,updated_at=NOW() WHERE id=$11 RETURNING *',
      [pn,description,serial_number,status,aircraft_reg,logbook_ref,jira_ticket,position,installed_at||null,notes,req.params.id]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM serialized_parts WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
