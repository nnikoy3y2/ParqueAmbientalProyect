// crear-usuario.js — script para crear/actualizar un usuario con contraseña hasheada
// Uso: node crear-usuario.js <usuario> <contraseña> <esAdmin: true|false> [empleado_id]
// Ejemplo: node crear-usuario.js admin MiClaveSegura123 true 1
// El empleado_id es opcional: vincula ese login con la ficha de ese empleado (ver SELECT id, nombre, apellido FROM empleados;)

const bcrypt = require('bcrypt');
const db = require('./db');

async function main() {
  const [, , usuario, contrasena, esAdminArg, empleadoIdArg] = process.argv;

  if (!usuario || !contrasena) {
    console.log('Uso: node crear-usuario.js <usuario> <contraseña> <esAdmin: true|false> [empleado_id]');
    process.exit(1);
  }

  const esAdmin = esAdminArg === 'true';
  const empleadoId = empleadoIdArg ? parseInt(empleadoIdArg, 10) : null;
  const hash = await bcrypt.hash(contrasena, 10);

  await db.query(
    `INSERT INTO usuarios (usuario, contrasena, es_admin, empleado_id)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE contrasena = VALUES(contrasena), es_admin = VALUES(es_admin), empleado_id = VALUES(empleado_id)`,
    [usuario, hash, esAdmin, empleadoId]
  );

  console.log(`Usuario "${usuario}" creado/actualizado correctamente.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
