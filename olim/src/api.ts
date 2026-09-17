// src/api.ts — funciones para conectar con el backend (Node.js + MySQL)

const API_URL = `http://${window.location.hostname}:3001/api`;

// ─── Notificaciones — estados y color (Parte 1) ─────────────────────────────
export type NotifEstado = "asignada" | "en_proceso" | "solucionada";
export type NotifAlcance = "area" | "empleados" | "general";
export type NotifColor = "red" | "orange" | "yellow" | "green";

// Único lugar del código (frontend) donde se mapean los 4 estados visuales a
// su color, tal como pide la Parte 1 (sección 7):
//   🔴 Urgente (sin tomar) · 🟠 Asignada (no urgente) · 🟡 En proceso · 🟢 Solucionada
export function colorDeNotificacion(estado: NotifEstado, urgente: boolean): NotifColor {
  if (estado === "solucionada") return "green";
  if (estado === "en_proceso") return "yellow";
  return urgente ? "red" : "orange";
}

// ─── Llamados de emergencia — estados y color (Parte 2) ─────────────────────
// Mismo esquema de 3 estados que las notificaciones, sin "urgente": un llamado
// es urgente por definición hasta que alguien lo toma o lo atiende (sección 2).
export type LlamadoEstado = "asignada" | "en_proceso" | "solucionada";
export type LlamadoDestino = "encargado" | "admin";

export function colorDeLlamado(estado: LlamadoEstado): NotifColor {
  if (estado === "solucionada") return "green";
  if (estado === "en_proceso") return "yellow";
  return "red";
}

export type EmpleadoForm = {
  nombre: string;
  apellido: string;
  rol: string;
  horario: string;
  dias: string;
  documento: string;
  contacto: string;
  direccion: string;
  fecha_nacimiento: string; // formato "YYYY-MM-DD"
};

export async function fetchEmpleados() {
  const res = await fetch(`${API_URL}/empleados`);
  if (!res.ok) throw new Error("Error al traer empleados");
  const data = await res.json();
  // la API devuelve campos en español; los traducimos a lo que espera el frontend
  return data.map((e: any) => ({
    id: e.id,
    name: e.nombre,
    lastName: e.apellido,
    role: e.rol,
    schedule: e.horario,
    days: e.dias,
    documentId: e.documento,
    contact: e.contacto,
    address: e.direccion,
    birthDate: e.fecha_nacimiento,
    photo: e.foto,
    areas: e.areas,
  }));
}

export async function fetchAreas() {
  const res = await fetch(`${API_URL}/areas`);
  if (!res.ok) throw new Error("Error al traer áreas");
  const data = await res.json();
  return data.map((a: any) => ({
    id: a.id,
    key: a.clave,
    label: a.etiqueta,
    fullLabel: a.etiqueta_completa,
    sensors: a.sensores.map((s: any) => ({ id: s.id, name: s.nombre, status: s.estado })),
    employeeIds: a.empleados.map((e: any) => e.id),
    employeeNames: a.empleados.map((e: any) => `${e.nombre} ${e.apellido ?? ""}`.trim()),
  }));
}

