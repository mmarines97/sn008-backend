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



// Excel export
const ExcelJS = require('exceljs');
router.get('/export/excel', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parts ORDER BY location');
    const parts = result.rows;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Margham · SN008';
    const ws = wb.addWorksheet('Stock', { views: [{ freezeRows: 1 }] });

    const boxes = {};
    parts.forEach(p => {
      const box = (p.location || '').split('-')[0] || '?';
      if (!boxes[box]) boxes[box] = [];
      boxes[box].push(p);
    });

    const BOX_COLORS = {
      A:'EAF3FC', B:'E8F5E9', C:'FFF8E7', D:'FCE4EC',
      E:'F3E5F5', F:'E0F2F1', G:'FBE9E7', H:'E8EAF6',
      I:'F9FBE7', J:'E0F7FA', K:'FFF3E0', L:'F1F8E9', M:'FCE4EC',
    };

    ws.columns = [
      { key:'loc',  width: 14 },
      { key:'pn',   width: 30 },
      { key:'desc', width: 70 },
      { key:'qty',  width: 8  },
      { key:'alt',  width: 28 },
    ];

    Object.keys(boxes).sort().forEach(box => {
      const bgColor = BOX_COLORS[box] || 'F5F4DF';
      const boxParts = boxes[box].sort((a,b) =>
        (a.location||'').localeCompare(b.location||'', undefined, {numeric:true})
      );

      // Box header
      const headerRow = ws.addRow([`BOX ${box} — ${boxParts.length} parts`, '', '', '', '']);
      ws.mergeCells(`A${headerRow.number}:E${headerRow.number}`);
      headerRow.height = 22;
      headerRow.getCell(1).style = {
        fill: { type:'pattern', pattern:'solid', fgColor:{argb:'FF0E1620'} },
        font: { bold:true, color:{argb:'FFFFFFFF'}, size:12, name:'Arial' },
        alignment: { vertical:'middle', horizontal:'left', indent:1 },
      };

      // Column headers
      const colRow = ws.addRow(['LOCATION', 'PART NUMBER', 'DESCRIPTION', 'QTY', 'ALT PN']);
      colRow.height = 16;
      colRow.eachCell(cell => {
        cell.style = {
          fill: { type:'pattern', pattern:'solid', fgColor:{argb:'FF'+bgColor} },
          font: { bold:true, color:{argb:'FF007AE5'}, size:9, name:'Arial' },
          alignment: { vertical:'middle', horizontal:'center' },
          border: { bottom:{ style:'thin', color:{argb:'FFD8D7C0'} } },
        };
      });

      // Parts
      boxParts.forEach((p, i) => {
        const row = ws.addRow([
          p.location || '',
          p.pn,
          p.description || '',
          p.stock,
          p.alt_pn || '',
        ]);
        row.height = 15;
        const fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF'+(i%2===0?bgColor:'FFFFFF')} };
        row.getCell(1).style = { fill, font:{size:10,name:'Arial'}, alignment:{vertical:'middle',horizontal:'center'} };
        row.getCell(2).style = { fill, font:{bold:true,size:10,name:'Arial',color:{argb:'FF007AE5'}}, alignment:{vertical:'middle'} };
        row.getCell(3).style = { fill, font:{size:10,name:'Arial',color:{argb:'FF3A3A3C'}}, alignment:{vertical:'middle',wrapText:true} };
        row.getCell(4).style = { fill, font:{bold:true,size:10,name:'Arial',color:{argb:'FF0E1620'}}, alignment:{vertical:'middle',horizontal:'center'} };
        row.getCell(5).style = { fill, font:{size:9,name:'Arial',color:{argb:'FF8E8E93'}}, alignment:{vertical:'middle'} };
        row.eachCell(cell => {
          cell.border = { bottom:{ style:'hair', color:{argb:'FFD8D7C0'} } };
        });
      });

      ws.addRow([]);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Margham_Stock_SN008.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
