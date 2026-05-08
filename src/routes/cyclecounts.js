const express = require('express');
const pool = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const router = express.Router();

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0,0,0,0);
  return date.toISOString().slice(0,10);
}

router.get('/current', auth, async (req, res) => {
  try {
    const weekStart = getMonday(new Date());
    let counts = await pool.query(
      'SELECT cc.*, p.pn, p.description, p.location, p.stock as current_stock, u.name as assigned_name FROM cycle_counts cc LEFT JOIN parts p ON cc.part_id = p.id LEFT JOIN users u ON cc.assigned_to = u.id WHERE cc.week_start = $1',
      [weekStart]
    );
    if (counts.rows.length === 0) {
      const parts = await pool.query('SELECT id, stock FROM parts ORDER BY RANDOM() LIMIT 5');
      if (parts.rows.length === 0) return res.json([]);
      const warehouse = await pool.query('SELECT id FROM users WHERE role IN (\'warehouse\',\'admin\') AND active = true LIMIT 1');
      const assignedTo = warehouse.rows[0]?.id || null;
      for (const part of parts.rows) {
        await pool.query(
          'INSERT INTO cycle_counts (week_start, part_id, assigned_to, system_qty) VALUES ($1,$2,$3,$4)',
          [weekStart, part.id, assignedTo, part.stock]
        );
      }
      counts = await pool.query(
        'SELECT cc.*, p.pn, p.description, p.location, p.stock as current_stock, u.name as assigned_name FROM cycle_counts cc LEFT JOIN parts p ON cc.part_id = p.id LEFT JOIN users u ON cc.assigned_to = u.id WHERE cc.week_start = $1',
        [weekStart]
      );
    }
    res.json(counts.rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT cc.*, p.pn, p.description, u.name as assigned_name FROM cycle_counts cc LEFT JOIN parts p ON cc.part_id = p.id LEFT JOIN users u ON cc.assigned_to = u.id ORDER BY cc.week_start DESC, cc.created_at DESC LIMIT 100'
    );
    res.json(result.rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/complete', auth, async (req, res) => {
  const { counted_qty, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cc = await client.query('SELECT * FROM cycle_counts WHERE id=$1', [req.params.id]);
    if (!cc.rows[0]) throw new Error('Count not found');
    const count = cc.rows[0];
    const difference = counted_qty - count.system_qty;
    await client.query(
      'UPDATE cycle_counts SET status=$1, counted_qty=$2, difference=$3, notes=$4, completed_at=NOW() WHERE id=$5',
      ['completed', counted_qty, difference, notes, req.params.id]
    );
    if (difference !== 0) {
      await client.query('UPDATE parts SET stock=$1, updated_at=NOW() WHERE id=$2', [counted_qty, count.part_id]);
      await client.query(
        'INSERT INTO movements (part_id, user_id, type, quantity, notes) VALUES ($1,$2,$3,$4,$5)',
        [count.part_id, req.user.id, 'adjust', Math.abs(difference), 'Cycle count adjustment. Difference: ' + difference]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch(e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.post('/generate', auth, adminOnly, async (req, res) => {
  try {
    const weekStart = getMonday(new Date());
    await pool.query('DELETE FROM cycle_counts WHERE week_start=$1', [weekStart]);
    const parts = await pool.query('SELECT id, stock FROM parts ORDER BY RANDOM() LIMIT 5');
    const warehouse = await pool.query('SELECT id FROM users WHERE role IN (\'warehouse\',\'admin\') AND active=true LIMIT 1');
    const assignedTo = warehouse.rows[0]?.id || null;
    for (const part of parts.rows) {
      await pool.query(
        'INSERT INTO cycle_counts (week_start, part_id, assigned_to, system_qty) VALUES ($1,$2,$3,$4)',
        [weekStart, part.id, assignedTo, part.stock]
      );
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