// Crear una nueva área (sección 3, Parte 2): nombre, sensores iniciales y empleados asignados.
export async function crearArea(datos: {
  clave: string;
  etiqueta: string;
  etiquetaCompleta?: string;
  sensores?: { nombre: string; estado?: string }[];
  empleadoIds?: number[];
}) {
  const res = await fetch(`${API_URL}/areas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al crear el área");
  }
  return res.json();
}

// Editar un área existente: renombrar, agregar sensores nuevos, actualizar los
// existentes (nombre/estado) y resincronizar la lista de empleados asignados.
export async function actualizarArea(
  areaId: number,
  datos: {
    etiqueta?: string;
    etiquetaCompleta?: string;
    sensoresNuevos?: { nombre: string; estado?: string }[];
    sensoresActualizados?: { id: number; nombre?: string; estado?: string }[];
    empleadoIds?: number[];
  }
) {
  const res = await fetch(`${API_URL}/areas/${areaId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al actualizar el área");
  }
  return res.json();
}

export async function actualizarEstadoSensor(id: number, estado: string) {
  const res = await fetch(`${API_URL}/sensores/${id}/estado`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) throw new Error("Error al actualizar el sensor");
  return res.json();
}

function tiempoRelativo(fecha: string) {
  const diffMs = Date.now() - new Date(fecha).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "Recién";
  if (min < 60) return `Hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `Hace ${horas} hora${horas > 1 ? "s" : ""}`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "Ayer";
  return `Hace ${dias} días`;
}

export async function fetchNotificaciones() {
  const res = await fetch(`${API_URL}/notificaciones`);
  if (!res.ok) throw new Error("Error al traer notificaciones");
  const data = await res.json();
  // la API devuelve campos en español; los traducimos a lo que espera el frontend
  return data.map((n: any) => ({
    id: n.id,
    level: n.nivel, // color "clásico" — se mantiene por compatibilidad con el Dashboard Global (Parte 2)
    estado: n.estado as NotifEstado,
    urgente: !!n.urgente,
    alcance: n.alcance as NotifAlcance,
    text: n.texto,
    description: n.descripcion,
    time: tiempoRelativo(n.creado_en),
    area: n.area, // null cuando alcance === "general"
    empleadoId: n.empleado_id ?? null,
    empleadoNombre: n.empleado_nombre || null,
    emitidoPor: n.emitido_por || null,
    hidden: !!n.oculto, // feature del Dashboard Global (Parte 2)
    eliminado: !!n.eliminado, // papelera (Parte 1, solo Admin)
    sensor: n.sensor_id != null,
    creadoEn: n.creado_en, // timestamp crudo (ISO) — para filtros de rango de fechas reales
  }));
}

// Lecturas crudas de los sensores del ESP32 (para armar los gráficos de Estadísticas)
export type LecturaSensor = { sensor_id: number; valor: number; creado_en: string };

export async function fetchLecturas(desde?: string): Promise<LecturaSensor[]> {
  const url = desde ? `${API_URL}/lecturas?desde=${encodeURIComponent(desde)}` : `${API_URL}/lecturas`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error al traer las lecturas de los sensores");
  return res.json();
}

export async function fetchLlamados() {
  const res = await fetch(`${API_URL}/llamados`);
  if (!res.ok) throw new Error("Error al traer llamados");
  const data = await res.json();
  return data.map((l: any) => ({
    id: l.id,
    empleadoId: l.empleado_id,
    empleadoNombre: `${l.empleado_nombre} ${l.empleado_apellido ?? ""}`.trim(),
    empleadoRol: l.empleado_rol as "Empleado" | "Encargado" | "Admin",
    area: l.area,
    mensaje: l.mensaje,
    estado: l.estado as LlamadoEstado,
    destino: l.destino as LlamadoDestino,
    destinoEmpleadoId: l.destino_empleado_id ?? null,
    destinoNombre: l.destino_empleado_id ? `${l.destino_nombre} ${l.destino_apellido ?? ""}`.trim() : "Admin",
    atendido: !!l.atendido,
    eliminado: !!l.eliminado, // papelera (corrección punto 3, solo Admin desde el Dashboard Global)
    time: tiempoRelativo(l.creado_en),
    creadoEn: l.creado_en, // timestamp crudo (ISO) — para filtros de rango de fechas reales
  }));
}

export async function crearLlamado(datos: {
  empleadoId: number;
  area: string;
  destino: LlamadoDestino;
  destinoEmpleadoId?: number;
  mensaje?: string;
}) {
  const res = await fetch(`${API_URL}/llamados`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al crear el llamado");
  }
  return res.json();
}

// Quien lo recibe: Asignado -> En proceso
export async function tomarLlamado(id: number) {
  const res = await fetch(`${API_URL}/llamados/${id}/tomar`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al tomar el llamado");
  return res.json();
}

// Quien lo recibe: -> Solucionada/Atendida (se archiva en "Llamados atendidos")
export async function atenderLlamado(id: number) {
  const res = await fetch(`${API_URL}/llamados/${id}/atender`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al marcar el llamado como atendido");
  return res.json();
}

// Admin: cambia el estado libremente (incluye reabrir uno ya solucionado)
export async function cambiarEstadoLlamado(id: number, estado: LlamadoEstado) {
  const res = await fetch(`${API_URL}/llamados/${id}/estado`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) throw new Error("Error al cambiar el estado del llamado");
  return res.json();
}

// Admin, desde el Dashboard Global (corrección punto 3): enviar a la papelera / restaurar.
export async function enviarLlamadoAPapelera(id: number) {
  const res = await fetch(`${API_URL}/llamados/${id}/eliminar`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al eliminar el llamado");
  return res.json();
}

export async function restaurarLlamadoDePapelera(id: number) {
  const res = await fetch(`${API_URL}/llamados/${id}/restaurar`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al restaurar el llamado");
  return res.json();
}

export async function crearNotificacion(datos: {
  urgente: boolean;
  alcance: NotifAlcance;
  area?: string; // requerido si alcance es "area" o "empleados"
  empleadoIds?: number[]; // requerido si alcance es "empleados"
  texto: string;
  descripcion?: string;
  emitidoPor?: string;
}) {
  const res = await fetch(`${API_URL}/notificaciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al crear la notificación");
  }
  return res.json();
}

