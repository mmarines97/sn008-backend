const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:qOuzTyyImMYShFRrtjhxxWMIqcpmVIbb@turntable.proxy.rlwy.net:32259/railway',
  ssl: { rejectUnauthorized: false }
});

const parts = [
  {pn:'NAS6303U9H',desc:'Shaft bottom bolts',stock:48,min:9},
  {pn:'NAS1352N04H16',desc:'Smaller screws 4 per VPA',stock:25,min:5},
  {pn:'NAS6404U9H',desc:'EPU to crown bolt',stock:50,min:10},
  {pn:'MS14181H03006L',desc:'Wing trumpet',stock:50,min:10},
  {pn:'NAS1153E4',desc:'Wing/nacelle fastener',stock:300,min:60},
  {pn:'NAS1802-08-14',desc:'Screw hex head cruciform',stock:30,min:6},
  {pn:'NAS6403U31D',desc:'Bolt for hinge to swing on',stock:4,min:2},
  {pn:'NAS77C4-022',desc:'Bushing flanged press fit',stock:4,min:2},
  {pn:'MS21299C3K',desc:'Shaft bottom washers',stock:48,min:9},
  {pn:'NAS620C4',desc:'Smaller washers 4 per VPA',stock:25,min:5},
  {pn:'NAS1352N08H14',desc:'Larger screws 2 per VPA',stock:14,min:3},
  {pn:'NAS620C8',desc:'Larger washers 2 per VPA',stock:14,min:3},
  {pn:'NAS1802-3D10',desc:'Shaft top screws',stock:20,min:4},
  {pn:'NAS620C10L',desc:'Shaft top washers',stock:20,min:4},
  {pn:'MS9574-20',desc:'Hub to rotor bolts',stock:50,min:10},
  {pn:'NAS1352N06H14',desc:'EPU to mast bolt',stock:25,min:5},
  {pn:'NAS620C6',desc:'EPU to mast washer',stock:25,min:5},
  {pn:'NAS1802-3D8',desc:'Mast top screws',stock:20,min:4},
  {pn:'NAS620C10',desc:'Mast top washers',stock:20,min:4},
  {pn:'MS21042L4',desc:'Prop nut',stock:50,min:10},
  {pn:'NAS1352N08H10',desc:'Crown to EPU bolt',stock:25,min:5},
  {pn:'NAS1802-08-10',desc:'Screw hex head',stock:30,min:6},
  {pn:'NAS6303U14H',desc:'Hinge bolt',stock:10,min:2},
  {pn:'MS21042L3',desc:'Hinge nut',stock:10,min:2},
  {pn:'NAS1352N06H10',desc:'Nacelle to wing bolt',stock:25,min:5},
  {pn:'NAS620C6L',desc:'Nacelle to wing washer',stock:25,min:5},
  {pn:'NAS1802-3D12',desc:'Wing skin screws',stock:20,min:4},
  {pn:'NAS620C10K',desc:'Wing skin washers',stock:20,min:4},
  {pn:'MS21042L6',desc:'Main landing gear nut',stock:10,min:2},
  {pn:'NAS6304U9H',desc:'Main landing gear bolt',stock:10,min:2}
];

async function seed() {
  console.log('Conectando...');
  try {
    const test = await pool.query('SELECT NOW()');
    console.log('Conectado:', test.rows[0].now);
  } catch(e) {
    console.log('Error de conexion:', e.message);
    await pool.end();
    return;
  }
  console.log('Insertando ' + parts.length + ' partes...');
  for (const p of parts) {
    try {
      await pool.query(
        'INSERT INTO parts (pn, description, location, stock, min_stock, unit) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (pn) DO NOTHING',
        [p.pn, p.desc, '', p.stock, p.min, 'units']
      );
      console.log('OK:', p.pn);
    } catch(e) {
      console.log('Error:', p.pn, e.message);
    }
  }
  console.log('Listo!');
  await pool.end();
}

seed();

