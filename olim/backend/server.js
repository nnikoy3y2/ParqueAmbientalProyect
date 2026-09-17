// server.js — servidor principal
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ─── Alerta automática de temperatura de emergencia ─────────────────────────
// Mismo umbral que usa el ESP32 para prender el ventilador (ver esp32.ino).
// Se guarda en memoria si ya se avisó de la emergencia actual, para no crear
// una notificación nueva en cada reporte de telemetría (cada 2s) mientras dure.
const UMBRAL_TEMP_EMERGENCIA = 50;
let emergenciaNotificada = false;

// ─── Notificaciones — helpers compartidos (Parte 1) ─────────────────────────
// Traduce el nuevo estado (estado + urgente) al color "clásico" (red/yellow/green)
// que sigue usando el campo `nivel`, para no romper el Dashboard Global (Parte 2).
// Único lugar del código donde se hace este mapeo (backend).
function nivelDesdeEstado(estado, urgente) {
  if (estado === 'solucionada') return 'green';
  if (estado === 'en_proceso') return 'yellow';
  return urgente ? 'red' : 'yellow';
}

// Nombres amigables de los sensores generales (para el texto de las alertas
// automáticas por umbral). El id 4 (Temp. de Emergencia) no entra acá, sigue
// con su propio mecanismo especial más abajo.
const NOMBRE_SENSOR_UMBRAL = { 1: 'Luz', 2: 'Temperatura Ambiente', 3: 'Humedad' };

// Revisa el valor de una lectura contra el umbral configurado (si hay) y
// genera una notificación automática de sensor si corresponde, evitando
// duplicar una alerta si ya hay una abierta (Asignada o En proceso) para
// ese mismo sensor.
async function evaluarUmbralSensor(sensorId, valor) {
  try {
    const [[umbral]] = await db.query(
      'SELECT minimo, maximo FROM umbrales_sensores WHERE sensor_id = ?',
      [sensorId]
    );
    if (!umbral || (umbral.minimo === null && umbral.maximo === null)) return;

    const debajo = umbral.minimo !== null && Number(valor) < Number(umbral.minimo);
    const arriba = umbral.maximo !== null && Number(valor) > Number(umbral.maximo);
    if (!debajo && !arriba) return;

    const [[abierta]] = await db.query(
      `SELECT id FROM notificaciones WHERE sensor_id = ? AND estado IN ('asignada','en_proceso') LIMIT 1`,
      [sensorId]
    );
    if (abierta) return; // ya hay una alerta abierta para este sensor, no duplicar

    const [[sensor]] = await db.query(
      `SELECT s.id, s.nombre, s.area_id FROM sensores s WHERE s.id = ?`,
      [sensorId]
    );
    if (!sensor) return;

    const nombre = NOMBRE_SENSOR_UMBRAL[sensorId] || sensor.nombre;
    const texto = debajo
      ? `Notificación de sensor: la ${nombre} está por debajo de lo solicitado (${valor}, mínimo ${umbral.minimo}). Revisá el sensor.`
      : `Notificación de sensor: la ${nombre} está por encima de lo solicitado (${valor}, máximo ${umbral.maximo}). Revisá el sensor.`;

    await db.query(
      `INSERT INTO notificaciones (nivel, estado, urgente, alcance, area_id, sensor_id, texto)
       VALUES ('yellow', 'asignada', 0, 'area', ?, ?, ?)`,
      [sensor.area_id, sensor.id, texto]
    );
  } catch (err) {
    console.error('Error al evaluar el umbral del sensor', sensorId, err);
  }
}

// Crea o actualiza la cuenta de login vinculada a un empleado.
// Usuario y contraseña = número de documento. Si el rol es "Admin", la cuenta queda con permisos de admin.
async function sincronizarUsuarioEmpleado(empleadoId, documento, rol) {
  if (!documento) return; // sin DNI cargado no se puede crear la cuenta
  const hash = await bcrypt.hash(documento, 10);
  const esAdmin = rol === 'Admin';
  const [existing] = await db.query('SELECT id FROM usuarios WHERE empleado_id = ?', [empleadoId]);
  if (existing.length > 0) {
    await db.query(
      'UPDATE usuarios SET usuario = ?, contrasena = ?, es_admin = ? WHERE empleado_id = ?',
      [documento, hash, esAdmin, empleadoId]
    );
  } else {
    await db.query(
      'INSERT INTO usuarios (usuario, contrasena, es_admin, empleado_id) VALUES (?, ?, ?, ?)',
      [documento, hash, esAdmin, empleadoId]
    );
  }
}