export async function crearEmpleado(empleado: EmpleadoForm) {
  const res = await fetch(`${API_URL}/empleados`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(empleado),
  });
  if (!res.ok) throw new Error("Error al crear empleado");
  return res.json();
}

export async function actualizarEmpleado(id: number, empleado: EmpleadoForm) {
  const res = await fetch(`${API_URL}/empleados/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(empleado),
  });
  if (!res.ok) throw new Error("Error al actualizar empleado");
  return res.json();
}

export async function actualizarAreasEmpleado(id: number, areas: string[]) {
  const res = await fetch(`${API_URL}/empleados/${id}/areas`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ areas }),
  });
  if (!res.ok) throw new Error("Error al actualizar las áreas del empleado");
  return res.json();
}

export async function login(usuario: string, contrasena: string) {
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, contrasena }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Usuario o contraseña incorrectos");
  }
  const data = await res.json(); // { usuario, esAdmin, empleado }
  const e = data.empleado;
  return {
    usuario: data.usuario,
    esAdmin: data.esAdmin,
    empleado: e
      ? {
          id: e.id,
          name: e.nombre,
          lastName: e.apellido,
          role: e.rol,
          schedule: e.horario,
          days: e.dias,
          documentId: e.documento,
          contact: e.contacto,
          address: e.direccion,
          birthDate: e.fecha_nacimiento,
          photo: e.foto,
          areas: e.areas,
        }
      : null,
  };
}

export async function actualizarFotoEmpleado(id: number, fotoBase64: string) {
  const res = await fetch(`${API_URL}/empleados/${id}/foto`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ foto: fotoBase64 }),
  });
  if (!res.ok) throw new Error("Error al actualizar la foto");
  return res.json();
}

export async function eliminarEmpleado(id: number) {
  const res = await fetch(`${API_URL}/empleados/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Error al eliminar empleado");
  return res.json();
}

export async function ocultarNotificacion(id: number) {
  const res = await fetch(`${API_URL}/notificaciones/${id}/ocultar`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al ocultar notificación");
  return res.json();
}

export async function mostrarNotificacion(id: number) {
  const res = await fetch(`${API_URL}/notificaciones/${id}/mostrar`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al mostrar notificación");
  return res.json();
}

// Empleado/Encargado: Asignada -> En proceso
export async function tomarNotificacion(id: number) {
  const res = await fetch(`${API_URL}/notificaciones/${id}/tomar`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al tomar la notificación");
  return res.json();
}

// Empleado/Encargado: En proceso -> Solucionada (queda archivada, de solo lectura)
export async function resolverNotificacion(id: number) {
  const res = await fetch(`${API_URL}/notificaciones/${id}/resolver`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al resolver notificación");
  return res.json();
}

// Admin: cambia el estado libremente (incluye revertir una "Solucionada")
export async function cambiarEstadoNotificacion(id: number, estado: NotifEstado) {
  const res = await fetch(`${API_URL}/notificaciones/${id}/estado`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) throw new Error("Error al cambiar el estado de la notificación");
  return res.json();
}

// Admin: enviar a la papelera / restaurar (distinto de ocultar/mostrar, que es del Dashboard Global)
export async function enviarNotificacionAPapelera(id: number) {
  const res = await fetch(`${API_URL}/notificaciones/${id}/eliminar`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al eliminar la notificación");
  return res.json();
}

export async function restaurarNotificacionDePapelera(id: number) {
  const res = await fetch(`${API_URL}/notificaciones/${id}/restaurar`, { method: "PATCH" });
  if (!res.ok) throw new Error("Error al restaurar la notificación");
  return res.json();
}

// ─── Umbrales de sensores (alertas automáticas configurables) ──────────────
export type UmbralSensor = {
  sensor_id: number;
  nombre: string;
  minimo: number | null;
  maximo: number | null;
};

export async function fetchUmbrales(): Promise<UmbralSensor[]> {
  const res = await fetch(`${API_URL}/umbrales`);
  if (!res.ok) throw new Error("Error al traer los umbrales de sensores");
  return res.json();
}

export async function guardarUmbral(sensorId: number, datos: { minimo?: number | null; maximo?: number | null }) {
  const res = await fetch(`${API_URL}/umbrales/${sensorId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Error al guardar el umbral");
  }
  return res.json();
}

