const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth, isAdmin } = require('../middleware/auth');

// GET all damage reports (admin) or own reports (technician)
router.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? `SELECT tdr.*, t.description as tool_name, t.tool_number, u.name as reporter_name, r.name as resolver_name
         FROM tool_damage_reports tdr
         LEFT JOIN tooling t ON tdr.tool_id = t.id
         LEFT JOIN users u ON tdr.reported_by = u.id
         LEFT JOIN users r ON tdr.resolved_by = r.id
         ORDER BY tdr.created_at DESC`
      : `SELECT tdr.*, t.description as tool_name, t.tool_number, u.name as reporter_name
         FROM tool_damage_reports tdr
         LEFT JOIN tooling t ON tdr.tool_id = t.id
         LEFT JOIN users u ON tdr.reported_by = u.id
         WHERE tdr.reported_by = $1
         ORDER BY tdr.created_at DESC`;
    const result = req.user.role === 'admin'
      ? await pool.query(query)
      : await pool.query(query, [req.user.id]);
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET open reports count (for badge)
router.get('/count', auth, isAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) as count FROM tool_damage_reports WHERE status='open'");
    res.json({ count: parseInt(result.rows[0].count) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST create damage report
router.post('/', auth, async (req, res) => {
  try {
    const { tool_id, damage_type, description, aircraft_reg } = req.body;
    if (!tool_id || !damage_type || !description)
      return res.status(400).json({ error: 'tool_id, damage_type and description are required' });

    // Mark tool as damaged
    await pool.query("UPDATE tooling SET status='DAMAGED' WHERE id=$1", [tool_id]);

    const result = await pool.query(
      `INSERT INTO tool_damage_reports (tool_id, reported_by, damage_type, description, aircraft_reg)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [tool_id, req.user.id, damage_type, description, aircraft_reg || null]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT resolve report (admin only)
router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const validStatuses = ['open','sent_to_calibration','written_off','cleared'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ error: 'Invalid status' });

    // Update tool status based on resolution
    const report = await pool.query('SELECT tool_id FROM tool_damage_reports WHERE id=$1', [req.params.id]);
    if (!report.rows[0]) return res.status(404).json({ error: 'Report not found' });

    const toolStatus = status === 'cleared' ? 'NEW'
      : status === 'sent_to_calibration' ? 'IN CALIBRATION'
      : status === 'written_off' ? 'WRITTEN OFF'
      : 'DAMAGED';

    await pool.query("UPDATE tooling SET status=$1 WHERE id=$2", [toolStatus, report.rows[0].tool_id]);
    const result = await pool.query(
      `UPDATE tool_damage_reports SET status=$1, admin_notes=$2, resolved_by=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [status, admin_notes || null, req.user.id, req.params.id]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