// ─── Áreas ───────────────────────────────────────────────
app.get('/api/areas', async (req, res) => {
  try {
    const [areas] = await db.query('SELECT * FROM areas');
    for (const area of areas) {
      const [sensores] = await db.query(
        'SELECT id, nombre, estado FROM sensores WHERE area_id = ?',
        [area.id]
      );
      area.sensores = sensores;
      const [empleados] = await db.query(
        `SELECT e.id, e.nombre, e.apellido FROM empleados e
         JOIN empleado_areas ea ON ea.empleado_id = e.id
         WHERE ea.area_id = ?`,
        [area.id]
      );
      area.empleados = empleados;
    }
    res.json(areas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las áreas' });
  }
});

// Crear un área nueva (sección 3, Parte 2). Recibe:
// { clave, etiqueta, etiquetaCompleta, sensores: [{ nombre, estado }], empleadoIds: [] }
// `sensores` y `empleadoIds` son opcionales (un área puede crearse vacía y completarse después con "Editar").
app.post('/api/areas', async (req, res) => {
  const { clave, etiqueta, etiquetaCompleta, sensores, empleadoIds } = req.body;
  if (!clave || !etiqueta) {
    return res.status(400).json({ error: 'Faltan datos (clave o etiqueta)' });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existente] = await conn.query('SELECT id FROM areas WHERE clave = ?', [clave]);
    if (existente.length > 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Ya existe un área con esa clave' });
    }

    const [result] = await conn.query(
      'INSERT INTO areas (clave, etiqueta, etiqueta_completa) VALUES (?, ?, ?)',
      [clave, etiqueta, etiquetaCompleta || etiqueta]
    );
    const areaId = result.insertId;

    if (Array.isArray(sensores) && sensores.length > 0) {
      const values = sensores.map((s) => [s.nombre, s.estado || 'en_funcionamiento', areaId]);
      await conn.query('INSERT INTO sensores (nombre, estado, area_id) VALUES ?', [values]);
    }

    if (Array.isArray(empleadoIds) && empleadoIds.length > 0) {
      const values = empleadoIds.map((empId) => [empId, areaId]);
      await conn.query('INSERT INTO empleado_areas (empleado_id, area_id) VALUES ?', [values]);
    }

    await conn.commit();
    res.status(201).json({ id: areaId, ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al crear el área' });
  } finally {
    conn.release();
  }
});

// Editar un área existente (sección 3, Parte 2). Recibe:
// { etiqueta, etiquetaCompleta, sensoresNuevos: [{ nombre, estado }],
//   sensoresActualizados: [{ id, nombre, estado }], empleadoIds: [] }
// Los sensores existentes solo se actualizan (nombre/estado), nunca se borran acá
// (algunos ya tienen historial de notificaciones) — para eso está el control de
// estado por sensor que ya existía en la sección de Áreas.
app.put('/api/areas/:id', async (req, res) => {
  const { etiqueta, etiquetaCompleta, sensoresNuevos, sensoresActualizados, empleadoIds } = req.body;
  const areaId = req.params.id;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (etiqueta || etiquetaCompleta) {
      await conn.query(
        'UPDATE areas SET etiqueta = COALESCE(?, etiqueta), etiqueta_completa = COALESCE(?, etiqueta_completa) WHERE id = ?',
        [etiqueta || null, etiquetaCompleta || null, areaId]
      );
    }

    if (Array.isArray(sensoresNuevos) && sensoresNuevos.length > 0) {
      const values = sensoresNuevos.map((s) => [s.nombre, s.estado || 'en_funcionamiento', areaId]);
      await conn.query('INSERT INTO sensores (nombre, estado, area_id) VALUES ?', [values]);
    }

    if (Array.isArray(sensoresActualizados)) {
      for (const s of sensoresActualizados) {
        if (!s.id) continue;
        await conn.query(
          'UPDATE sensores SET nombre = COALESCE(?, nombre), estado = COALESCE(?, estado) WHERE id = ? AND area_id = ?',
          [s.nombre || null, s.estado || null, s.id, areaId]
        );
      }
    }

    if (Array.isArray(empleadoIds)) {
      await conn.query('DELETE FROM empleado_areas WHERE area_id = ?', [areaId]);
      if (empleadoIds.length > 0) {
        const values = empleadoIds.map((empId) => [empId, areaId]);
        await conn.query('INSERT INTO empleado_areas (empleado_id, area_id) VALUES ?', [values]);
      }
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el área' });
  } finally {
    conn.release();
  }
});

// Cambiar el estado de un sensor. Si queda "fuera_de_servicio" o "reemplazar",
// se crea una notificación automática para esa área (visible en el dashboard global
// y en el centro de notificaciones de los empleados de esa área).
app.patch('/api/sensores/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    const [[sensor]] = await db.query(
      `SELECT s.id, s.nombre, s.area_id, a.etiqueta FROM sensores s
       JOIN areas a ON a.id = s.area_id WHERE s.id = ?`,
      [req.params.id]
    );
    if (!sensor) return res.status(404).json({ error: 'Sensor no encontrado' });

    await db.query('UPDATE sensores SET estado = ? WHERE id = ?', [estado, req.params.id]);

    if (estado === 'fuera_de_servicio' || estado === 'reemplazar') {
      const urgente = estado === 'fuera_de_servicio';
      const nivel = nivelDesdeEstado('asignada', urgente);
      const texto =
        estado === 'fuera_de_servicio'
          ? `Sensor "${sensor.nombre}" fuera de servicio en ${sensor.etiqueta}`
          : `Sensor "${sensor.nombre}" necesita reemplazo en ${sensor.etiqueta}`;
      await db.query(
        `INSERT INTO notificaciones (nivel, estado, urgente, alcance, area_id, texto, sensor_id)
         VALUES (?, 'asignada', ?, 'area', ?, ?, ?)`,
        [nivel, urgente ? 1 : 0, sensor.area_id, texto, sensor.id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el sensor' });
  }
});

// ─── Empleados ───────────────────────────────────────────
app.get('/api/empleados', async (req, res) => {
  try {
    const [empleados] = await db.query('SELECT * FROM empleados');
    for (const emp of empleados) {
      const [areas] = await db.query(
        `SELECT a.clave FROM areas a
         JOIN empleado_areas ea ON ea.area_id = a.id
         WHERE ea.empleado_id = ?`,
        [emp.id]
      );
      emp.areas = areas.map(a => a.clave);
    }
    res.json(empleados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los empleados' });
  }
});

app.post('/api/empleados', async (req, res) => {
  try {
    const { nombre, apellido, rol, horario, dias, documento, contacto, direccion, fecha_nacimiento } = req.body;
    const [result] = await db.query(
      `INSERT INTO empleados
       (nombre, apellido, rol, horario, dias, documento, contacto, direccion, fecha_nacimiento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellido, rol, horario, dias, documento, contacto, direccion, fecha_nacimiento || null]
    );
    await sincronizarUsuarioEmpleado(result.insertId, documento, rol);
    res.status(201).json({ id: result.insertId, cuentaCreada: !!documento, ...req.body });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el empleado' });
  }
});

app.put('/api/empleados/:id', async (req, res) => {
  try {
    const { nombre, apellido, rol, horario, dias, documento, contacto, direccion, fecha_nacimiento } = req.body;
    await db.query(
      `UPDATE empleados SET
       nombre = ?, apellido = ?, rol = ?, horario = ?, dias = ?,
       documento = ?, contacto = ?, direccion = ?, fecha_nacimiento = ?
       WHERE id = ?`,
      [nombre, apellido, rol, horario, dias, documento, contacto, direccion, fecha_nacimiento || null, req.params.id]
    );
    await sincronizarUsuarioEmpleado(req.params.id, documento, rol);
    res.json({ id: req.params.id, cuentaCreada: !!documento, ...req.body });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el empleado' });
  }
});

app.delete('/api/empleados/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM empleados WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el empleado' });
  }
});

// Actualiza las áreas asignadas a un empleado (relación muchos-a-muchos empleado_areas).
// Recibe { areas: ['plantines', 'nativos'] } con las claves de las áreas activas para ese empleado.
app.put('/api/empleados/:id/areas', async (req, res) => {
  const { areas } = req.body;
  const empleadoId = req.params.id;

  if (!Array.isArray(areas)) {
    return res.status(400).json({ error: 'El campo "areas" debe ser un array de claves de área' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('DELETE FROM empleado_areas WHERE empleado_id = ?', [empleadoId]);

    if (areas.length > 0) {
      const [areaRows] = await conn.query('SELECT id, clave FROM areas WHERE clave IN (?)', [areas]);
      if (areaRows.length > 0) {
        const values = areaRows.map((a) => [empleadoId, a.id]);
        await conn.query('INSERT INTO empleado_areas (empleado_id, area_id) VALUES ?', [values]);
      }
    }

    await conn.commit();
    res.json({ ok: true, areas });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar las áreas del empleado' });
  } finally {
    conn.release();
  }
});

// Actualizar la foto de perfil de un empleado (recibe la imagen en base64)
app.put('/api/empleados/:id/foto', async (req, res) => {
  try {
    const { foto } = req.body;
    await db.query('UPDATE empleados SET foto = ? WHERE id = ?', [foto, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la foto' });
  }
});

// ─── Notificaciones ──────────────────────────────────────
app.get('/api/notificaciones', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT n.id, n.nivel, n.estado, n.urgente, n.alcance, n.texto, n.descripcion,
              n.creado_en, n.oculto, n.eliminado, n.sensor_id, n.emitido_por,
              n.empleado_id, a.clave AS area,
              TRIM(CONCAT(e.nombre, ' ', COALESCE(e.apellido, ''))) AS empleado_nombre
       FROM notificaciones n
       LEFT JOIN areas a ON a.id = n.area_id
       LEFT JOIN empleados e ON e.id = n.empleado_id
       ORDER BY n.creado_en DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las notificaciones' });
  }
});

// Crear una notificación/tarea manual (admin o encargado, desde el botón "+").
// `alcance` define a quién apunta: un área completa, uno o varios empleados
// puntuales (se crea una notificación por cada uno), o general (para todos,
// sin área — area_id queda en NULL).
app.post('/api/notificaciones', async (req, res) => {
  try {
    const { urgente, alcance, area, empleadoIds, texto, descripcion, emitidoPor } = req.body;
    if (!texto || !alcance) {
      return res.status(400).json({ error: 'Faltan datos (texto o alcance)' });
    }
    const esUrgente = !!urgente;
    const nivel = nivelDesdeEstado('asignada', esUrgente);

    if (alcance === 'general') {
      const [result] = await db.query(
        `INSERT INTO notificaciones (nivel, estado, urgente, alcance, area_id, texto, descripcion, emitido_por)
         VALUES (?, 'asignada', ?, 'general', NULL, ?, ?, ?)`,
        [nivel, esUrgente ? 1 : 0, texto, descripcion || null, emitidoPor || null]
      );
      return res.status(201).json({ id: result.insertId, ok: true });
    }

    if (!area) return res.status(400).json({ error: 'Falta el área' });
    const [[areaRow]] = await db.query('SELECT id, etiqueta FROM areas WHERE clave = ?', [area]);
    if (!areaRow) return res.status(400).json({ error: 'Área inválida' });

    if (alcance === 'area') {
      const textoConArea = `${texto} en ${areaRow.etiqueta}`;
      const [result] = await db.query(
        `INSERT INTO notificaciones (nivel, estado, urgente, alcance, area_id, texto, descripcion, emitido_por)
         VALUES (?, 'asignada', ?, 'area', ?, ?, ?, ?)`,
        [nivel, esUrgente ? 1 : 0, areaRow.id, textoConArea, descripcion || null, emitidoPor || null]
      );
      return res.status(201).json({ id: result.insertId, ok: true });
    }

    if (alcance === 'empleados') {
      if (!Array.isArray(empleadoIds) || empleadoIds.length === 0) {
        return res.status(400).json({ error: 'Elegí al menos un empleado' });
      }
      const ids = [];
      for (const empleadoId of empleadoIds) {
        const [result] = await db.query(
          `INSERT INTO notificaciones (nivel, estado, urgente, alcance, area_id, empleado_id, texto, descripcion, emitido_por)
           VALUES (?, 'asignada', ?, 'empleados', ?, ?, ?, ?, ?)`,
          [nivel, esUrgente ? 1 : 0, areaRow.id, empleadoId, texto, descripcion || null, emitidoPor || null]
        );
        ids.push(result.insertId);
      }
      return res.status(201).json({ ids, ok: true });
    }

    return res.status(400).json({ error: 'Alcance inválido' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la notificación' });
  }
});

// Ocultar/mostrar: feature del Dashboard Global (Parte 2), no se toca.
app.patch('/api/notificaciones/:id/ocultar', async (req, res) => {
  try {
    await db.query('UPDATE notificaciones SET oculto = TRUE WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al ocultar la notificación' });
  }
});

app.patch('/api/notificaciones/:id/mostrar', async (req, res) => {
  try {
    await db.query('UPDATE notificaciones SET oculto = FALSE WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al mostrar la notificación' });
  }
});

// Empleado/Encargado: pasa la notificación de "Asignada" a "En proceso".
app.patch('/api/notificaciones/:id/tomar', async (req, res) => {
  try {
    const [[notif]] = await db.query('SELECT id FROM notificaciones WHERE id = ?', [req.params.id]);
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
    await db.query(
      `UPDATE notificaciones SET estado = 'en_proceso', nivel = ? WHERE id = ?`,
      [nivelDesdeEstado('en_proceso', false), req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al tomar la notificación' });
  }
});

// Empleado/Encargado: marca la notificación como "Solucionada" (queda de solo
// lectura, archivada). Si venía de un sensor, el sensor vuelve a funcionamiento.
app.patch('/api/notificaciones/:id/resolver', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[notif]] = await conn.query(
      'SELECT id, sensor_id FROM notificaciones WHERE id = ?',
      [req.params.id]
    );
    if (!notif) {
      await conn.rollback();
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    await conn.query(
      "UPDATE notificaciones SET nivel = 'green', estado = 'solucionada' WHERE id = ?",
      [req.params.id]
    );

    if (notif.sensor_id) {
      await conn.query(
        "UPDATE sensores SET estado = 'en_funcionamiento' WHERE id = ?",
        [notif.sensor_id]
      );
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al resolver la notificación' });
  } finally {
    conn.release();
  }
});

// Admin: cambia el estado libremente, incluyendo revertir una "Solucionada".
// Nota: el backend actual no tiene autenticación/roles — igual que el resto
// del panel, la restricción de que solo el Admin pueda usar esto se aplica
// desde el frontend (el botón no se muestra a otros roles).
app.patch('/api/notificaciones/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    if (!['asignada', 'en_proceso', 'solucionada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const [[notif]] = await db.query(
      'SELECT sensor_id, urgente FROM notificaciones WHERE id = ?',
      [req.params.id]
    );
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });

    const nivel = nivelDesdeEstado(estado, !!notif.urgente);
    await db.query('UPDATE notificaciones SET estado = ?, nivel = ? WHERE id = ?', [estado, nivel, req.params.id]);

    if (estado === 'solucionada' && notif.sensor_id) {
      await db.query("UPDATE sensores SET estado = 'en_funcionamiento' WHERE id = ?", [notif.sensor_id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar el estado de la notificación' });
  }
});

// Admin: enviar a la papelera / restaurar. Distinto de ocultar/mostrar (Parte 2).
app.patch('/api/notificaciones/:id/eliminar', async (req, res) => {
  try {
    await db.query('UPDATE notificaciones SET eliminado = TRUE WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la notificación' });
  }
});

app.patch('/api/notificaciones/:id/restaurar', async (req, res) => {
  try {
    await db.query('UPDATE notificaciones SET eliminado = FALSE WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al restaurar la notificación' });
  }
});

// ─── Umbrales de sensores (alertas automáticas configurables) ──────────────
// Visible para Encargado y Admin (el frontend no lo muestra a Empleado).
// Para esta demo el límite es por sensor, global (no depende del área).
app.get('/api/umbrales', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id AS sensor_id, s.nombre, u.minimo, u.maximo
       FROM sensores s
       LEFT JOIN umbrales_sensores u ON u.sensor_id = s.id
       WHERE s.id != 4
       ORDER BY s.id`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los umbrales de sensores' });
  }
});

app.put('/api/umbrales/:sensorId', async (req, res) => {
  try {
    const sensorId = Number(req.params.sensorId);
    if (sensorId === 4) {
      return res.status(400).json({ error: 'La Temperatura de Emergencia usa su propio umbral fijo (50°)' });
    }
    const { minimo, maximo } = req.body;
    const tieneMinimo = minimo !== undefined && minimo !== null && minimo !== '';
    const tieneMaximo = maximo !== undefined && maximo !== null && maximo !== '';
    if (!tieneMinimo && !tieneMaximo) {
      return res.status(400).json({ error: 'Definí al menos un valor (mínimo o máximo)' });
    }
    await db.query(
      `INSERT INTO umbrales_sensores (sensor_id, minimo, maximo) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE minimo = VALUES(minimo), maximo = VALUES(maximo)`,
      [sensorId, tieneMinimo ? minimo : null, tieneMaximo ? maximo : null]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el umbral' });
  }
});

// ─── Login ───────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { usuario, contrasena } = req.body;
    const [rows] = await db.query(
      'SELECT * FROM usuarios WHERE usuario = ?',
      [usuario]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const user = rows[0];
    const coincide = await bcrypt.compare(contrasena, user.contrasena);
    if (!coincide) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    let empleado = null;
    if (user.empleado_id) {
      const [empRows] = await db.query('SELECT * FROM empleados WHERE id = ?', [user.empleado_id]);
      if (empRows.length > 0) {
        empleado = empRows[0];
        const [areas] = await db.query(
          `SELECT a.clave FROM areas a
           JOIN empleado_areas ea ON ea.area_id = a.id
           WHERE ea.empleado_id = ?`,
          [empleado.id]
        );
        empleado.areas = areas.map(a => a.clave);
      }
    }

    res.json({ usuario: user.usuario, esAdmin: !!user.es_admin, empleado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el login' });
  }
});

// ─── Llamados de emergencia (sección 2, Parte 2) ────────────────────────────
// Mismo esquema de 3 estados que las notificaciones (Asignada → En proceso →
// Solucionada), pero sin el flag "urgente": un llamado siempre nace urgente
// (rojo) porque es, por definición, una emergencia — deja de serlo recién
// cuando alguien lo toma (amarillo) o lo atiende (verde). El color en sí se
// calcula en el frontend (colorDeLlamado en api.ts), acá solo se persiste el estado.
// destino: 'encargado' (con destino_empleado_id puntual) o 'admin'.
app.get('/api/llamados', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.id, l.mensaje, l.atendido, l.estado, l.destino, l.eliminado, l.creado_en,
              a.clave AS area,
              e.id AS empleado_id, e.nombre AS empleado_nombre, e.apellido AS empleado_apellido, e.rol AS empleado_rol,
              d.id AS destino_empleado_id, d.nombre AS destino_nombre, d.apellido AS destino_apellido
       FROM llamados l
       JOIN areas a ON a.id = l.area_id
       JOIN empleados e ON e.id = l.empleado_id
       LEFT JOIN empleados d ON d.id = l.destino_empleado_id
       ORDER BY l.creado_en DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los llamados' });
  }
});

// Crear un llamado de emergencia. `empleadoId` es quien lo emite (puede ser un
// Empleado o un Encargado — ambos son filas de `empleados`, se distinguen por `rol`).
// - destino = 'encargado': requiere destinoEmpleadoId (el Encargado puntual elegido,
//   debe pertenecer a esa área). Solo lo puede usar un Empleado.
// - destino = 'admin': lo puede usar tanto un Empleado como un Encargado.
app.post('/api/llamados', async (req, res) => {
  try {
    const { empleadoId, area, destino, destinoEmpleadoId, mensaje } = req.body;
    if (!empleadoId || !area || !destino) {
      return res.status(400).json({ error: 'Faltan datos (empleado, área o destino)' });
    }
    if (!['encargado', 'admin'].includes(destino)) {
      return res.status(400).json({ error: 'Destino inválido' });
    }
    const [[areaRow]] = await db.query('SELECT id FROM areas WHERE clave = ?', [area]);
    if (!areaRow) return res.status(400).json({ error: 'Área inválida' });

    let destinoId = null;
    if (destino === 'encargado') {
      if (!destinoEmpleadoId) {
        return res.status(400).json({ error: 'Elegí a qué Encargado enviar el llamado' });
      }
      const [[encargado]] = await db.query(
        `SELECT e.id FROM empleados e
         JOIN empleado_areas ea ON ea.empleado_id = e.id
         WHERE e.id = ? AND e.rol = 'Encargado' AND ea.area_id = ?`,
        [destinoEmpleadoId, areaRow.id]
      );
      if (!encargado) {
        return res.status(400).json({ error: 'El Encargado elegido no pertenece a esa área' });
      }
      destinoId = encargado.id;
    }

    const [result] = await db.query(
      `INSERT INTO llamados (empleado_id, area_id, destino, destino_empleado_id, mensaje, estado)
       VALUES (?, ?, ?, ?, ?, 'asignada')`,
      [empleadoId, areaRow.id, destino, destinoId, mensaje || null]
    );
    res.status(201).json({ id: result.insertId, ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el llamado' });
  }
});

// Quien lo recibe: Asignado -> En proceso ("lo estoy atendiendo")
app.patch('/api/llamados/:id/tomar', async (req, res) => {
  try {
    await db.query("UPDATE llamados SET estado = 'en_proceso' WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al tomar el llamado' });
  }
});

// Quien lo recibe: -> Solucionada/Atendida (se archiva en "Llamados atendidos", solo lectura)
app.patch('/api/llamados/:id/atender', async (req, res) => {
  try {
    await db.query("UPDATE llamados SET atendido = TRUE, estado = 'solucionada' WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al marcar el llamado como atendido' });
  }
});

// Admin: cambia el estado libremente (incluye reabrir un llamado ya solucionado).
app.patch('/api/llamados/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    if (!['asignada', 'en_proceso', 'solucionada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    await db.query('UPDATE llamados SET estado = ?, atendido = ? WHERE id = ?', [
      estado,
      estado === 'solucionada',
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar el estado del llamado' });
  }
});

// Admin, desde el Dashboard Global (corrección punto 3): enviar a la papelera / restaurar.
app.patch('/api/llamados/:id/eliminar', async (req, res) => {
  try {
    await db.query('UPDATE llamados SET eliminado = TRUE WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el llamado' });
  }
});

app.patch('/api/llamados/:id/restaurar', async (req, res) => {
  try {
    await db.query('UPDATE llamados SET eliminado = FALSE WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al restaurar el llamado' });
  }
});

// ─── Estadísticas / Sensores ESP32 ──────────────────────────────────────────
// Endpoint para que el ESP32 envíe los datos de telemetría de todos los sensores juntos
app.post('/api/telemetria', async (req, res) => {
  try {
    const { luz, temp_dht, humedad_dht, temp_roja } = req.body;
    
    if (luz === undefined || temp_dht === undefined || humedad_dht === undefined || temp_roja === undefined) {
      return res.status(400).json({ error: 'Faltan datos en el payload de telemetría' });
    }

    const timestamp = new Date();

    // Insertamos cada lectura mapeada a su respectivo sensor_id en la base de datos
    // IDs asumidos: 1=Luz, 2=DHT Temp, 3=DHT Humedad, 4=Temp Roja (KY-028)
    await db.query('INSERT INTO lecturas_sensores (sensor_id, valor, creado_en) VALUES (?, ?, ?)', [1, luz, timestamp]);
    await db.query('INSERT INTO lecturas_sensores (sensor_id, valor, creado_en) VALUES (?, ?, ?)', [2, temp_dht, timestamp]);
    await db.query('INSERT INTO lecturas_sensores (sensor_id, valor, creado_en) VALUES (?, ?, ?)', [3, humedad_dht, timestamp]);
    await db.query('INSERT INTO lecturas_sensores (sensor_id, valor, creado_en) VALUES (?, ?, ?)', [4, temp_roja, timestamp]);

    // Alertas automáticas por umbral configurable, para cualquier sensor que no
    // sea la Temp. de Emergencia (ver más abajo, que sigue con su caso especial).
    await evaluarUmbralSensor(1, luz);
    await evaluarUmbralSensor(2, temp_dht);
    await evaluarUmbralSensor(3, humedad_dht);

    // Si la temperatura crítica (KY-028) supera el umbral, el ESP32 ya prendió el
    // ventilador y la alarma por su cuenta. Acá avisamos a la web automáticamente
    // creando una notificación roja de "emergencia de fuego" para la demo.
    // Sigue aparte del sistema general de umbrales: va urgente (roja) a todos los roles.
    if (Number(temp_roja) > UMBRAL_TEMP_EMERGENCIA) {
      if (!emergenciaNotificada) {
        emergenciaNotificada = true;
        const [[sensorEmergencia]] = await db.query(
          `SELECT s.id, s.nombre, s.area_id, a.etiqueta FROM sensores s
           JOIN areas a ON a.id = s.area_id WHERE s.id = 4`
        );
        if (sensorEmergencia) {
          const texto = `🔥 Emergencia de temperatura en ${sensorEmergencia.etiqueta}`;
          const descripcion = `Se detectaron ${temp_roja}°C en el sensor "${sensorEmergencia.nombre}". Ventilador activado automáticamente.`;
          await db.query(
            `INSERT INTO notificaciones (nivel, estado, urgente, alcance, area_id, texto, descripcion, sensor_id)
             VALUES (?, 'asignada', 1, 'area', ?, ?, ?, ?)`,
            [nivelDesdeEstado('asignada', true), sensorEmergencia.area_id, texto, descripcion, sensorEmergencia.id]
          );
        }
      }
    } else {
      // Temperatura de nuevo normal: si vuelve a subir más adelante, se crea una notificación nueva.
      emergenciaNotificada = false;
    }

    res.status(201).json({ ok: true, mensaje: 'Telemetría múltiple guardada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar la telemetría del ESP32' });
  }
});

// Endpoint para que el Frontend obtenga el HISTORIAL de lecturas de los sensores
// (usado por la página de Estadísticas para armar los gráficos con datos reales)
app.get('/api/lecturas', async (req, res) => {
  try {
    const { desde } = req.query; // fecha ISO opcional (ej: 2026-09-09T00:00:00) para filtrar por rango
    let query = 'SELECT sensor_id, valor, creado_en FROM lecturas_sensores';
    const params = [];
    if (desde) {
  query += ' WHERE creado_en >= ?';
  params.push(new Date(desde)); // antes: params.push(desde) — pasar el string crudo rompía la comparación de horario
}
    query += ' ORDER BY creado_en ASC';
    const [rows] = await db.query(query, params);
    // `valor` es DECIMAL(10,2) en MySQL: el driver mysql2 lo devuelve como STRING por
    // defecto (no como number). Sin este cast, sumarlos en el frontend hacía
    // concatenación de texto en vez de suma numérica y el promedio daba NaN
    // ("Promedio NaN" del punto 4 de las correcciones). Se normaliza acá para que
    // el JSON que llega al frontend siempre traiga números de verdad.
    const rowsNormalizadas = rows.map((r) => ({ ...r, valor: Number(r.valor) }));
    res.json(rowsNormalizadas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las lecturas de los sensores' });
  }
});

// Endpoint para que el Frontend obtenga las estadísticas y las muestre
app.get('/api/estadisticas', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id, s.nombre, s.estado, a.etiqueta AS area_nombre 
       FROM sensores s 
       JOIN areas a ON a.id = s.area_id`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las estadísticas' });
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});