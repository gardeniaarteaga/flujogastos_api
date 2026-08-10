const { Client } = require('pg');
(async () => {
  const client = new Client({
    host: 'localhost', port: 5432, user: 'postgres', password: 'ragu77', database: 'control_gastos',
  });
  await client.connect();

  const det = await client.query(`
    select d.id, d.id_transaccion, t.id_usuario as owner_tx, d.id_usuario as det_owner, d.id_participante, d.id_usuario_relacionado, d.id_tipo_transaccion,
           d.monto, d.monto_pagado, d.interes_pendiente, d.numero_cuota, d.total_cuotas,
           d.fecha_pago, d.fecha_programada, d.id_estado
    from detalle_transacciones d
    join transacciones t on t.id_transaccion = d.id_transaccion
    where t.id_categoria = 1
      and (d.id_usuario_relacionado = 2 or (t.id_usuario = 2))
    order by d.id_transaccion, d.id
  `);
  console.log('DETALLES relacionados a usuario 2 en Alimentacion:', det.rows.length);
  console.table(det.rows);

  const estados = await client.query(`select id_estado, nombre_estado, flag, estado from estados_transaccion`);
  console.log('ESTADOS:', estados.rows);

  await client.end();
})().catch(e => { console.error(e); process.exit(1); });
