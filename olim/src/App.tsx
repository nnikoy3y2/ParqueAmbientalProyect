import { useState, useRef, useEffect, type CSSProperties, type ReactNode } from "react";
import profilePhoto from "@/imports/PRENSA.jpg";
// Exportación a PDF del Historial: requiere `npm install jspdf jspdf-autotable`
// en el proyecto (no son dependencias que ya estuvieran instaladas).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  fetchEmpleados,
  login,
  fetchNotificaciones,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado,
  resolverNotificacion,
  tomarNotificacion,
  cambiarEstadoNotificacion,
  enviarNotificacionAPapelera,
  restaurarNotificacionDePapelera,
  colorDeNotificacion,
  fetchAreas,
  crearArea,
  actualizarArea,
  actualizarEstadoSensor,
  actualizarAreasEmpleado,
  actualizarFotoEmpleado,
  crearNotificacion,
  fetchLlamados,
  crearLlamado,
  atenderLlamado,
  tomarLlamado,
  cambiarEstadoLlamado,
  enviarLlamadoAPapelera,
  restaurarLlamadoDePapelera,
  colorDeLlamado,
  fetchLecturas,
  fetchUmbrales,
  guardarUmbral,
  type EmpleadoForm,
  type LecturaSensor,
  type NotifEstado,
  type NotifAlcance,
  type NotifColor,
  type UmbralSensor,
  type LlamadoEstado,
  type LlamadoDestino,
} from "./api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Page = "login" | "dashboard";
type NotifLevel = "red" | "yellow" | "green";
type FilterState = "all" | "red" | "yellow" | "green";

// ─── Dark mode context helper ─────────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(false);
  return { dark, toggleDark: () => setDark((v) => !v) };
}

// ─── Pine leaf logo — hoja en capas + gota de rocío, degradé pine→lime ────────
function PineLogo({ size = 28 }: { size?: number }) {
  const uid = useRef(`lg-${Math.random().toString(36).slice(2, 9)}`).current;
  return (
    <svg viewBox="0 0 32 36" fill="none" style={{ width: size, height: size }}>
      <defs>
        <linearGradient id={`${uid}-a`} x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--pine)" />
          <stop offset="100%" stopColor="var(--lime)" />
        </linearGradient>
      </defs>
      <path
        d="M16 2C16 2 6 10 6 20a10 10 0 0020 0C26 10 16 2 16 2z"
        fill={`url(#${uid}-a)`}
        opacity="0.92"
      />
      <path
        d="M16 8C16 8 10 14 10 20a6 6 0 0012 0C22 14 16 8 16 8z"
        fill="var(--lime-bright)"
        opacity="0.55"
      />
      {/* Gota de rocío — el toque "aero" glossy */}
      <ellipse cx="20.5" cy="14.5" rx="2.1" ry="2.7" fill="#fff" opacity="0.55" />
      <rect x="15" y="28" width="2" height="6" rx="1" fill="var(--pine)" opacity="0.5" />
    </svg>
  );
}

// ─── Brand mark — logo "Parque Ambiental": hoja/globo + ciudad + check de gestión ──
// Vectorizado y minimalista, inspirado en la referencia enviada, pero resuelto
// enteramente con los tokens de color del sitio (sin blancos puros) para que
// funcione igual de bien en tema claro y oscuro.
function BrandMark({ size = 60 }: { size?: number }) {
  const uid = useRef(`bm-${Math.random().toString(36).slice(2, 9)}`).current;
  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: size, height: size }}>
      <defs>
        <linearGradient id={`${uid}-leaf`} x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--pine)" />
          <stop offset="100%" stopColor="var(--lime)" />
        </linearGradient>
        <linearGradient id={`${uid}-leaf-inner`} x1="18" y1="16" x2="46" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--lime-bright)" />
          <stop offset="100%" stopColor="var(--pine-mid)" />
        </linearGradient>
      </defs>

      {/* Hoja / globo — silueta principal, hace de "mundo verde" */}
      <path
        d="M32 4C32 4 8 20 8 40a24 22 0 0048 0C56 20 32 4 32 4z"
        fill={`url(#${uid}-leaf)`}
        opacity="0.95"
      />
      <path
        d="M32 15C32 15 17 27 17 40a15 14 0 0030 0C47 27 32 15 32 15z"
        fill={`url(#${uid}-leaf-inner)`}
        opacity="0.55"
      />
      {/* Vena central de la hoja */}
      <path d="M32 10V60" stroke="var(--lime-bright)" strokeWidth="1.4" opacity="0.45" strokeLinecap="round" />

      {/* Ciudad — skyline sutil asomando dentro de la hoja (tono "surface", no blanco puro) */}
      <rect x="16" y="42" width="6" height="13" rx="1.2" fill="var(--surface)" opacity="0.88" stroke="var(--pine)" strokeWidth="0.6" />
      <rect x="23" y="36" width="6" height="19" rx="1.2" fill="var(--surface)" opacity="0.92" stroke="var(--pine)" strokeWidth="0.6" />

      {/* Check de gestión — insignia inferior derecha */}
      <circle cx="46" cy="47" r="10" fill="var(--lime-bright)" stroke="var(--surface)" strokeWidth="2" />
      <path d="M41.5 47.2l3 3 6-6.6" stroke="var(--pine)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ─── Decoración eco-aero: burbujas + hojas flotantes translúcidas ─────────────
// Uso: capa decorativa absoluta detrás del contenido. `density` regula cuántos
// elementos se muestran (menos en zonas de trabajo, más en pantallas hero).
function EcoBubbles({ dark, density = "normal" }: { dark: boolean; density?: "low" | "normal" }) {
  const bubbles = density === "low"
    ? [
        { size: 46, top: "8%", left: "88%", delay: "0s", dur: "7s" },
        { size: 26, top: "70%", left: "6%", delay: "1.2s", dur: "6s" },
      ]
    : [
        { size: 64, top: "10%", left: "86%", delay: "0s",   dur: "7.5s" },
        { size: 34, top: "22%", left: "92%", delay: "0.8s", dur: "6s" },
        { size: 22, top: "38%", left: "80%", delay: "1.6s", dur: "5.2s" },
        { size: 40, top: "72%", left: "5%",  delay: "0.4s", dur: "6.8s" },
        { size: 20, top: "85%", left: "16%", delay: "1.1s", dur: "5.6s" },
        { size: 28, top: "58%", left: "94%", delay: "2s",   dur: "6.2s" },
      ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {bubbles.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            left: b.left,
            background: `radial-gradient(circle at 32% 28%, ${dark ? "rgba(166,217,87,0.35)" : "rgba(255,255,255,0.75)"} 0%, ${dark ? "rgba(127,190,151,0.08)" : "rgba(124,181,58,0.10)"} 60%, transparent 78%)`,
            border: `1px solid ${dark ? "rgba(166,217,87,0.18)" : "rgba(255,255,255,0.65)"}`,
            boxShadow: dark ? "0 4px 18px rgba(0,0,0,0.25)" : "0 6px 20px rgba(58,111,84,0.10)",
            animation: `float ${b.dur} ease-in-out infinite`,
            animationDelay: b.delay,
          }}
        />
      ))}
      {/* Hoja decorativa grande, balanceándose — esquina inferior */}
      <svg
        viewBox="0 0 120 140"
        className="animate-sway absolute"
        style={{ width: 130, height: 150, bottom: -30, right: -20, opacity: dark ? 0.14 : 0.16 }}
      >
        <path d="M60 4C60 4 12 34 12 82c0 38 26 54 48 54s48-16 48-54C108 34 60 4 60 4z" fill="var(--pine)" />
        <path d="M60 20V132" stroke="var(--lime-bright)" strokeWidth="2" opacity="0.5" />
      </svg>
    </div>
  );
}

// ─── Botón de WhatsApp — consulta general al número fijo del responsable ──────
// Abre WhatsApp (app o web, según el dispositivo) con un mensaje ya armado.
// El envío final siempre lo confirma la persona desde WhatsApp: esto NO manda
// mensajes automáticos por sí solo (para eso se necesitaría la API de WhatsApp
// Business, que es otro proyecto aparte — ver conversación).
const WHATSAPP_NUMERO = "5492213990498"; // +54 9 221 399-0498, sin "+" ni espacios/guiones

function buildWhatsAppLink(mensaje: string) {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
}

function WhatsAppButton({
  mensaje = "Hola, quería hacer una consulta sobre Parque Ambiental.",
  compact = false,
}: {
  mensaje?: string;
  compact?: boolean;
}) {
  return (
    <a
      href={buildWhatsAppLink(mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      title="Consultar por WhatsApp"
      className={`relative rounded-xl flex items-center justify-center gap-2 transition-all ${compact ? "" : "px-2.5 sm:px-3.5"}`}
      style={{
        height: 38,
        padding: compact ? 0 : undefined,
        width: compact ? 38 : undefined,
        background: "linear-gradient(135deg, #25D366, #1DA851)",
        border: "1px solid rgba(0,0,0,0.06)",
        color: "#fff",
        boxShadow: "0 4px 14px rgba(37,211,102,0.35)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 18px rgba(37,211,102,0.45)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 14px rgba(37,211,102,0.35)";
      }}
    >
      <svg viewBox="0 0 32 32" fill="currentColor" style={{ width: 17, height: 17, flexShrink: 0 }}>
        <path d="M16.004 2.667c-7.363 0-13.333 5.97-13.333 13.333 0 2.353.615 4.56 1.692 6.474L2.667 29.333l7.03-1.845a13.26 13.26 0 006.307 1.606h.006c7.363 0 13.333-5.97 13.333-13.333S23.367 2.667 16.004 2.667zm0 24.4h-.005a11.02 11.02 0 01-5.617-1.537l-.403-.24-4.172 1.094 1.114-4.067-.263-.417a11.02 11.02 0 01-1.688-5.9c0-6.103 4.966-11.067 11.04-11.067 2.95 0 5.72 1.15 7.807 3.24a10.97 10.97 0 013.233 7.83c0 6.103-4.966 11.064-11.046 11.064zm6.058-8.29c-.332-.166-1.96-.967-2.264-1.077-.303-.111-.524-.166-.744.166-.22.333-.853 1.077-1.046 1.298-.193.222-.386.25-.717.084-.332-.167-1.401-.517-2.669-1.649-.986-.88-1.653-1.968-1.847-2.3-.193-.333-.02-.513.146-.679.15-.15.332-.389.498-.583.166-.194.221-.333.332-.556.11-.222.055-.417-.028-.583-.083-.166-.744-1.796-1.02-2.46-.269-.646-.542-.558-.744-.568-.193-.01-.414-.012-.635-.012-.221 0-.58.083-.883.417-.303.333-1.157 1.13-1.157 2.76 0 1.629 1.184 3.203 1.35 3.425.166.222 2.33 3.56 5.646 4.99.789.341 1.404.545 1.884.697.792.252 1.512.216 2.082.131.635-.095 1.96-.802 2.236-1.577.276-.775.276-1.44.193-1.578-.083-.14-.303-.222-.635-.389z" />
      </svg>
      {!compact && (
        <span className="hidden sm:inline font-display text-sm font-semibold whitespace-nowrap">WhatsApp</span>
      )}
    </a>
  );
}

// ─── Barra de navegación inferior — mobile ─────────────────────────────────────
// Reemplaza al sidebar en pantallas chicas (celulares). Va en el flujo normal
// del layout (no "fixed"), así el contenido de arriba nunca queda tapado y
// respeta el gesture bar de Android/Samsung (safe-area-inset-bottom).
type NavItem = { key: string; label: string; icon: ReactNode };

function MobileTabBar({
  items,
  active,
  onSelect,
}: {
  items: NavItem[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div
      className="flex md:hidden shrink-0 overflow-x-auto"
      style={{
        borderTop: "1px solid var(--glass-border)",
        background: "var(--glass-bg-strong)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all"
            style={{
              minWidth: 64,
              padding: "8px 4px 7px",
              color: isActive ? "var(--pine)" : "var(--text-faint)",
            }}
          >
            <span
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 30,
                height: 22,
                background: isActive ? "linear-gradient(135deg, var(--pine-pale), var(--lime-pale))" : "transparent",
              }}
            >
              {item.icon}
            </span>
            <span
              className="font-soft text-[9.5px] font-semibold leading-none text-center"
              style={{ maxWidth: 66, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Theme toggle button ──────────────────────────────────────────────────────
function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={dark ? "Modo claro" : "Modo oscuro"}
      className="relative rounded-xl flex items-center justify-center transition-all"
      style={{
        width: 38,
        height: 38,
        background: dark ? "var(--surface-2)" : "var(--surface)",
        border: "1px solid var(--border-strong)",
        color: "var(--pine)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      {dark ? (
        // Sun icon
        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        // Moon icon
        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({
  onConfirm,
  dark,
  toggleDark,
}: {
  onConfirm: (isAdmin: boolean, employee: Employee | null) => void;
  dark: boolean;
  toggleDark: () => void;
}) {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  function handleConfirm() {
    if (!usuario.trim() || !contrasena.trim()) { setError(true); return; }
    setError(false);
    setLoading(true);
    login(usuario.trim(), contrasena.trim())
      .then((data) => {
        setLoading(false);
        onConfirm(data.esAdmin, data.empleado);
      })
      .catch(() => {
        setLoading(false);
        setError(true);
      });
  }

  return (
    <div
      className="size-full flex items-center justify-center relative theme-bg px-4"
      style={{ transition: "background-color 0.4s" }}
    >
      {/* Background texture — blobs grandes y difuminados + grilla de puntos, para dar profundidad real */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{
          backgroundImage: dark
            ? "radial-gradient(ellipse 60% 55% at 78% 12%, rgba(127,190,151,0.28) 0%, transparent 68%), radial-gradient(ellipse 50% 50% at 8% 88%, rgba(166,217,87,0.14) 0%, transparent 70%), radial-gradient(ellipse 45% 45% at 95% 95%, rgba(127,190,151,0.14) 0%, transparent 70%)"
            : "radial-gradient(ellipse 60% 55% at 78% 12%, rgba(58,111,84,0.20) 0%, transparent 68%), radial-gradient(ellipse 50% 50% at 8% 88%, rgba(139,197,63,0.16) 0%, transparent 70%), radial-gradient(ellipse 45% 45% at 95% 95%, rgba(58,111,84,0.10) 0%, transparent 70%)",
        }}
      >
        {/* Blobs sólidos muy desenfocados — profundidad tipo "hero" */}
        <div
          className="absolute rounded-full animate-float"
          style={{ width: 420, height: 420, top: -140, right: -100, background: "var(--pine)", opacity: dark ? 0.16 : 0.10, filter: "blur(90px)" }}
        />
        <div
          className="absolute rounded-full"
          style={{ width: 320, height: 320, bottom: -100, left: -80, background: "var(--lime)", opacity: dark ? 0.12 : 0.09, filter: "blur(80px)", animation: "float 5.5s ease-in-out infinite" }}
        />
        {/* Grilla de puntos — solo visible cerca de los bordes */}
        <div className="dot-grid absolute inset-0" style={{ opacity: dark ? 0.5 : 0.6, maskImage: "radial-gradient(ellipse 70% 70% at 50% 45%, transparent 40%, black 100%)", WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 45%, transparent 40%, black 100%)" }} />
      </div>

      <EcoBubbles dark={dark} />

      {/* Theme toggle top-right */}
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle dark={dark} onToggle={toggleDark} />
      </div>

      {/* Card — vidrio esmerilado con sombra flotante marcada */}
      <div
        className="glass-strong float-card relative w-full max-w-sm rounded-2xl p-6 sm:p-10 animate-fade-up"
        style={{
          boxShadow: dark
            ? "0 28px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(127,190,151,0.1)"
            : "0 20px 56px rgba(38,49,41,0.16), 0 4px 14px rgba(38,49,41,0.07)",
          opacity: 0,
        }}
      >
        {/* Top accent line — degradé pine→lime, más vivo */}
        <div
          className="absolute top-0 left-8 right-8 rounded-b-full"
          style={{ height: 3, background: "linear-gradient(90deg, var(--pine), var(--lime-bright))" }}
        />

        {/* Logo + wordmark */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="animate-float relative mb-4 rounded-full flex items-center justify-center"
            style={{
              width: 96,
              height: 96,
              background: "linear-gradient(160deg, var(--pine-pale), var(--lime-pale))",
              border: "2px solid var(--pine-border)",
              boxShadow: "0 8px 28px var(--pine-border)",
            }}
          >
            {/* Animated ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: "1px solid var(--lime-border)",
                animation: "pulse-ring 2.8s ease-out infinite",
              }}
            />
            <BrandMark size={58} />
          </div>

          {/* Nombre de marca — directo en el logo, ya no como píldora aparte */}
          <h1
            className="text-2xl font-bold text-center leading-tight"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: "var(--pine)",
              letterSpacing: "-0.01em",
            }}
          >
            Parque Ambiental
          </h1>
          <p
            className="font-soft text-[11px] tracking-[0.22em] uppercase mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Sistema de Gestión
          </p>

          <div
            className="rounded-full my-3"
            style={{ width: 34, height: 2, background: "linear-gradient(90deg, var(--pine), var(--lime-bright))" }}
          />

          <h2
            className="text-base font-semibold"
            style={{
              fontFamily: "'Outfit', sans-serif",
              color: "var(--text)",
              letterSpacing: "-0.01em",
            }}
          >
            Iniciar Sesión
          </h2>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-faint)" }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
                <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H3z" />
              </svg>
            </span>
            <input
              className="w-full rounded-xl py-3 pl-9 pr-4 text-sm transition-all"
              placeholder="Número de documento"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-strong)",
                color: "var(--text)",
                fontFamily: "'Inter', sans-serif",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--pine)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--pine-border)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-faint)" }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <input
              className="w-full rounded-xl py-3 pl-9 pr-4 text-sm transition-all"
              placeholder="Número de documento"
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-strong)",
                color: "var(--text)",
                fontFamily: "'Inter', sans-serif",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--pine)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--pine-border)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
        </div>

        <button
          className="w-full mt-5 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all relative overflow-hidden"
          onClick={handleConfirm}
          disabled={loading}
          style={{
            fontFamily: "'Outfit', sans-serif",
            background: "linear-gradient(135deg, var(--pine) 0%, var(--pine-mid) 55%, var(--lime) 100%)",
            color: "#fff",
            border: "none",
            boxShadow: "0 6px 20px var(--pine-border)",
          }}
          onMouseEnter={(e) => {
            if (!loading)
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 10px 28px rgba(139,197,63,0.35)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 6px 20px var(--pine-border)";
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                style={{ width: 15, height: 15 }}
              >
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                <path
                  d="M12 2a10 10 0 0110 10"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Verificando...
            </span>
          ) : (
            "Confirmar"
          )}
        </button>

        {error && (
          <p className="text-center text-xs mt-3 animate-fade-up" style={{ color: "var(--red)", opacity: 0 }}>
            Ingresá usuario y contraseña para continuar.
          </p>
        )}

        {/* Sección 4 (Parte 2), reubicado acá por la corrección del punto 1.
            Variante activa: #1. Para cambiarla, reemplazar el texto de abajo por
            una de estas otras dos opciones:
            #2: "Usá tu número de documento como usuario y contraseña. Vas a ver
                 distintas herramientas según tu rol en el parque: Empleado,
                 Encargado o Admin."
            #3: "El acceso es con tu número de documento (mismo dato para usuario y
                 contraseña). Cada cargo —Empleado, Encargado o Admin— tiene su
                 propio panel de funciones." */}
        <p className="text-center text-xs mt-3 leading-relaxed" style={{ color: "var(--text-faint)" }}>
          Ingresá con tu número de documento. Las funciones disponibles se adaptan automáticamente a tu cargo: Empleado, Encargado o Admin.
        </p>
      </div>
    </div>
  );
}

// ─── Notification data ─────────────────────────────────────────────────────────
type AreaKey = "plantines" | "nativos" | "hidroponia";

const AREA_LABELS: Record<AreaKey, string> = {
  plantines:  "Prod. de Plantines para la Huerta",
  nativos:    "Prod. de Árboles Nativos",
  hidroponia: "Hidroponía",
};

interface Notif {
  id: number;
  level: NotifLevel; // color "clásico" — se mantiene por compatibilidad con el Dashboard Global (Parte 2)
  estado: NotifEstado; // Asignada / En proceso / Solucionada — fuente de verdad de esta sección (Parte 1)
  urgente: boolean; // separa "urgente" (rojo) de "asignada normal" (naranja)
  alcance?: NotifAlcance; // "area" | "empleados" | "general"
  text: string;
  description?: string;
  time: string;
  area: AreaKey | null; // null cuando alcance === "general"
  empleadoId?: number | null;
  empleadoNombre?: string | null;
  emitidoPor?: string | null;
  hidden?: boolean; // feature del Dashboard Global (Parte 2)
  eliminado?: boolean; // papelera (Parte 1, solo Admin)
  sensor?: boolean;
  creadoEn?: string; // timestamp crudo (ISO) — corrección punto 6, rango de fechas real
}

interface Llamado {
  id: number;
  empleadoId?: number;
  empleadoNombre: string;
  empleadoRol?: "Empleado" | "Encargado" | "Admin";
  area: AreaKey;
  mensaje?: string;
  estado: LlamadoEstado; // Asignada / En proceso / Solucionada — mismo esquema que las notificaciones
  destino: LlamadoDestino; // "encargado" (puntual) | "admin"
  destinoEmpleadoId?: number | null;
  destinoNombre?: string; // nombre del Encargado puntual, o "Admin"
  atendido: boolean; // se mantiene sincronizado con estado === "solucionada"
  eliminado?: boolean; // papelera (corrección punto 3, solo Admin desde el Dashboard Global)
  time: string;
  creadoEn?: string; // timestamp crudo (ISO) — corrección punto 6, rango de fechas real
}

const ALL_NOTIFS: Notif[] = [
  { id:  1, level: "red",    estado: "asignada",    urgente: true,  area: "plantines",  text: "Solicitud Urgente — Riego fallido en sector de plantines",       time: "Hace 5 min" },
  { id:  2, level: "red",    estado: "asignada",    urgente: true,  area: "nativos",     text: "Solicitud Urgente — Acceso no autorizado al vivero",             time: "Hace 18 min" },
  { id:  3, level: "red",    estado: "asignada",    urgente: true,  area: "hidroponia",  text: "Solicitud Urgente — Falla en bomba de circulación",              time: "Hace 22 min" },
  { id:  4, level: "yellow", estado: "en_proceso",  urgente: false, area: "nativos",     text: "Solicitud en Proceso — Relevamiento de espécies nativas",       time: "Hace 40 min" },
  { id:  5, level: "yellow", estado: "en_proceso",  urgente: false, area: "hidroponia",  text: "Solicitud en Proceso — Revisión del sistema hidropónico",       time: "Hace 1 hora" },
  { id:  6, level: "yellow", estado: "en_proceso",  urgente: false, area: "plantines",   text: "Solicitud en Proceso — Reposición de sustrato en bandejas",     time: "Hace 1.5 horas" },
  { id:  7, level: "green",  estado: "solucionada", urgente: false, area: "plantines",   text: "Solicitud Solucionada — Plantación de álamos completada",       time: "Hace 2 horas" },
  { id:  8, level: "green",  estado: "solucionada", urgente: false, area: "nativos",     text: "Solicitud Solucionada — Mantenimiento de sustrato aprobado",    time: "Hace 3 horas" },
  { id:  9, level: "green",  estado: "solucionada", urgente: false, area: "hidroponia",  text: "Solicitud Solucionada — Reposición de semillas procesada",      time: "Ayer" },
  { id: 10, level: "green",  estado: "solucionada", urgente: false, area: "plantines",   text: "Solicitud Solucionada — Fumigación preventiva completada",      time: "Ayer" },
];

// Notifs shown in the employee's own notification center (subset)
const INITIAL_NOTIFS = ALL_NOTIFS.slice(0, 7);

// ─── Notification card ─────────────────────────────────────────────────────────
// `role` presente ⇒ modo Parte 1 (Centro de Notificaciones: máquina de estados,
// menú según rol). `role` ausente ⇒ modo legacy del Dashboard Global (Parte 2):
// se comporta exactamente igual que antes (ocultar/mostrar/marcar completada).
function NotifCard({
  notif,
  role,
  onHide,
  onComplete,
  onShow,
  onAdvance,
  onSetEstado,
  onDelete,
  onRestore,
  inTrash = false,
  showArea = false,
  showEmpleado = false,
  readOnly = false,
  staggerDelay = 0,
}: {
  notif: Notif;
  role?: "Empleado" | "Encargado" | "Admin";
  onHide?: (id: number) => void;
  onComplete?: (id: number) => void;
  onShow?: (id: number) => void;
  onAdvance?: (id: number) => void;
  onSetEstado?: (id: number, estado: NotifEstado) => void;
  onDelete?: (id: number) => void;
  onRestore?: (id: number) => void;
  inTrash?: boolean;
  showArea?: boolean;
  showEmpleado?: boolean;
  readOnly?: boolean; // Dashboard Global (sección 1, Parte 2): solo lectura salvo Admin
  staggerDelay?: number; // segundos — animación de entrada escalonada (ver nota de bugfix más abajo)
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Único lugar (junto con colorDeNotificacion en api.ts) donde se mapean los
  // 4 estados visuales a su color — sección 7 de la Parte 1.
  const styles: Record<NotifColor, { text: string; dot: string; bg: string; border: string; menuColor: string; menuBg: string; menuBorder: string }> = {
    red:    { text: "var(--red)",    dot: "var(--red)",    bg: "var(--red-pale)",    border: "var(--red-border)",    menuColor: "var(--red)",    menuBg: "var(--red-pale)",    menuBorder: "var(--red-border)" },
    orange: { text: "var(--orange, #f97316)", dot: "var(--orange, #f97316)", bg: "var(--orange-pale, rgba(249,115,22,0.12))", border: "var(--orange-border, rgba(249,115,22,0.32))", menuColor: "var(--orange, #f97316)", menuBg: "var(--orange-pale, rgba(249,115,22,0.12))", menuBorder: "var(--orange-border, rgba(249,115,22,0.32))" },
    yellow: { text: "var(--yellow)", dot: "var(--yellow)", bg: "var(--yellow-pale)", border: "var(--yellow-border)", menuColor: "var(--yellow)", menuBg: "var(--yellow-pale)", menuBorder: "var(--yellow-border)" },
    green:  { text: "var(--pine)",   dot: "var(--pine)",   bg: "var(--pine-pale)",   border: "var(--pine-border)",   menuColor: "var(--pine)",   menuBg: "var(--pine-pale)",   menuBorder: "var(--pine-border)" },
  };
  const color = colorDeNotificacion(notif.estado, notif.urgente);
  const s = styles[color];

  const legacyMenuItems: { label: string; action: () => void; danger?: boolean }[] = onShow
    ? [{ label: "Restaurar notificación", action: () => onShow(notif.id) }]
    : notif.level === "green"
      ? [
          { label: "Ocultar notificación", action: () => onHide?.(notif.id) },
          { label: "Marcar como leída",    action: () => {} },
        ]
      : [
          { label: "Marcar como completada", action: () => onComplete?.(notif.id) },
          { label: "Ocultar notificación",   action: () => onHide?.(notif.id) },
        ];

  // ── Menú nuevo (Parte 1): depende del rol y del estado actual ──────────────
  let menuItems: { label: string; action: () => void; danger?: boolean }[] = [];
  if (readOnly) {
    menuItems = [];
  } else if (role) {
    if (inTrash || notif.eliminado) {
      menuItems = [{ label: "Restaurar notificación", action: () => onRestore?.(notif.id) }];
    } else if (role === "Admin") {
      if (notif.estado !== "asignada") {
        menuItems.push({ label: "Volver a Asignada", action: () => onSetEstado?.(notif.id, "asignada") });
      }
      if (notif.estado !== "en_proceso") {
        menuItems.push({ label: "Pasar a En proceso", action: () => onSetEstado?.(notif.id, "en_proceso") });
      }
      if (notif.estado !== "solucionada") {
        menuItems.push({ label: "Marcar como Solucionada", action: () => onSetEstado?.(notif.id, "solucionada") });
      }
      menuItems.push({ label: "Eliminar notificación", action: () => onDelete?.(notif.id), danger: true });
    } else if (notif.estado === "asignada") {
      menuItems = [{ label: "Pasar a En proceso", action: () => onAdvance?.(notif.id) }];
    } else if (notif.estado === "en_proceso") {
      menuItems = [{ label: "Marcar como Solucionada", action: () => onAdvance?.(notif.id) }];
    }
    // estado === "solucionada" y rol no-Admin: sin menú, de solo lectura.
  } else {
    menuItems = legacyMenuItems;
  }

  return (
    <>
    <div
      className="notification-card notif-glass animate-slide-in relative rounded-2xl px-4 py-3 flex items-start gap-3 transition-smooth cursor-pointer"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderLeft: `3px solid ${s.dot}`,
        animationDelay: `${staggerDelay}s`,
        opacity: 0,
        // Bugfix: mientras el menú de 3 puntitos está abierto, esta tarjeta tiene
        // que quedar por ENCIMA de la siguiente (si no, el dropdown que sobresale
        // por abajo queda tapado por la tarjeta de abajo y no se puede clickear).
        zIndex: menuOpen ? 30 : undefined,
      }}
      onClick={() => setDetailOpen(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") setDetailOpen(true); }}
    >
      <span
        className="shrink-0 rounded-full mt-1.5 animate-glow"
        style={{ width: 9, height: 9, background: s.dot, display: "inline-block", "--glow-color": s.border } as CSSProperties}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {showArea && notif.area && (
            <span
              className="font-display inline-block font-semibold mb-0.5 px-1.5 py-0.5 rounded"
              style={{
                color: s.menuColor,
                background: s.menuBg,
                border: `1px solid ${s.menuBorder}`,
                fontSize: 9,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {AREA_LABELS[notif.area]}
            </span>
          )}
          {showArea && !notif.area && (
            <span
              className="font-display inline-block font-semibold mb-0.5 px-1.5 py-0.5 rounded"
              style={{
                color: "var(--text-muted)",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                fontSize: 9,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              General
            </span>
          )}
          {showEmpleado && notif.empleadoNombre && (
            <span
              className="font-display inline-block font-semibold mb-0.5 px-1.5 py-0.5 rounded"
              style={{
                color: "var(--text-muted)",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                fontSize: 9,
                letterSpacing: "0.03em",
              }}
            >
              Para: {notif.empleadoNombre}
            </span>
          )}
        </div>
        <p
          className="text-sm font-medium truncate"
          style={{
            color: s.text,
            fontFamily: "'Outfit', sans-serif",
            textDecoration: notif.estado === "en_proceso" ? "none" : "none",
            fontStyle: notif.estado === "en_proceso" ? "italic" : "normal",
          }}
        >
          {notif.text}
        </p>
        {notif.description && (
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
            {notif.description}
          </p>
        )}
        <p className="font-display text-xs mt-0.5 tracking-wide" style={{ color: "var(--text-faint)" }}>
          {notif.time}
          {notif.emitidoPor ? ` · Emitida por ${notif.emitidoPor}` : ""}
        </p>
      </div>

      {/* 3-dot menu — solo si hay algo para hacer (no aparece en "Solucionada" para Empleado/Encargado) */}
      {menuItems.length > 0 && (
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all mt-0.5"
            style={{
              color: s.menuColor,
              background: s.menuBg,
              border: `1px solid ${s.menuBorder}`,
            }}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 11, height: 11 }}>
              <circle cx="8" cy="3" r="1.4" />
              <circle cx="8" cy="8" r="1.4" />
              <circle cx="8" cy="13" r="1.4" />
            </svg>
            <svg
              viewBox="0 0 10 6"
              fill="currentColor"
              style={{
                width: 7,
                height: 7,
                transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            >
              <path d="M0 0l5 6 5-6H0z" />
            </svg>
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-50 animate-fade-up"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-strong)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                minWidth: 180,
              }}
            >
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  className="w-full text-left px-4 py-2.5 text-xs transition-colors"
                  style={{ color: item.danger ? "var(--red)" : "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                  }
                  onClick={() => { item.action(); setMenuOpen(false); }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>

    {/* ── Modal de detalle — se abre al tocar la tarjeta, muestra el texto completo sin recortar ── */}
    {detailOpen && (
      <div
        className="fixed inset-0 flex items-center justify-center z-50 px-4"
        style={{ background: "rgba(0,0,0,0.45)" }}
        onClick={() => setDetailOpen(false)}
      >
        <div
          className="float-card aero-sheen rounded-2xl p-6 w-full max-w-md animate-fade-scale"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "85vh", overflowY: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado con color de estado + badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span
              className="shrink-0 rounded-full"
              style={{ width: 10, height: 10, background: s.dot, display: "inline-block" }}
            />
            {showArea && (
              <span
                className="font-display inline-block font-semibold px-1.5 py-0.5 rounded"
                style={{
                  color: s.menuColor,
                  background: s.menuBg,
                  border: `1px solid ${s.menuBorder}`,
                  fontSize: 9,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {notif.area ? AREA_LABELS[notif.area] : "General"}
              </span>
            )}
            {showEmpleado && notif.empleadoNombre && (
              <span
                className="font-display inline-block font-semibold px-1.5 py-0.5 rounded"
                style={{ color: "var(--text-muted)", background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 9 }}
              >
                Para: {notif.empleadoNombre}
              </span>
            )}
            <span
              className="font-display inline-block font-semibold px-1.5 py-0.5 rounded ml-auto"
              style={{ color: s.menuColor, background: s.menuBg, border: `1px solid ${s.menuBorder}`, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              {notif.estado === "asignada" ? "Asignada" : notif.estado === "en_proceso" ? "En proceso" : notif.estado === "solucionada" ? "Solucionada" : notif.level === "green" ? "Resuelta" : "Pendiente"}
            </span>
          </div>

          {/* Texto completo, sin truncar */}
          <h3
            className="text-base font-bold leading-snug mb-2"
            style={{ color: s.text, fontFamily: "'Outfit', sans-serif" }}
          >
            {notif.text}
          </h3>
          {notif.description && (
            <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
              {notif.description}
            </p>
          )}

          <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />

          <p className="font-display text-xs tracking-wide" style={{ color: "var(--text-faint)" }}>
            {notif.time}
            {notif.emitidoPor ? ` · Emitida por ${notif.emitidoPor}` : ""}
          </p>

          <div className="flex justify-end mt-5">
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text-muted)" }}
              onClick={() => setDetailOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ─── Collapsible group ─────────────────────────────────────────────────────────
function NotifGroup({
  title,
  count,
  color,
  dot,
  items,
  role,
  onHide,
  onComplete,
  onShow,
  onAdvance,
  onSetEstado,
  onDelete,
  onRestore,
  inTrash = false,
  collapsible = false,
  showArea = false,
  showEmpleado = false,
  readOnly = false,
}: {
  title: string;
  count: number;
  color: string;
  dot: string;
  items: Notif[];
  role?: "Empleado" | "Encargado" | "Admin";
  onHide?: (id: number) => void;
  onComplete?: (id: number) => void;
  onShow?: (id: number) => void;
  onAdvance?: (id: number) => void;
  onSetEstado?: (id: number, estado: NotifEstado) => void;
  onDelete?: (id: number) => void;
  onRestore?: (id: number) => void;
  inTrash?: boolean;
  collapsible?: boolean;
  showArea?: boolean;
  showEmpleado?: boolean;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <div
        className={`flex items-center gap-2 mb-2 ${collapsible ? "cursor-pointer select-none" : ""}`}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: dot, display: "inline-block" }} />
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "'Outfit', sans-serif", color }}>
          {title} · {count}
        </span>
        {collapsible && (
          <button
            className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all"
            style={{ color: "var(--pine)", background: "var(--pine-pale)", border: "1px solid var(--pine-border)", fontFamily: "'Outfit', sans-serif" }}
          >
            {open ? "Plegar" : "Desplegar"}
            <svg viewBox="0 0 10 6" fill="currentColor" style={{ width: 8, height: 8, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}>
              <path d="M0 0l5 6 5-6H0z" />
            </svg>
          </button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-2 animate-collapse">
          {items.map((n, i) => (
            <NotifCard
              key={n.id}
              notif={n}
              role={role}
              onHide={onHide}
              onComplete={onComplete}
              onShow={onShow}
              onAdvance={onAdvance}
              onSetEstado={onSetEstado}
              onDelete={onDelete}
              onRestore={onRestore}
              inTrash={inTrash}
              showArea={showArea}
              showEmpleado={showEmpleado}
              readOnly={readOnly}
              staggerDelay={i * 0.04}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────
const AREAS = [
  "Producción de Plantines para la Huerta",
  "Producción de Árboles Nativos",
  "Hidroponía",
];

// ─── Sensor data generation ────────────────────────────────────────────────────
const SENSORS = [
  { key: "humedad",         label: "Humedad",                    color: "#a78bfa" },
  { key: "luz",             label: "Luz",                        color: "#fbbf24" },
  { key: "tempAmbiente",    label: "Temperatura Ambiente",       color: "#f97316" },
  { key: "tempEmergencia",  label: "Temperatura de Emergencia",  color: "#ef4444" },
] as const;

type SensorKey = typeof SENSORS[number]["key"];

const TIME_RANGES = [
  { key: "live",  label: "Tiempo Real", points: 0 },
  { key: "day",   label: "Hoy",    points: 24 },
  { key: "3days", label: "3 Días", points: 36 },
  { key: "week",  label: "Semana", points: 42 },
  { key: "month", label: "Mes",    points: 30 },
] as const;

type TimeKey = typeof TIME_RANGES[number]["key"];

// Mapeo de sensor_id (tabla `sensores` / payload del ESP32) a las claves que usa el gráfico.
// 1 = Sensor Luz (LDR) | 2 = DHT11 Temp | 3 = DHT11 Humedad | 4 = KY-028 Temp Roja (emergencia)
const SENSOR_ID_TO_KEY: Record<number, SensorKey> = {
  1: "luz",
  2: "tempAmbiente",
  3: "humedad",
  4: "tempEmergencia",
};

const RANGE_MS: Record<TimeKey, number> = {
  live: 5 * 60 * 1000, // ventana de "Tiempo Real": últimos 5 minutos, sin promediar
  day: 24 * 60 * 60 * 1000,
  "3days": 3 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

// Agrupa las lecturas reales (una fila por sensor cada ~2s) en "cfg.points" baldes
// y promedia los valores de cada sensor dentro de cada balde, para que el gráfico
// no intente dibujar miles de puntos sueltos.
function bucketLecturas(rows: LecturaSensor[], timeKey: TimeKey) {
  const cfg = TIME_RANGES.find((t) => t.key === timeKey)!;
  const now = new Date();
  const rangeMs = RANGE_MS[timeKey];
  const start = now.getTime() - rangeMs;
  const bucketMs = rangeMs / cfg.points;

  const buckets = Array.from({ length: cfg.points }, (_, i) => {
    const bucketTime = new Date(start + i * bucketMs);
    let label = "";
    if (timeKey === "day") {
      label = bucketTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    } else if (timeKey === "3days") {
      label = `${bucketTime.getDate()}/${bucketTime.getMonth() + 1} ${bucketTime.getHours()}h`;
    } else if (timeKey === "week") {
      label = bucketTime.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" });
    } else {
      label = bucketTime.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
    }
    return {
      label,
      sums: { humedad: 0, luz: 0, tempAmbiente: 0, tempEmergencia: 0 } as Record<SensorKey, number>,
      counts: { humedad: 0, luz: 0, tempAmbiente: 0, tempEmergencia: 0 } as Record<SensorKey, number>,
    };
  });

  for (const row of rows) {
    const key = SENSOR_ID_TO_KEY[row.sensor_id];
    if (!key) continue;
    const t = new Date(row.creado_en).getTime();
    if (Number.isNaN(t) || t < start) continue;
    let idx = Math.floor((t - start) / bucketMs);
    idx = Math.min(Math.max(idx, 0), cfg.points - 1);
    buckets[idx].sums[key] += Number(row.valor);
    buckets[idx].counts[key] += 1;
  }

  return buckets.map((b) => ({
    label: b.label,
    humedad: b.counts.humedad ? +(b.sums.humedad / b.counts.humedad).toFixed(1) : null,
    luz: b.counts.luz ? +(b.sums.luz / b.counts.luz).toFixed(1) : null,
    tempAmbiente: b.counts.tempAmbiente ? +(b.sums.tempAmbiente / b.counts.tempAmbiente).toFixed(1) : null,
    tempEmergencia: b.counts.tempEmergencia ? +(b.sums.tempEmergencia / b.counts.tempEmergencia).toFixed(1) : null,
  }));
}

// Vista "Tiempo Real": toma las lecturas crudas de los últimos `windowMs` SIN promediar,
// una por cada tanda que manda el ESP32 (mismo creado_en para los 4 sensores), para que
// el gráfico se mueva en vivo mientras se manipula el hardware en la presentación.
function buildLiveData(rows: LecturaSensor[], windowMs: number) {
  const now = Date.now();
  const filtered = rows
    .filter((r) => now - new Date(r.creado_en).getTime() <= windowMs)
    .sort((a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime());

  const porTanda = new Map<
    string,
    { label: string; humedad: number | null; luz: number | null; tempAmbiente: number | null; tempEmergencia: number | null }
  >();

  for (const row of filtered) {
    const key = SENSOR_ID_TO_KEY[row.sensor_id];
    if (!key) continue;
    const iso = row.creado_en;
    if (!porTanda.has(iso)) {
      porTanda.set(iso, {
        label: new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        humedad: null,
        luz: null,
        tempAmbiente: null,
        tempEmergencia: null,
      });
    }
    porTanda.get(iso)![key] = Number(row.valor);
  }

  return Array.from(porTanda.values());
}

// ─── Custom dropdown (shared) ──────────────────────────────────────────────────
function DropdownButton({
  label,
  open,
  onToggle,
  children,
}: {
  label: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onToggle]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        style={{
          fontFamily: "'Outfit', sans-serif",
          background: open ? "var(--pine-pale)" : "var(--surface)",
          border: open ? "1px solid var(--pine-border)" : "1px solid var(--border-strong)",
          color: open ? "var(--pine)" : "var(--text)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        {label}
        <svg
          viewBox="0 0 10 6"
          fill="currentColor"
          style={{
            width: 9,
            height: 9,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            color: "var(--pine)",
          }}
        >
          <path d="M0 0l5 6 5-6H0z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 rounded-xl overflow-hidden z-50 animate-fade-up"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
            minWidth: 240,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Stats page ────────────────────────────────────────────────────────────────
function StatsPage({ dark }: { dark: boolean }) {
  const [selectedSensors, setSelectedSensors] = useState<SensorKey[]>(["humedad", "luz"]);
  const [timeRange, setTimeRange] = useState<TimeKey>("week");
  const [sensorsOpen, setSensorsOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [lecturas, setLecturas] = useState<LecturaSensor[]>([]);
  const [cargando, setCargando] = useState(true);

  const isLive = timeRange === "live";

  // Trae las lecturas reales que manda el ESP32. En modo "Tiempo Real" se piden cada 2s
  // (mismo ritmo que reporta el ESP32) y solo la ventana reciente, para que el gráfico
  // se mueva en vivo al manipular el hardware. En los demás rangos, cada 10s.
  useEffect(() => {
    let activo = true;
    const cargar = () => {
      const desde = isLive ? new Date(Date.now() - RANGE_MS.live).toISOString() : undefined;
      fetchLecturas(desde)
        .then((rows) => { if (activo) setLecturas(rows); })
        .catch((err) => console.error("No se pudieron traer las lecturas de los sensores:", err))
        .finally(() => { if (activo) setCargando(false); });
    };
    cargar();
    const interval = setInterval(cargar, isLive ? 2000 : 10000);
    return () => { activo = false; clearInterval(interval); };
  }, [isLive]);

  const data = isLive ? buildLiveData(lecturas, RANGE_MS.live) : bucketLecturas(lecturas, timeRange);
  const sinDatos = !cargando && lecturas.length === 0;

  function toggleSensor(key: SensorKey) {
    setSelectedSensors((prev) =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter((k) => k !== key) : prev
        : [...prev, key]
    );
  }

  const activeCfg = TIME_RANGES.find((t) => t.key === timeRange)!;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Controls bar */}
      <div
        className="flex items-center flex-wrap gap-3 px-4 sm:px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {/* Sensors dropdown */}
        <DropdownButton
          label={
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 13, height: 13, color: "var(--pine)" }}>
                <circle cx="4" cy="4" r="2" /><circle cx="4" cy="12" r="2" />
                <circle cx="12" cy="8" r="2" />
                <line x1="6" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" />
                <line x1="6" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.5" />
                <line x1="1" y1="8" x2="10" y2="8" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Sensores
              <span
                className="rounded-full px-1.5 py-0.5 text-xs font-bold"
                style={{ background: "var(--pine-pale)", color: "var(--pine)", fontSize: 10 }}
              >
                {selectedSensors.length}
              </span>
            </span>
          }
          open={sensorsOpen}
          onToggle={() => { setSensorsOpen((v) => !v); setTimeOpen(false); }}
        >
          <div className="p-2">
            {SENSORS.map((sensor) => {
              const checked = selectedSensors.includes(sensor.key);
              return (
                <button
                  key={sensor.key}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all"
                  style={{
                    background: checked ? "var(--pine-pale)" : "transparent",
                    border: "1px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!checked)
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (!checked)
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                  onClick={() => toggleSensor(sensor.key)}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="rounded-full shrink-0"
                      style={{ width: 9, height: 9, background: sensor.color, display: "inline-block" }}
                    />
                    <span
                      className="text-sm font-medium"
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        color: checked ? "var(--pine)" : "var(--text)",
                      }}
                    >
                      {sensor.label}
                    </span>
                  </div>
                  {/* Checkbox */}
                  <div
                    className="rounded flex items-center justify-center shrink-0"
                    style={{
                      width: 18,
                      height: 18,
                      background: checked ? "var(--pine)" : "var(--surface-2)",
                      border: checked ? "none" : "1.5px solid var(--border-strong)",
                      transition: "all 0.15s",
                    }}
                  >
                    {checked && (
                      <svg viewBox="0 0 12 10" fill="none" style={{ width: 10, height: 10 }}>
                        <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </DropdownButton>

        {/* Time range dropdown */}
        <DropdownButton
          label={
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 16 16" fill="none" stroke="var(--pine)" strokeWidth="1.5" style={{ width: 13, height: 13 }}>
                <circle cx="8" cy="8" r="6" />
                <path d="M8 4.5V8l2.5 2" strokeLinecap="round" />
              </svg>
              {activeCfg.label}
            </span>
          }
          open={timeOpen}
          onToggle={() => { setTimeOpen((v) => !v); setSensorsOpen(false); }}
        >
          {TIME_RANGES.map((t) => (
            <button
              key={t.key}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-all"
              style={{
                fontFamily: "'Outfit', sans-serif",
                background: timeRange === t.key ? "var(--pine-pale)" : "transparent",
                color: timeRange === t.key ? "var(--pine)" : "var(--text-muted)",
                fontWeight: timeRange === t.key ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (timeRange !== t.key)
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
              }}
              onMouseLeave={(e) => {
                if (timeRange !== t.key)
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
              onClick={() => { setTimeRange(t.key); setTimeOpen(false); }}
            >
              {t.label}
              {timeRange === t.key && (
                <svg viewBox="0 0 12 10" fill="none" style={{ width: 12, height: 12 }}>
                  <path d="M1 5l3.5 3.5L11 1" stroke="var(--pine)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </DropdownButton>

        {/* Indicador de tiempo real */}
        {isLive && (
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              background: "var(--red-pale, rgba(239,68,68,0.12))",
              border: "1px solid var(--red-border, rgba(239,68,68,0.3))",
              color: "var(--red, #ef4444)",
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            <span
              className="rounded-full"
              style={{ width: 7, height: 7, background: "var(--red, #ef4444)", display: "inline-block", animation: "pulse-ring 1.4s ease-out infinite" }}
            />
            EN VIVO
          </span>
        )}

        {/* Active sensor badges — en mobile pasan a grid 2x2 (o wrap prolijo) en vez
            de amontonarse en una sola fila cuando hay 4 sensores activos */}
        <div className="pa-sensor-badges">
          {selectedSensors.map((key) => {
            const s = SENSORS.find((s) => s.key === key)!;
            return (
              <span
                key={key}
                className="pa-sensor-badge flex items-center justify-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  background: `${s.color}18`,
                  border: `1px solid ${s.color}40`,
                  color: s.color,
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: s.color, display: "inline-block" }} />
                {s.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* KPI chips — último valor por sensor, en serif orgánica para contraste real con el resto de la UI.
          En mobile pasan a grid 2x2 (soporta 4 sensores sin achicarse); en desktop siguen
          en fila con wrap y ancho mínimo fijo. */}
      <div className="pa-kpi-chips px-4 sm:px-6 pt-4">
        {SENSORS.filter((s) => selectedSensors.includes(s.key)).map((s) => {
          const rows = lecturas.filter((r) => SENSOR_ID_TO_KEY[r.sensor_id] === s.key);
          const last = rows[rows.length - 1];
          const val = last ? Number(last.valor) : null;
          return (
            <div
              key={s.key}
              className="pa-kpi-chip float-card aero-sheen rounded-2xl px-5 py-3 flex flex-col"
              style={{ background: "var(--surface)", border: `1px solid ${s.color}33` }}
            >
              <span className="font-display text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-faint)" }}>
                {s.label}
              </span>
              <span className="font-organic text-3xl font-semibold" style={{ color: s.color, lineHeight: 1.15 }}>
                {val !== null ? val.toFixed(1) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Chart area */}
      <div className="flex-1 px-4 sm:px-6 py-5 overflow-hidden">
        <div
          className="float-card h-full rounded-2xl p-5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          {sinDatos && (
            <p className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>
              Todavía no hay lecturas registradas en este rango. Verificá que el ESP32 esté prendido, conectado al WiFi y que el backend esté corriendo.
            </p>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid
                strokeDasharray="4 4"
                stroke={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--text-faint)", fontFamily: "'Inter', sans-serif" }}
                axisLine={{ stroke: "var(--border-strong)" }}
                tickLine={false}
                interval={Math.floor(data.length / 7)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text-faint)", fontFamily: "'Inter', sans-serif" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 12,
                  color: "var(--text)",
                }}
                labelStyle={{ color: "var(--text-muted)", marginBottom: 4, fontSize: 11 }}
                cursor={{ stroke: "var(--pine-border)", strokeWidth: 1 }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: 12,
                  fontFamily: "'Outfit', sans-serif",
                  color: "var(--text-muted)",
                  paddingTop: 12,
                }}
              />
              {SENSORS.filter((s) => selectedSensors.includes(s.key)).map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Employee & Area data ──────────────────────────────────────────────────────
interface Employee {
  id: number;
  name: string;
  lastName?: string;
  areas: AreaKey[];
  role: "Empleado" | "Encargado" | "Admin";
  schedule: string;
  days?: string;
  documentId?: string;
  contact?: string;
  address?: string;
  birthDate?: string;
  photo?: string;
}

interface AreaDef {
  id?: number;
  key: AreaKey;
  label: string;
  fullLabel: string;
  sensors: string[];
  employeeIds: number[];
}

const INITIAL_EMPLOYEES: Employee[] = [
  { id: 1, name: "Carlos Rodríguez",  areas: ["plantines", "nativos", "hidroponia"], role: "Admin",     schedule: "Lun–Vie 08:00–17:00" },
  { id: 2, name: "Lucía Fernández",   areas: ["plantines"],                           role: "Encargado", schedule: "Lun–Vie 07:00–15:00" },
  { id: 3, name: "Martín Gómez",      areas: ["nativos"],                             role: "Empleado",  schedule: "Mar–Sáb 09:00–17:00" },
  { id: 4, name: "Ana Ibáñez",        areas: ["hidroponia"],                          role: "Empleado",  schedule: "Lun–Vie 08:00–16:00" },
  { id: 5, name: "Jorge Peralta",     areas: ["plantines", "nativos"],               role: "Empleado",  schedule: "Lun–Jue 07:00–15:00" },
  { id: 6, name: "Valentina Torres",  areas: ["hidroponia", "plantines"],            role: "Empleado",  schedule: "Mié–Dom 10:00–18:00" },
];

const INITIAL_AREAS: AreaDef[] = [
  {
    key: "plantines",
    label: "Plantines",
    fullLabel: "Producción de Plantines para la Huerta",
    sensors: ["Nivel del Agua", "Humedad del Suelo", "Temperatura y Humedad"],
    employeeIds: [1, 2, 5, 6],
  },
  {
    key: "nativos",
    label: "Árboles Nativos",
    fullLabel: "Producción de Árboles Nativos",
    sensors: ["Humedad del Suelo", "Aire", "Luz"],
    employeeIds: [1, 3, 5],
  },
  {
    key: "hidroponia",
    label: "Hidroponía",
    fullLabel: "Hidroponía",
    sensors: ["Nivel del Agua", "Luz", "Temperatura y Humedad"],
    employeeIds: [1, 4, 6],
  },
];

// ─── Shared small components ───────────────────────────────────────────────────
function UserAvatar({ name, size = 52 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold"
      style={{
        width: size,
        height: size,
        background: "var(--pine-pale)",
        border: "2px solid var(--pine-border)",
        color: "var(--pine)",
        fontSize: size * 0.32,
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: Employee["role"] }) {
  const colors: Record<Employee["role"], string> = {
    Admin:     "var(--pine)",
    Encargado: "var(--yellow)",
    Empleado:  "var(--text-muted)",
  };
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        color: colors[role],
        background: `${colors[role]}18`,
        border: `1px solid ${colors[role]}30`,
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {role}
    </span>
  );
}

// ─── Empleados Page ────────────────────────────────────────────────────────────
function EmpleadosPage({ isAdmin }: { isAdmin: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [mode, setMode] = useState<"view" | "add-remove" | "edit-areas">("view");

  // Trae los empleados reales desde la base de datos al abrir la página
  useEffect(() => {
    fetchEmpleados()
      .then((data) => setEmployees(data))
      .catch((err) => console.error("No se pudieron cargar los empleados:", err));
  }, []);

  // Draft state for edit-areas mode
  const [draftAreas, setDraftAreas] = useState<Record<number, AreaKey[]>>({});

  // Estado del formulario tipo planilla (null = cerrado, "new" = alta, Employee = edición)
  const [formEmployee, setFormEmployee] = useState<Employee | "new" | null>(null);

  function saveEmployeeForm(data: EmpleadoForm, editingId?: number) {
    if (editingId) {
      actualizarEmpleado(editingId, data)
        .then(() => {
          setEmployees((prev) =>
            prev.map((e) =>
              e.id === editingId
                ? {
                    ...e,
                    name: data.nombre,
                    lastName: data.apellido,
                    role: data.rol as Employee["role"],
                    schedule: data.horario,
                    days: data.dias,
                    documentId: data.documento,
                    contact: data.contacto,
                    address: data.direccion,
                    birthDate: data.fecha_nacimiento,
                  }
                : e
            )
          );
          setFormEmployee(null);
        })
        .catch((err) => console.error("No se pudo actualizar el empleado:", err));
    } else {
      crearEmpleado(data)
        .then((nuevo) => {
          setEmployees((prev) => [
            {
              id: nuevo.id,
              name: data.nombre,
              lastName: data.apellido,
              areas: [],
              role: data.rol as Employee["role"],
              schedule: data.horario,
              days: data.dias,
              documentId: data.documento,
              contact: data.contacto,
              address: data.direccion,
              birthDate: data.fecha_nacimiento,
            },
            ...prev,
          ]);
          setFormEmployee(null);
        })
        .catch((err) => console.error("No se pudo crear el empleado:", err));
    }
  }

  function startAddRemove() {
    setMode("add-remove");
  }

  function startEditAreas() {
    const draft: Record<number, AreaKey[]> = {};
    employees.forEach((e) => { draft[e.id] = [...e.areas]; });
    setDraftAreas(draft);
    setMode("edit-areas");
  }

  function removeEmployee(id: number) {
    eliminarEmpleado(id)
      .then(() => {
        setEmployees((prev) => prev.filter((e) => e.id !== id));
      })
      .catch((err) => console.error("No se pudo eliminar el empleado:", err));
  }

  function toggleArea(empId: number, area: AreaKey) {
    setDraftAreas((prev) => {
      const cur = prev[empId] ?? [];
      return {
        ...prev,
        [empId]: cur.includes(area) ? cur.filter((a) => a !== area) : [...cur, area],
      };
    });
  }

  function finalize() {
    if (mode === "edit-areas") {
      // Solo mandamos al backend los empleados cuyas áreas realmente cambiaron
      const cambiados = employees.filter((e) => {
        const draft = draftAreas[e.id];
        if (!draft) return false;
        return [...e.areas].sort().join(",") !== [...draft].sort().join(",");
      });

      Promise.all(
        cambiados.map((e) => actualizarAreasEmpleado(e.id, draftAreas[e.id]))
      )
        .then(() => {
          setEmployees((prev) =>
            prev.map((e) => ({ ...e, areas: draftAreas[e.id] ?? e.areas }))
          );
          setMode("view");
        })
        .catch((err) => {
          console.error("No se pudieron guardar las áreas de uno o más empleados:", err);
          // No aplicamos los cambios localmente si falló el guardado, para no mostrar
          // un estado que no coincide con lo que realmente quedó en la base de datos.
        });
    } else {
      setMode("view");
    }
  }

  const areaKeys: AreaKey[] = ["plantines", "nativos", "hidroponia"];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        <p className="text-sm font-semibold" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--pine)" }}>
          {employees.length} empleados registrados
        </p>
        <div className="flex items-center gap-2">
          {isAdmin && mode !== "view" ? (
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                fontFamily: "'Outfit', sans-serif",
                background: "linear-gradient(135deg, var(--pine), var(--pine-mid))",
                color: "#fff",
                border: "none",
                boxShadow: "0 2px 12px var(--pine-border)",
              }}
              onClick={finalize}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 13, height: 13 }}>
                <path d="M13.5 2l-7.5 7.5-3.5-3.5-1.5 1.5 5 5 9-9z" />
              </svg>
              Finalizar
            </button>
          ) : isAdmin ? (
            <>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--pine)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--pine)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
                onClick={startAddRemove}
              >
                <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 13, height: 13 }}>
                  <path d="M8 2a1 1 0 011 1v4h4a1 1 0 110 2H9v4a1 1 0 11-2 0V9H3a1 1 0 110-2h4V3a1 1 0 011-1zM3 12h10a1 1 0 110 2H3a1 1 0 110-2z" />
                </svg>
                Añadir / Editar / Quitar
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--pine)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--pine)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
                onClick={startEditAreas}
              >
                <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 13, height: 13 }}>
                  <path d="M12.586 2.586a2 2 0 112.828 2.828l-9 9A2 2 0 015 15H3a1 1 0 01-1-1v-2a2 2 0 01.586-1.414l9-9z" />
                </svg>
                Editar área
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Employee list */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        <div className="flex flex-col gap-3">
          {/* Add new button in add-remove mode */}
          {mode === "add-remove" && (
            <button
              className="flex items-center gap-3 rounded-2xl px-5 py-4 transition-all animate-fade-up text-left"
              style={{
                border: "2px dashed var(--pine-border)",
                background: "var(--pine-pale)",
                color: "var(--pine)",
                opacity: 0,
              }}
              onClick={() => setFormEmployee("new")}
            >
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 44, height: 44, background: "var(--pine-border)", border: "2px dashed var(--pine)" }}
              >
                <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 16, height: 16 }}>
                  <path d="M8 2a1 1 0 011 1v4h4a1 1 0 110 2H9v4a1 1 0 11-2 0V9H3a1 1 0 110-2h4V3a1 1 0 011-1z" />
                </svg>
              </div>
              <span className="text-sm font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Nuevo Usuario
              </span>
            </button>
          )}

          {employees.map((emp, i) => (
            <div
              key={emp.id}
              className="float-card flex items-start gap-4 rounded-2xl px-5 py-4 animate-slide-in transition-all"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderLeft: "3px solid var(--pine)",
                animationDelay: `${i * 0.04}s`,
                opacity: 0,
              }}
            >
              <UserAvatar name={emp.name} size={52} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text)" }}>
                    {emp.name}
                  </p>
                  <RoleBadge role={emp.role} />
                </div>
                <p className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>
                  <svg viewBox="0 0 12 12" fill="currentColor" style={{ width: 10, height: 10, display: "inline", marginRight: 3, verticalAlign: "middle" }}>
                    <path d="M6 0a4 4 0 00-4 4c0 3 4 8 4 8s4-5 4-8a4 4 0 00-4-4zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                  </svg>
                  {emp.areas.map((a) => AREA_LABELS[a]).join(", ") || "Sin área asignada"}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ width: 10, height: 10, display: "inline", marginRight: 3, verticalAlign: "middle" }}>
                    <circle cx="6" cy="6" r="5" /><path d="M6 3v3l2 2" strokeLinecap="round" />
                  </svg>
                  {emp.schedule}
                </p>

                {/* Area editor */}
                {mode === "edit-areas" && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {areaKeys.map((aKey) => {
                      const active = (draftAreas[emp.id] ?? emp.areas).includes(aKey);
                      return (
                        <button
                          key={aKey}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                          style={{
                            fontFamily: "'Outfit', sans-serif",
                            background: active ? "var(--pine)" : "var(--surface-2)",
                            color: active ? "#fff" : "var(--text-muted)",
                            border: active ? "1px solid var(--pine)" : "1px solid var(--border-strong)",
                          }}
                          onClick={() => toggleArea(emp.id, aKey)}
                        >
                          {active ? (
                            <svg viewBox="0 0 10 8" fill="none" style={{ width: 9, height: 9 }}>
                              <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 10 10" fill="currentColor" style={{ width: 9, height: 9 }}>
                              <path d="M5 1a1 1 0 011 1v2h2a1 1 0 110 2H6v2a1 1 0 11-2 0V6H2a1 1 0 110-2h2V2a1 1 0 011-1z" />
                            </svg>
                          )}
                          {AREA_LABELS[aKey].split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Edit / Remove buttons */}
              {mode === "add-remove" && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="rounded-full flex items-center justify-center transition-all"
                    style={{
                      width: 28,
                      height: 28,
                      background: "var(--pine-pale)",
                      border: "1px solid var(--pine-border)",
                      color: "var(--pine)",
                    }}
                    onClick={() => setFormEmployee(emp)}
                    title="Editar datos"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 12, height: 12 }}>
                      <path d="M12.586 2.586a2 2 0 112.828 2.828l-9 9A2 2 0 015 15H3a1 1 0 01-1-1v-2a2 2 0 01.586-1.414l9-9z" />
                    </svg>
                  </button>
                  <button
                    className="rounded-full flex items-center justify-center transition-all"
                    style={{
                      width: 28,
                      height: 28,
                      background: "var(--red-pale)",
                      border: "1px solid var(--red-border)",
                      color: "var(--red)",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--red)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--red-pale)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; }}
                    onClick={() => removeEmployee(emp.id)}
                    title="Quitar empleado"
                  >
                    <svg viewBox="0 0 14 2" fill="currentColor" style={{ width: 10, height: 2 }}>
                      <rect width="14" height="2" rx="1" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {formEmployee !== null && (
        <EmployeeFormModal
          employee={formEmployee === "new" ? null : formEmployee}
          onCancel={() => setFormEmployee(null)}
          onSave={saveEmployeeForm}
        />
      )}
    </div>
  );
}

// ─── Employee Form Modal (planilla de datos) ───────────────────────────────────
function EmployeeFormModal({
  employee,
  onCancel,
  onSave,
}: {
  employee: Employee | null;
  onCancel: () => void;
  onSave: (data: EmpleadoForm, editingId?: number) => void;
}) {
  const [form, setForm] = useState<EmpleadoForm>({
    nombre: employee?.name ?? "",
    apellido: employee?.lastName ?? "",
    rol: employee?.role ?? "Empleado",
    horario: employee?.schedule ?? "",
    dias: employee?.days ?? "",
    documento: employee?.documentId ?? "",
    contacto: employee?.contact ?? "",
    direccion: employee?.address ?? "",
    fecha_nacimiento: employee?.birthDate ? employee.birthDate.slice(0, 10) : "",
  });

  function update<K extends keyof EmpleadoForm>(key: K, value: EmpleadoForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const fieldStyle: CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    background: "var(--surface)",
    color: "var(--text)",
    fontFamily: "'Outfit', sans-serif",
    fontSize: 13,
  };
  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 4,
    display: "block",
    fontFamily: "'Outfit', sans-serif",
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onCancel}
    >
      <div
        className="float-card aero-sheen rounded-2xl p-6 w-full max-w-lg mx-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--pine)" }}>
          {employee ? "Editar empleado" : "Nuevo empleado"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Nombre</label>
            <input style={fieldStyle} value={form.nombre} onChange={(e) => update("nombre", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Apellido</label>
            <input style={fieldStyle} value={form.apellido} onChange={(e) => update("apellido", e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Rol</label>
            <select style={fieldStyle} value={form.rol} onChange={(e) => update("rol", e.target.value)}>
              <option value="Empleado">Empleado</option>
              <option value="Encargado">Encargado</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Número de documento</label>
            <input style={fieldStyle} value={form.documento} onChange={(e) => update("documento", e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Horario</label>
            <input style={fieldStyle} placeholder="ej: 08:00–17:00" value={form.horario} onChange={(e) => update("horario", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Días</label>
            <input style={fieldStyle} placeholder="ej: Lun–Vie" value={form.dias} onChange={(e) => update("dias", e.target.value)} />
          </div>

          <div>
            <label style={labelStyle}>Contacto</label>
            <input style={fieldStyle} placeholder="teléfono o email" value={form.contacto} onChange={(e) => update("contacto", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Fecha de nacimiento</label>
            <input type="date" style={fieldStyle} value={form.fecha_nacimiento} onChange={(e) => update("fecha_nacimiento", e.target.value)} />
          </div>

          <div className="col-span-2">
            <label style={labelStyle}>Dirección</label>
            <input style={fieldStyle} value={form.direccion} onChange={(e) => update("direccion", e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              fontFamily: "'Outfit', sans-serif",
              background: "linear-gradient(135deg, var(--pine), var(--pine-mid))",
              color: "#fff",
              border: "none",
            }}
            onClick={() => onSave(form, employee?.id)}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}


type SensorStatus = "en_funcionamiento" | "fuera_de_servicio" | "reemplazar";

interface SensorEntry {
  id?: number;
  name: string;
  status: SensorStatus;
}

interface AreaState extends Omit<AreaDef, "sensors"> {
  sensors: SensorEntry[];
  employeeNames?: string[];
}

const STATUS_META: Record<SensorStatus, { label: string; color: string; bg: string; border: string }> = {
  en_funcionamiento: { label: "En funcionamiento", color: "var(--pine)",   bg: "var(--pine-pale)",   border: "var(--pine-border)" },
  fuera_de_servicio: { label: "Fuera de servicio", color: "var(--red)",    bg: "var(--red-pale)",    border: "var(--red-border)" },
  reemplazar:        { label: "Reemplazar",         color: "var(--yellow)", bg: "var(--yellow-pale)", border: "var(--yellow-border)" },
};

const INITIAL_AREA_STATES: AreaState[] = INITIAL_AREAS.map((a) => ({
  ...a,
  sensors: a.sensors.map((s) => ({ name: s, status: "en_funcionamiento" as SensorStatus })),
}));

// ─── Area Form Modal (crear/editar área — sección 3, Parte 2) ──────────────────
// Mismo patrón visual que EmployeeFormModal: nombre del área, sensores asignados
// (con su estado inicial) y empleados asignados.
function AreaFormModal({
  area,
  employees,
  onCancel,
  onSave,
}: {
  area: AreaState | null; // null = crear área nueva
  employees: Employee[];
  onCancel: () => void;
  onSave: (datos: {
    clave?: string;
    etiqueta: string;
    etiquetaCompleta: string;
    sensoresNuevos: { nombre: string; estado: SensorStatus }[];
    sensoresActualizados: { id: number; nombre: string; estado: SensorStatus }[];
    empleadoIds: number[];
  }) => void;
}) {
  const [clave, setClave] = useState(area?.key ?? "");
  const [etiqueta, setEtiqueta] = useState(area?.label ?? "");
  const [etiquetaCompleta, setEtiquetaCompleta] = useState(area?.fullLabel ?? "");
  const [sensorRows, setSensorRows] = useState<{ id?: number; nombre: string; estado: SensorStatus }[]>(
    area?.sensors.map((s) => ({ id: s.id, nombre: s.name, estado: s.status })) ?? []
  );
  const [empleadoIds, setEmpleadoIds] = useState<number[]>(area?.employeeIds ?? []);

  function claveSugerida(texto: string) {
    return texto
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // saca acentos
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function actualizarSensor(index: number, cambios: Partial<{ nombre: string; estado: SensorStatus }>) {
    setSensorRows((prev) => prev.map((s, i) => (i === index ? { ...s, ...cambios } : s)));
  }

  function agregarSensor() {
    setSensorRows((prev) => [...prev, { nombre: "", estado: "en_funcionamiento" }]);
  }

  function quitarSensor(index: number) {
    // Solo se pueden quitar filas todavía no guardadas (sin id) — un sensor ya
    // creado puede tener historial de notificaciones asociado.
    setSensorRows((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleEmpleado(id: number) {
    setEmpleadoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const fieldStyle: CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    background: "var(--surface)",
    color: "var(--text)",
    fontFamily: "'Outfit', sans-serif",
    fontSize: 13,
  };
  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 4,
    display: "block",
    fontFamily: "'Outfit', sans-serif",
  };

  const puedeGuardar = !!etiqueta.trim() && (!!area || !!clave.trim());

  function handleSave() {
    onSave({
      clave: area ? undefined : (clave.trim() || claveSugerida(etiqueta)),
      etiqueta: etiqueta.trim(),
      etiquetaCompleta: etiquetaCompleta.trim() || etiqueta.trim(),
      sensoresNuevos: sensorRows.filter((s) => !s.id && s.nombre.trim()).map((s) => ({ nombre: s.nombre.trim(), estado: s.estado })),
      sensoresActualizados: sensorRows.filter((s) => !!s.id).map((s) => ({ id: s.id as number, nombre: s.nombre.trim(), estado: s.estado })),
      empleadoIds,
    });
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onCancel}
    >
      <div
        className="float-card aero-sheen rounded-2xl p-6 w-full max-w-lg mx-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--pine)" }}>
          {area ? "Editar área" : "Nueva área"}
        </h3>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Nombre corto</label>
              <input style={fieldStyle} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="ej: Compostaje" />
            </div>
            <div>
              <label style={labelStyle}>Nombre completo</label>
              <input style={fieldStyle} value={etiquetaCompleta} onChange={(e) => setEtiquetaCompleta(e.target.value)} placeholder="ej: Producción de Compost" />
            </div>
          </div>

          {!area && (
            <div>
              <label style={labelStyle}>Clave interna (sin espacios ni tildes)</label>
              <input
                style={fieldStyle}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder={claveSugerida(etiqueta) || "ej: compostaje"}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Sensores</label>
            <div className="flex flex-col gap-2">
              {sensorRows.map((s, i) => (
                <div key={s.id ?? `nuevo-${i}`} className="flex items-center gap-2">
                  <input
                    style={{ ...fieldStyle, flex: 1 }}
                    value={s.nombre}
                    onChange={(e) => actualizarSensor(i, { nombre: e.target.value })}
                    placeholder="Nombre del sensor"
                  />
                  <select
                    style={{ ...fieldStyle, width: 150 }}
                    value={s.estado}
                    onChange={(e) => actualizarSensor(i, { estado: e.target.value as SensorStatus })}
                  >
                    {(Object.keys(STATUS_META) as SensorStatus[]).map((st) => (
                      <option key={st} value={st}>{STATUS_META[st].label}</option>
                    ))}
                  </select>
                  {!s.id && (
                    <button
                      className="rounded-lg px-2 py-1.5 text-xs shrink-0"
                      style={{ background: "var(--red-pale)", border: "1px solid var(--red-border)", color: "var(--red)" }}
                      onClick={() => quitarSensor(i)}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
              <button
                className="self-start px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ fontFamily: "'Outfit', sans-serif", background: "var(--pine-pale)", border: "1px solid var(--pine-border)", color: "var(--pine)" }}
                onClick={agregarSensor}
              >
                + Agregar sensor
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Empleados asignados</label>
            <div
              className="flex flex-col gap-1 rounded-xl p-2"
              style={{ border: "1px solid var(--border)", maxHeight: 160, overflowY: "auto" }}
            >
              {employees.length === 0 && (
                <p className="text-xs px-2 py-1" style={{ color: "var(--text-faint)" }}>No hay empleados cargados.</p>
              )}
              {employees.map((emp) => {
                const checked = empleadoIds.includes(emp.id);
                return (
                  <button
                    key={emp.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg text-sm"
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      background: checked ? "var(--pine-pale)" : "transparent",
                      color: checked ? "var(--pine)" : "var(--text)",
                    }}
                    onClick={() => toggleEmpleado(emp.id)}
                  >
                    <span>{emp.name} {emp.lastName ?? ""} · {emp.role}</span>
                    {checked && (
                      <svg viewBox="0 0 12 10" fill="none" style={{ width: 12, height: 12 }}>
                        <path d="M1 5l3.5 3.5L11 1" stroke="var(--pine)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              fontFamily: "'Outfit', sans-serif",
              background: "linear-gradient(135deg, var(--pine), var(--pine-mid))",
              color: "#fff",
              border: "none",
              opacity: puedeGuardar ? 1 : 0.5,
            }}
            disabled={!puedeGuardar}
            onClick={handleSave}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function AreasPage({
  isAdmin,
  canEditSensors,
}: {
  isAdmin: boolean;
  canEditSensors: boolean;
}) {
  const [areas, setAreas]           = useState<AreaState[]>(INITIAL_AREA_STATES);
  const [removed, setRemoved]       = useState<AreaState[]>([]);
  const [mode, setMode]             = useState<"view" | "add-remove">("view");
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [employees, setEmployees]   = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [formArea, setFormArea]     = useState<AreaState | null | undefined>(undefined); // undefined = cerrado, null = crear, AreaState = editar

  function reloadAreas() {
    fetchAreas()
      .then((data) => setAreas(data))
      .catch((err) => console.error("No se pudieron cargar las áreas:", err));
  }

  useEffect(() => {
    reloadAreas();
    fetchEmpleados()
      .then((data) => setEmployees(data))
      .catch((err) => console.error("No se pudieron cargar los empleados:", err));
  }, []);

  // sección 3, Parte 2: crear/editar área con sensores y empleados asignados
  function guardarArea(datos: {
    clave?: string;
    etiqueta: string;
    etiquetaCompleta: string;
    sensoresNuevos: { nombre: string; estado: SensorStatus }[];
    sensoresActualizados: { id: number; nombre: string; estado: SensorStatus }[];
    empleadoIds: number[];
  }) {
    const promesa =
      formArea && formArea.id
        ? actualizarArea(formArea.id, {
            etiqueta: datos.etiqueta,
            etiquetaCompleta: datos.etiquetaCompleta,
            sensoresNuevos: datos.sensoresNuevos,
            sensoresActualizados: datos.sensoresActualizados,
            empleadoIds: datos.empleadoIds,
          })
        : crearArea({
            clave: datos.clave!,
            etiqueta: datos.etiqueta,
            etiquetaCompleta: datos.etiquetaCompleta,
            sensores: datos.sensoresNuevos,
            empleadoIds: datos.empleadoIds,
          });
    promesa
      .then(() => {
        setFormArea(undefined);
        reloadAreas();
      })
      .catch((err) => alert(err.message || "No se pudo guardar el área"));
  }

  function removeArea(key: string) {
    const target = areas.find((a) => a.key === key);
    if (target) setRemoved((prev) => [...prev, target]);
    setAreas((prev) => prev.filter((a) => a.key !== key));
    if (expanded === key) setExpanded(null);
  }

  function restoreArea(key: string) {
    const target = removed.find((a) => a.key === key);
    if (target) { setAreas((prev) => [...prev, target]); }
    setRemoved((prev) => prev.filter((a) => a.key !== key));
  }

  function cycleSensorStatus(areaKey: string, sensorName: string) {
    const order: SensorStatus[] = ["en_funcionamiento", "fuera_de_servicio", "reemplazar"];
    setAreas((prev) =>
      prev.map((a) =>
        a.key === areaKey
          ? {
              ...a,
              sensors: a.sensors.map((s) =>
                s.name === sensorName
                  ? { ...s, status: order[(order.indexOf(s.status) + 1) % order.length] }
                  : s
              ),
            }
          : a
      )
    );
  }

  function setSensorStatus(areaKey: string, sensorId: number | undefined, sensorName: string, status: SensorStatus) {
    if (!sensorId) return;
    actualizarEstadoSensor(sensorId, status)
      .then(() => {
        setAreas((prev) =>
          prev.map((a) =>
            a.key === areaKey
              ? { ...a, sensors: a.sensors.map((s) => (s.name === sensorName ? { ...s, status } : s)) }
              : a
          )
        );
      })
      .catch((err) => console.error("No se pudo actualizar el sensor:", err));
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--pine)" }}>
            {areas.length} áreas activas
          </p>
          {removed.length > 0 && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                fontFamily: "'Outfit', sans-serif",
                background: showRemoved ? "var(--red-pale)" : "var(--surface)",
                border: showRemoved ? "1px solid var(--red-border)" : "1px solid var(--border-strong)",
                color: showRemoved ? "var(--red)" : "var(--text-muted)",
              }}
              onClick={() => setShowRemoved((v) => !v)}
            >
              <svg viewBox="0 0 14 14" fill="currentColor" style={{ width: 11, height: 11 }}>
                <path d="M5 2h4l1 2H4L5 2zM2 5h10l-.8 7H2.8L2 5zm3 2v4m4-4v4" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
              </svg>
              Eliminadas ({removed.length})
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (mode !== "view" ? (
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ fontFamily: "'Outfit', sans-serif", background: "linear-gradient(135deg, var(--pine), var(--pine-mid))", color: "#fff", border: "none", boxShadow: "0 2px 12px var(--pine-border)" }}
              onClick={() => setMode("view")}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 13, height: 13 }}>
                <path d="M13.5 2l-7.5 7.5-3.5-3.5-1.5 1.5 5 5 9-9z" />
              </svg>
              Finalizar
            </button>
          ) : (
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--pine)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--pine)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
              onClick={() => setMode("add-remove")}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 13, height: 13 }}>
                <path d="M8 2a1 1 0 011 1v4h4a1 1 0 110 2H9v4a1 1 0 11-2 0V9H3a1 1 0 110-2h4V3a1 1 0 011-1zM3 12h10a1 1 0 110 2H3a1 1 0 110-2z" />
              </svg>
              Añadir / Quitar
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        {/* Removed areas panel */}
        {showRemoved && removed.length > 0 && (
          <div className="mb-5 rounded-2xl overflow-hidden animate-fade-up" style={{ border: "1px solid var(--red-border)", opacity: 0 }}>
            <div className="px-4 py-2.5" style={{ background: "var(--red-pale)", borderBottom: "1px solid var(--red-border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--red)", fontFamily: "'Outfit', sans-serif" }}>
                Áreas eliminadas · {removed.length}
              </p>
            </div>
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
              {removed.map((area) => (
                <div key={area.key} className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--surface)" }}>
                  <p className="flex-1 text-sm font-medium" style={{ color: "var(--text-muted)", fontFamily: "'Outfit', sans-serif" }}>{area.fullLabel}</p>
                  {isAdmin && (
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                      style={{ background: "var(--pine-pale)", border: "1px solid var(--pine-border)", color: "var(--pine)", fontFamily: "'Outfit', sans-serif" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--pine)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--pine-pale)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--pine)"; }}
                      onClick={() => restoreArea(area.key)}
                    >
                      Restaurar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* Add new area */}
          {mode === "add-remove" && isAdmin && (
            <button
              className="flex items-center gap-3 rounded-2xl px-5 py-4 transition-all animate-fade-up text-left"
              style={{ border: "2px dashed var(--pine-border)", background: "var(--pine-pale)", color: "var(--pine)", opacity: 0 }}
              onClick={() => setFormArea(null)}
            >
              <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 44, height: 44, background: "var(--pine-border)", border: "2px dashed var(--pine)" }}>
                <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 16, height: 16 }}>
                  <path d="M8 2a1 1 0 011 1v4h4a1 1 0 110 2H9v4a1 1 0 11-2 0V9H3a1 1 0 110-2h4V3a1 1 0 011-1z" />
                </svg>
              </div>
              <span className="text-sm font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>Nueva Área</span>
            </button>
          )}

          {areas.map((area, i) => {
            const isOpen = expanded === area.key;
            const areaEmployees = employees.filter((e) => e.areas.includes(area.key as AreaKey));
            return (
              <div
                key={area.key}
                className="float-card rounded-2xl overflow-hidden animate-slide-in"
                style={{
                  background: "var(--surface)",
                  border: isOpen ? "1px solid var(--lime-border)" : "1px solid var(--border)",
                  borderLeft: isOpen ? "3px solid var(--lime)" : "1px solid var(--border)",
                  animationDelay: `${i * 0.05}s`,
                  opacity: 0,
                  boxShadow: isOpen ? "0 4px 20px var(--lime-border)" : undefined,
                  transition: "box-shadow 0.2s, border-color 0.2s",
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : area.key)}>
                  <div className="rounded-xl flex items-center justify-center shrink-0" style={{ width: 44, height: 44, background: "var(--pine-pale)", border: "1px solid var(--pine-border)" }}>
                    <PineLogo size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text)" }}>{area.fullLabel}</p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs" style={{ color: "var(--text-faint)" }}>{area.sensors.length} sensores</span>
                      <span className="text-xs" style={{ color: "var(--text-faint)" }}>{areaEmployees.length} empleados</span>
                      {area.sensors.some((s) => s.status === "fuera_de_servicio") && (
                        <span className="text-xs font-semibold" style={{ color: "var(--red)" }}>⚠ sensor fuera de servicio</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text-muted)", fontFamily: "'Outfit', sans-serif" }}
                        onClick={(e) => { e.stopPropagation(); setFormArea(area); }}
                      >
                        Editar
                      </button>
                    )}
                    {mode === "add-remove" && isAdmin && (
                      <button
                        className="rounded-full flex items-center justify-center transition-all"
                        style={{ width: 28, height: 28, background: "var(--red-pale)", border: "1px solid var(--red-border)", color: "var(--red)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--red)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--red-pale)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; }}
                        onClick={(e) => { e.stopPropagation(); removeArea(area.key); }}
                      >
                        <svg viewBox="0 0 14 2" fill="currentColor" style={{ width: 10, height: 2 }}><rect width="14" height="2" rx="1" /></svg>
                      </button>
                    )}
                    <svg viewBox="0 0 10 6" fill="currentColor" style={{ width: 10, height: 10, color: "var(--pine)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}>
                      <path d="M0 0l5 6 5-6H0z" />
                    </svg>
                  </div>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div className="px-5 pb-5 animate-collapse" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="grid gap-5 mt-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      {/* Sensors with status */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--pine)", fontFamily: "'Outfit', sans-serif" }}>
                          Sensores
                        </p>
                        <div className="flex flex-col gap-2">
                          {area.sensors.length > 0 ? area.sensors.map((sensor) => {
                            const meta = STATUS_META[sensor.status];
                            return (
                              <div key={sensor.name} className="flex items-center gap-2">
                                <span className="flex-1 text-xs font-medium" style={{ color: "var(--text)", fontFamily: "'Inter', sans-serif" }}>
                                  {sensor.name}
                                </span>
                                {/* Status selector */}
                                {canEditSensors ? (
                                  <div className="flex gap-1">
                                    {(Object.keys(STATUS_META) as SensorStatus[]).map((st) => {
                                      const m = STATUS_META[st];
                                      const active = sensor.status === st;
                                      return (
                                        <button
                                          key={st}
                                          title={m.label}
                                          className="rounded-full px-2 py-0.5 text-xs font-medium transition-all"
                                          style={{
                                            background: active ? m.bg : "var(--surface-2)",
                                            border: active ? `1px solid ${m.border}` : "1px solid var(--border)",
                                            color: active ? m.color : "var(--text-faint)",
                                            fontSize: 9,
                                            fontFamily: "'Outfit', sans-serif",
                                            whiteSpace: "nowrap",
                                          }}
                                          onClick={() => setSensorStatus(area.key, sensor.id, sensor.name, st)}
                                        >
                                          {m.label.split(" ")[0]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span
                                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                                    style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color, fontFamily: "'Outfit', sans-serif", fontSize: 10 }}
                                  >
                                    {meta.label}
                                  </span>
                                )}
                              </div>
                            );
                          }) : <p className="text-xs" style={{ color: "var(--text-faint)" }}>Sin sensores</p>}
                        </div>
                      </div>

                      {/* Employees */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--pine)", fontFamily: "'Outfit', sans-serif" }}>
                          Empleados
                        </p>
                        <div className="flex flex-col gap-2">
                          {areaEmployees.length > 0 ? areaEmployees.map((emp) => (
                            <div key={emp.id} className="flex items-center gap-2">
                              <UserAvatar name={emp.name} size={26} />
                              <div>
                                <p className="text-xs font-medium leading-tight" style={{ color: "var(--text)", fontFamily: "'Outfit', sans-serif" }}>{emp.name}</p>
                                <p style={{ fontSize: 10, color: "var(--text-faint)" }}>{emp.role} · {emp.schedule}</p>
                              </div>
                            </div>
                          )) : <p className="text-xs" style={{ color: "var(--text-faint)" }}>Sin empleados asignados</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {formArea !== undefined && (
        <AreaFormModal
          area={formArea}
          employees={employees}
          onCancel={() => setFormArea(undefined)}
          onSave={guardarArea}
        />
      )}
    </div>
  );
}

// ─── Global Dashboard ─────────────────────────────────────────────────────────
type AreaFilter = "all" | AreaKey;

const AREA_TABS: { key: AreaFilter; label: string }[] = [
  { key: "all",       label: "Todas las notificaciones" },
  { key: "plantines", label: "Prod. de Plantines" },
  { key: "nativos",   label: "Prod. de Árboles Nativos" },
  { key: "hidroponia", label: "Hidroponía" },
];

function GlobalDashboard({ isAdmin, role }: { isAdmin: boolean; role: "Empleado" | "Encargado" | "Admin" }) {
  const [vista, setVista] = useState<"notificaciones" | "llamados">("notificaciones");
  const [allNotifs, setAllNotifs] = useState<Notif[]>(ALL_NOTIFS);
  const [areaFilter, setAreaFilter] = useState<AreaFilter>("all");
  const [statusFilter, setStatusFilter] = useState<FilterState>("all");
  const [statusOpen, setStatusOpen] = useState(false);
  const [llamados, setLlamados] = useState<Llamado[]>([]);

  useEffect(() => {
    fetchNotificaciones()
      .then((data) => setAllNotifs(data))
      .catch((err) => console.error("No se pudieron cargar las notificaciones:", err));
    fetchLlamados()
      .then((data) => setLlamados(data))
      .catch((err) => console.error("No se pudieron cargar los llamados:", err));
  }, []);

  // Corrección punto 3: el Admin, desde acá, puede cambiar el estado de CUALQUIER
  // notificación libremente (Asignada/En proceso/Solucionada), sin restricción de
  // área — ya no hay "ocultar" ni "marcar como leída", solo un único "Eliminar"
  // que manda a la papelera, y su contraparte "Restaurar".
  function setEstadoNotifGlobal(id: number, estado: NotifEstado) {
    const n = allNotifs.find((x) => x.id === id);
    cambiarEstadoNotificacion(id, estado)
      .then(() => {
        setAllNotifs((prev) =>
          prev.map((x) => {
            if (x.id !== id) return x;
            const level: NotifLevel = estado === "solucionada" ? "green" : estado === "en_proceso" ? "yellow" : x.urgente ? "red" : "yellow";
            return { ...x, estado, level };
          })
        );
      })
      .catch((err) => console.error("No se pudo cambiar el estado de la notificación:", err));
  }

  function eliminarNotifGlobal(id: number) {
    enviarNotificacionAPapelera(id)
      .then(() => setAllNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, eliminado: true } : n))))
      .catch((err) => console.error("No se pudo eliminar la notificación:", err));
  }

  function restaurarNotifGlobal(id: number) {
    restaurarNotificacionDePapelera(id)
      .then(() => setAllNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, eliminado: false } : n))))
      .catch((err) => console.error("No se pudo restaurar la notificación:", err));
  }

  // Admin, desde acá: cambia el estado de un llamado libremente (tomar / atender / reabrir),
  // y lo elimina (papelera) / restaura — igual criterio que las notificaciones, sin
  // restricción de área (corrección punto 3).
  function setEstadoLlamado(id: number, estado: LlamadoEstado) {
    const promesa =
      estado === "solucionada" ? atenderLlamado(id) :
      estado === "en_proceso" ? tomarLlamado(id) :
      cambiarEstadoLlamado(id, estado);
    promesa
      .then(() => setLlamados((prev) => prev.map((l) => (l.id === id ? { ...l, estado, atendido: estado === "solucionada" } : l))))
      .catch((err) => console.error("No se pudo actualizar el llamado:", err));
  }

  function eliminarLlamadoGlobal(id: number) {
    enviarLlamadoAPapelera(id)
      .then(() => setLlamados((prev) => prev.map((l) => (l.id === id ? { ...l, eliminado: true } : l))))
      .catch((err) => console.error("No se pudo eliminar el llamado:", err));
  }

  function restaurarLlamadoGlobal(id: number) {
    restaurarLlamadoDePapelera(id)
      .then(() => setLlamados((prev) => prev.map((l) => (l.id === id ? { ...l, eliminado: false } : l))))
      .catch((err) => console.error("No se pudo restaurar el llamado:", err));
  }

  // Filter by area and status (sin restricción — el Dashboard Global siempre muestra todo)
  const base = allNotifs.filter(
    (n) =>
      !n.eliminado &&
      (areaFilter === "all" || n.area === areaFilter) &&
      (statusFilter === "all" || n.level === statusFilter)
  );

  // Group by area for "all" tab, or just show flat list for specific area
  const areaKeys: AreaKey[] = ["plantines", "nativos", "hidroponia"];

  // Reportes de sensor: van en sus propios apartados, arriba y abajo de todo
  const sensorPending = base.filter((n) => (n.level === "red" || n.level === "yellow") && n.sensor);
  const sensorFixed   = base.filter((n) => n.level === "green" && n.sensor);

  // Papelera de notificaciones — reemplaza a la vieja sección de "Ocultas" (corrección punto 3)
  const papeleraNotifs = allNotifs.filter(
    (n) => n.eliminado && (areaFilter === "all" || n.area === areaFilter)
  );

  const statusOptions: { value: FilterState; label: string }[] = [
    { value: "all",    label: "Todos los estados" },
    { value: "red",    label: "Urgentes" },
    { value: "yellow", label: "En Proceso" },
    { value: "green",  label: "Solucionadas" },
  ];

  // Llamados: filtrados por área, con "Llamados atendidos" y "Papelera" siempre separados (sección 2 y corrección punto 3)
  const llamadosArea = llamados.filter((l) => (areaFilter === "all" || l.area === areaFilter) && !l.eliminado);
  const llamadosPendientes = llamadosArea.filter((l) => l.estado !== "solucionada");
  const llamadosAtendidos = llamadosArea.filter((l) => l.estado === "solucionada");
  const llamadosPapelera = llamados.filter((l) => l.eliminado && (areaFilter === "all" || l.area === areaFilter));

  const colorStylesLlamado: Record<NotifColor, { text: string; bg: string; border: string }> = {
    red:    { text: "var(--red)",    bg: "var(--red-pale)",    border: "var(--red-border)" },
    orange: { text: "var(--orange, #f97316)", bg: "var(--orange-pale, rgba(249,115,22,0.12))", border: "var(--orange-border, rgba(249,115,22,0.32))" },
    yellow: { text: "var(--yellow)", bg: "var(--yellow-pale)", border: "var(--yellow-border)" },
    green:  { text: "var(--pine)",   bg: "var(--pine-pale)",   border: "var(--pine-border)" },
  };

  function renderLlamadoGlobal(l: Llamado, enPapelera = false) {
    const c = colorStylesLlamado[colorDeLlamado(l.estado)];
    return (
      <div
        key={l.id}
        className="notif-glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
        style={{ background: c.bg, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.text}` }}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: c.text, fontFamily: "'Outfit', sans-serif" }}>
            {l.empleadoNombre} ({l.empleadoRol}) → {l.destinoNombre}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {AREA_LABELS[l.area]}{l.mensaje ? ` · ${l.mensaje}` : ""}
          </p>
          <p className="font-display text-xs mt-0.5 tracking-wide" style={{ color: "var(--text-faint)" }}>{l.time}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1.5 shrink-0">
            {enPapelera ? (
              <button
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border-strong)" }}
                onClick={() => restaurarLlamadoGlobal(l.id)}
              >
                Restaurar
              </button>
            ) : (
              <>
                {l.estado === "asignada" && (
                  <button
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border-strong)" }}
                    onClick={() => setEstadoLlamado(l.id, "en_proceso")}
                  >
                    Tomar
                  </button>
                )}
                {l.estado !== "solucionada" && (
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ fontFamily: "'Outfit', sans-serif", background: "var(--pine)", color: "#fff", border: "none" }}
                    onClick={() => setEstadoLlamado(l.id, "solucionada")}
                  >
                    Atender
                  </button>
                )}
                {l.estado === "solucionada" && (
                  <button
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border-strong)" }}
                    onClick={() => setEstadoLlamado(l.id, "asignada")}
                  >
                    Reabrir
                  </button>
                )}
                <button
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ fontFamily: "'Outfit', sans-serif", background: "var(--red-pale)", color: "var(--red)", border: "1px solid var(--red-border)" }}
                  onClick={() => eliminarLlamadoGlobal(l.id)}
                >
                  Eliminar
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Vista: Notificaciones / Llamados */}
      <div className="shrink-0 flex gap-2 px-4 sm:px-6 pt-4" style={{ background: "var(--surface)" }}>
        {([
          { key: "notificaciones", label: "Notificaciones" },
          { key: "llamados", label: "Llamados de Emergencia" },
        ] as { key: "notificaciones" | "llamados"; label: string }[]).map((tab) => {
          const active = vista === tab.key;
          return (
            <button
              key={tab.key}
              className="px-4 py-2 rounded-t-lg text-xs font-semibold tracking-wide transition-all"
              style={{
                fontFamily: "'Outfit', sans-serif",
                color: active ? "var(--pine)" : "var(--text-muted)",
                background: active ? "var(--pine-pale)" : "transparent",
                border: active ? "1px solid var(--pine-border)" : "1px solid transparent",
                borderBottom: "none",
              }}
              onClick={() => setVista(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {role === "Encargado" && (
        <div className="px-6 pt-3">
          <p
            className="text-xs px-3 py-2 rounded-lg"
            style={{ background: "var(--surface-2)", color: "var(--text-faint)", border: "1px solid var(--border)" }}
          >
            Vista de solo lectura — únicamente un Admin puede modificar el Dashboard Global.
          </p>
        </div>
      )}

      {/* Area tabs */}
      <div
        className="shrink-0 flex gap-0 overflow-x-auto"
        style={{ borderBottom: "2px solid var(--border)", background: "var(--surface)" }}
      >
        {AREA_TABS.map((tab) => {
          const active = areaFilter === tab.key;
          return (
            <button
              key={tab.key}
              className="shrink-0 px-5 py-3 text-sm font-medium transition-all relative"
              style={{
                fontFamily: "'Outfit', sans-serif",
                color: active ? "var(--pine)" : "var(--text-muted)",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--pine)" : "2px solid transparent",
                marginBottom: -2,
                whiteSpace: "nowrap",
              }}
              onClick={() => setAreaFilter(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        {vista === "llamados" ? (
          <div className="flex flex-col gap-6">
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              {llamadosArea.length} llamados · {llamadosPendientes.length} pendientes
            </p>
            {llamadosPendientes.length > 0 && (
              <div className="flex flex-col gap-2">{llamadosPendientes.map((l) => renderLlamadoGlobal(l))}</div>
            )}
            {llamadosAtendidos.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-faint)" }}>
                  Llamados atendidos · {llamadosAtendidos.length}
                </p>
                <div className="flex flex-col gap-2">{llamadosAtendidos.map((l) => renderLlamadoGlobal(l))}</div>
              </div>
            )}
            {isAdmin && llamadosPapelera.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-faint)" }}>
                  Papelera · {llamadosPapelera.length}
                </p>
                <div className="flex flex-col gap-2">{llamadosPapelera.map((l) => renderLlamadoGlobal(l, true))}</div>
              </div>
            )}
            {llamadosArea.length === 0 && llamadosPapelera.length === 0 && (
              <div className="text-center py-16">
                <p className="text-sm" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-faint)" }}>
                  No hay llamados para mostrar
                </p>
              </div>
            )}
          </div>
        ) : (
        <>
        {/* Count + status filter */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            {base.length} notificaciones visibles
          </p>
          <div className="relative">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all"
              style={{
                fontFamily: "'Outfit', sans-serif",
                background: statusOpen ? "var(--pine-pale)" : "var(--surface)",
                border: statusOpen ? "1px solid var(--pine-border)" : "1px solid var(--border-strong)",
                color: statusOpen ? "var(--pine)" : "var(--text-muted)",
              }}
              onClick={() => setStatusOpen((v) => !v)}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 11, height: 11 }}>
                <path d="M1 2h14l-5.5 7V14L6.5 13V9L1 2z" />
              </svg>
              Filtrar por Estado
              <svg viewBox="0 0 10 6" fill="currentColor" style={{ width: 7, height: 7, transform: statusOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <path d="M0 0l5 6 5-6H0z" />
              </svg>
            </button>
            {statusOpen && (
              <div
                className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-50 animate-fade-up"
                style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", boxShadow: "0 12px 32px rgba(0,0,0,0.15)", minWidth: 176 }}
              >
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className="w-full flex items-center px-4 py-2.5 text-xs text-left transition-colors"
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      background: statusFilter === opt.value ? "var(--pine-pale)" : "transparent",
                      color: statusFilter === opt.value ? "var(--pine)" : "var(--text-muted)",
                      fontWeight: statusFilter === opt.value ? 600 : 400,
                    }}
                    onMouseEnter={(e) => { if (statusFilter !== opt.value) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)"; }}
                    onMouseLeave={(e) => { if (statusFilter !== opt.value) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    onClick={() => { setStatusFilter(opt.value); setStatusOpen(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grouped by area when showing all, flat when specific area */}
        <div className="flex flex-col gap-8">
          {/* Reporte Sensores — siempre arriba de todo, cruza todas las áreas */}
          {sensorPending.length > 0 && (
            <NotifGroup
              title="Reporte Sensores"
              count={sensorPending.length}
              color="var(--text-muted)"
              dot="var(--red)"
              items={sensorPending}
              role={isAdmin ? "Admin" : undefined}
              onSetEstado={setEstadoNotifGlobal}
              onDelete={eliminarNotifGlobal}
              showArea
              readOnly={!isAdmin}
            />
          )}

          {areaFilter === "all" ? (
            areaKeys.map((areaKey) => {
              const areaNotifs = base.filter((n) => n.area === areaKey);
              if (areaNotifs.length === 0) return null;
              const pending   = areaNotifs.filter((n) => (n.level === "red" || n.level === "yellow") && !n.sensor);
              const solved    = areaNotifs.filter((n) => n.level === "green" && !n.sensor);
              return (
                <div key={areaKey}>
                  {/* Area header */}
                  <div
                    className="flex items-center gap-2 mb-3 px-1"
                  >
                    <PineLogo size={14} />
                    <span
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ fontFamily: "'Outfit', sans-serif", color: "var(--pine)" }}
                    >
                      {AREA_LABELS[areaKey]}
                    </span>
                    <div className="flex-1" style={{ height: 1, background: "var(--pine-border)" }} />
                  </div>
                  <div className="flex flex-col gap-5 pl-1">
                    {pending.length > 0 && (
                      <NotifGroup
                        title="Pendientes"
                        count={pending.length}
                        color="var(--text-muted)"
                        dot="var(--red)"
                        items={pending}
                        role={isAdmin ? "Admin" : undefined}
                        onSetEstado={setEstadoNotifGlobal}
                        onDelete={eliminarNotifGlobal}
                        showArea={false}
                        readOnly={!isAdmin}
                      />
                    )}
                    {solved.length > 0 && (
                      <NotifGroup
                        title="Solucionadas"
                        count={solved.length}
                        color="var(--pine)"
                        dot="var(--pine)"
                        items={solved}
                        role={isAdmin ? "Admin" : undefined}
                        onSetEstado={setEstadoNotifGlobal}
                        onDelete={eliminarNotifGlobal}
                        collapsible
                        showArea={false}
                        readOnly={!isAdmin}
                      />
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            // Specific area — flat with area badge visible, grouped by status
            (() => {
              const pending = base.filter((n) => (n.level === "red" || n.level === "yellow") && !n.sensor);
              const solved  = base.filter((n) => n.level === "green" && !n.sensor);
              return (
                <>
                  {pending.length > 0 && (
                    <NotifGroup
                      title="Pendientes"
                      count={pending.length}
                      color="var(--text-muted)"
                      dot="var(--red)"
                      items={pending}
                      role={isAdmin ? "Admin" : undefined}
                      onSetEstado={setEstadoNotifGlobal}
                      onDelete={eliminarNotifGlobal}
                      showArea
                      readOnly={!isAdmin}
                    />
                  )}
                  {solved.length > 0 && (
                    <NotifGroup
                      title="Solucionadas"
                      count={solved.length}
                      color="var(--pine)"
                      dot="var(--pine)"
                      items={solved}
                      role={isAdmin ? "Admin" : undefined}
                      onSetEstado={setEstadoNotifGlobal}
                      onDelete={eliminarNotifGlobal}
                      collapsible
                      showArea
                      readOnly={!isAdmin}
                    />
                  )}
                </>
              );
            })()
          )}

          {/* Sensores Arreglados — siempre abajo de todo, cruza todas las áreas */}
          {sensorFixed.length > 0 && (
            <NotifGroup
              title="Sensores Arreglados"
              count={sensorFixed.length}
              color="var(--pine)"
              dot="var(--pine)"
              items={sensorFixed}
              role={isAdmin ? "Admin" : undefined}
              onSetEstado={setEstadoNotifGlobal}
              onDelete={eliminarNotifGlobal}
              collapsible
              showArea
              readOnly={!isAdmin}
            />
          )}

          {/* Papelera — corrección punto 3: reemplaza a la vieja sección de "Ocultas"; un solo
              botón de Eliminar en el resto de las secciones, y acá el único "Restaurar" */}
          {isAdmin && papeleraNotifs.length > 0 && (
            <NotifGroup
              title="Papelera"
              count={papeleraNotifs.length}
              color="var(--text-faint)"
              dot="var(--text-faint)"
              items={papeleraNotifs}
              role="Admin"
              onRestore={restaurarNotifGlobal}
              inTrash
              collapsible
              showArea
            />
          )}

          {base.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-faint)" }}>
                No hay notificaciones para mostrar
              </p>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────
function DashboardPage({
  onBack,
  dark,
  toggleDark,
  isAdmin,
  currentEmployee,
}: {
  onBack: () => void;
  dark: boolean;
  toggleDark: () => void;
  isAdmin: boolean;
  currentEmployee: Employee | null;
}) {
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS);
  const [localPhoto, setLocalPhoto] = useState<string | undefined>(undefined);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<"all" | NotifEstado>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activePage, setActivePage] = useState<"notif" | "stats" | "global" | "empleados" | "areas" | "historial">("notif");
  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [showUmbralesPanel, setShowUmbralesPanel] = useState(false);
  const canCreateTasks = isAdmin || currentEmployee?.role === "Encargado";
  const canConfigurarUmbrales = isAdmin || currentEmployee?.role === "Encargado"; // sección 8.1: no Empleado
  const canSeeLlamados = isAdmin || currentEmployee?.role === "Encargado";
  const canLlamar = !isAdmin && currentEmployee?.role === "Empleado"; // Empleado -> Encargado o Admin
  const canLlamarAdmin = currentEmployee?.role === "Encargado"; // Encargado -> Admin
  const role: "Empleado" | "Encargado" | "Admin" = isAdmin ? "Admin" : (currentEmployee?.role ?? "Empleado");
  const emitidoPorLabel = isAdmin ? "Admin" : currentEmployee ? `${currentEmployee.name} (${currentEmployee.role})` : "Admin";
  const [llamados, setLlamados] = useState<Llamado[]>([]);
  const [showLlamarPanel, setShowLlamarPanel] = useState(false);
  const [llamadosAtendidosOpen, setLlamadosAtendidosOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function reloadLlamados() {
    fetchLlamados()
      .then((data) => setLlamados(data))
      .catch((err) => console.error("No se pudieron cargar los llamados:", err));
  }

  useEffect(() => {
    if (canSeeLlamados) reloadLlamados();
  }, []);

  // Quien recibe el llamado: Asignado -> En proceso
  function tomarLlamadoHandler(id: number) {
    tomarLlamado(id)
      .then(() => setLlamados((prev) => prev.map((x) => (x.id === id ? { ...x, estado: "en_proceso" } : x))))
      .catch((err) => console.error("No se pudo tomar el llamado:", err));
  }

  // Quien recibe el llamado: -> Solucionada/Atendida (se archiva, solo lectura)
  function atenderLlamadoHandler(id: number) {
    atenderLlamado(id)
      .then(() => setLlamados((prev) => prev.map((x) => (x.id === id ? { ...x, estado: "solucionada", atendido: true } : x))))
      .catch((err) => console.error("No se pudo marcar como atendido:", err));
  }

  // Admin: reabrir un llamado ya solucionado.
  function reabrirLlamadoHandler(id: number) {
    cambiarEstadoLlamado(id, "asignada")
      .then(() => setLlamados((prev) => prev.map((x) => (x.id === id ? { ...x, estado: "asignada", atendido: false } : x))))
      .catch((err) => console.error("No se pudo reabrir el llamado:", err));
  }

  function reloadNotifs() {
    fetchNotificaciones()
      .then((data) => setNotifs(data))
      .catch((err) => console.error("No se pudieron cargar las notificaciones:", err));
  }

  useEffect(() => {
    reloadNotifs();
  }, []);

  // Visibilidad (sección 3): además del filtro por área, entran también las
  // notificaciones "generales" (sin área) y las dirigidas puntualmente a este
  // empleado — así, sin necesidad de una pantalla aparte, un Encargado no ve
  // las que son "de empleado a empleado" para otra persona de su área.
  const propias = notifs.filter(
    (n) =>
      !n.eliminado &&
      (isAdmin ||
        !currentEmployee ||
        n.alcance === "general" ||
        (!!n.area && currentEmployee.areas.includes(n.area)) ||
        (n.alcance === "empleados" && n.empleadoId === currentEmployee.id))
  );

  const visible = propias.filter((n) => filter === "all" || n.estado === filter);

  // Orden de la sección 3: Urgentes → Reporte de sensores → Generales → Solucionadas (al final, solo lectura)
  const pendientes = visible.filter((n) => n.estado !== "solucionada");
  const urgentes = pendientes.filter((n) => n.urgente);
  const reportesSensores = pendientes.filter((n) => !n.urgente && n.sensor);
  const generales = pendientes.filter((n) => !n.urgente && !n.sensor);
  const solucionadas = visible.filter((n) => n.estado === "solucionada");

  // Papelera: solo Admin la ve.
  const papelera = isAdmin ? notifs.filter((n) => n.eliminado) : [];

  // Llamados de emergencia dirigidos a mí — solo Admin (destino=admin) y Encargado
  // (destino=encargado, dirigidos puntualmente a mí). Corrección punto 2: los
  // atendidos van en su propia sección al final, nunca mezclados con los pendientes.
  const misLlamados = isAdmin
    ? llamados.filter((l) => l.destino === "admin")
    : llamados.filter((l) => l.destino === "encargado" && l.destinoEmpleadoId === currentEmployee?.id);
  const llamadosPendientes = misLlamados.filter((l) => l.estado !== "solucionada");
  const llamadosAtendidos = misLlamados.filter((l) => l.estado === "solucionada");

  const llamadoColorStyles: Record<NotifColor, { text: string; bg: string; border: string }> = {
    red:    { text: "var(--red)",    bg: "var(--red-pale)",    border: "var(--red-border)" },
    orange: { text: "var(--orange, #f97316)", bg: "var(--orange-pale, rgba(249,115,22,0.12))", border: "var(--orange-border, rgba(249,115,22,0.32))" },
    yellow: { text: "var(--yellow)", bg: "var(--yellow-pale)", border: "var(--yellow-border)" },
    green:  { text: "var(--pine)",   bg: "var(--pine-pale)",   border: "var(--pine-border)" },
  };

  function renderLlamadoCard(l: Llamado) {
    const c = llamadoColorStyles[colorDeLlamado(l.estado)];
    return (
      <div
        key={l.id}
        className="notif-glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
        style={{ background: c.bg, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.text}` }}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: c.text, fontFamily: "'Outfit', sans-serif" }}>
            {l.empleadoNombre} ({l.empleadoRol}) llama desde {AREA_LABELS[l.area]}
          </p>
          {l.mensaje && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{l.mensaje}</p>
          )}
          <p className="font-display text-xs mt-0.5 tracking-wide" style={{ color: "var(--text-faint)" }}>
            {l.time} · Para: {l.destinoNombre}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {l.estado === "asignada" && (
            <button
              className="font-display px-2.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide"
              style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border-strong)" }}
              onClick={() => tomarLlamadoHandler(l.id)}
            >
              Tomar
            </button>
          )}
          {l.estado !== "solucionada" && (
            <button
              className="font-display px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide"
              style={{ background: "linear-gradient(135deg, var(--pine), var(--lime))", color: "#fff", border: "none" }}
              onClick={() => atenderLlamadoHandler(l.id)}
            >
              Atender
            </button>
          )}
          {l.estado === "solucionada" && isAdmin && (
            <button
              className="font-display px-2.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide"
              style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border-strong)" }}
              onClick={() => reabrirLlamadoHandler(l.id)}
            >
              Reabrir
            </button>
          )}
        </div>
      </div>
    );
  }

  // Empleado/Encargado: Asignada -> En proceso -> Solucionada (un solo botón que avanza).
  function advanceNotif(id: number) {
    const n = notifs.find((x) => x.id === id);
    if (!n) return;
    const esPrimerPaso = n.estado === "asignada";
    const accion = esPrimerPaso ? tomarNotificacion : resolverNotificacion;
    const nuevoEstado: NotifEstado = esPrimerPaso ? "en_proceso" : "solucionada";
    accion(id)
      .then(() => {
        setNotifs((prev) =>
          prev.map((x) =>
            x.id === id
              ? { ...x, estado: nuevoEstado, level: nuevoEstado === "solucionada" ? "green" : "yellow" }
              : x
          )
        );
      })
      .catch((err) => console.error("No se pudo actualizar la notificación:", err));
  }

  // Admin: cambia el estado libremente (incluye revertir una "Solucionada").
  function setEstadoNotif(id: number, estado: NotifEstado) {
    cambiarEstadoNotificacion(id, estado)
      .then(() => {
        setNotifs((prev) =>
          prev.map((x) => {
            if (x.id !== id) return x;
            const level: NotifLevel = estado === "solucionada" ? "green" : estado === "en_proceso" ? "yellow" : x.urgente ? "red" : "yellow";
            return { ...x, estado, level };
          })
        );
      })
      .catch((err) => console.error("No se pudo cambiar el estado de la notificación:", err));
  }

  // Admin: enviar a la papelera / restaurar.
  function eliminarNotif(id: number) {
    enviarNotificacionAPapelera(id)
      .then(() => setNotifs((prev) => prev.map((x) => (x.id === id ? { ...x, eliminado: true } : x))))
      .catch((err) => console.error("No se pudo eliminar la notificación:", err));
  }

  function restaurarNotif(id: number) {
    restaurarNotificacionDePapelera(id)
      .then(() => setNotifs((prev) => prev.map((x) => (x.id === id ? { ...x, eliminado: false } : x))))
      .catch((err) => console.error("No se pudo restaurar la notificación:", err));
  }

  // Corrección punto 7: agregar "Todas" para poder volver a ver todo con un clic,
  // sin depender de re-clickear la opción activa ni recargar la página.
  const filterOptions: { value: "all" | NotifEstado; label: string }[] = [
    { value: "all",         label: "Todas" },
    { value: "asignada",    label: "Asignada" },
    { value: "en_proceso",  label: "En proceso" },
    { value: "solucionada", label: "Solucionada" },
  ];

  const navItems = [
    {
      key: "notif",
      label: "Notificaciones",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
          <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6zm0 16a2 2 0 002-2H8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: "stats",
      label: "Estadísticas",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
      ),
    },
    {
      key: "global",
      label: "Dashboard Global",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
          <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zm0 8a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      key: "empleados",
      label: "Empleados",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
    },
    {
      key: "areas",
      label: "Áreas",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      key: "historial",
      label: "Historial",
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v5a1 1 0 00.4.8l3 2.2a1 1 0 101.2-1.6L11 9.5V5z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  const visibleNavItems = navItems.filter((b) => {
    if (b.key === "historial") return isAdmin;
    if (b.key === "empleados") return isAdmin;
    if (b.key === "areas") return isAdmin || currentEmployee?.role === "Encargado";
    return true;
  });

  return (
    <div
      className="size-full flex flex-col md:flex-row relative overflow-hidden theme-bg"
      style={{ fontFamily: "'Inter', sans-serif", transition: "background-color 0.4s" }}
    >
      {/* Textura de fondo — para que el sidebar y los modales de vidrio tengan algo que esmerilar */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: dark
            ? "radial-gradient(ellipse 60% 50% at 85% 10%, rgba(127,190,151,0.10) 0%, transparent 70%), radial-gradient(ellipse 50% 45% at 10% 90%, rgba(166,217,87,0.07) 0%, transparent 70%)"
            : "radial-gradient(ellipse 55% 60% at 0% 15%, rgba(31,102,64,0.24) 0%, transparent 65%), radial-gradient(ellipse 45% 50% at 12% 85%, rgba(111,191,62,0.20) 0%, transparent 65%), radial-gradient(ellipse 50% 45% at 90% 20%, rgba(31,102,64,0.14) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 95% 90%, rgba(111,191,62,0.12) 0%, transparent 70%)",
        }}
      />
      {!dark && (
        <div className="pointer-events-none fixed rounded-full" style={{ width: 380, height: 380, top: -120, left: -120, background: "var(--pine)", opacity: 0.14, filter: "blur(90px)" }} />
      )}
      <EcoBubbles dark={dark} density="low" />

      {/* CSS del drawer inyectado directamente (sin depender de clases nuevas de
          Tailwind) — así funciona aunque el build de Tailwind esté cacheado */}
      <style>{`
        .pa-sidebar-drawer {
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          z-index: 50;
          transform: translateX(-100%);
          transition: transform 0.3s ease-in-out;
        }
        .pa-sidebar-drawer.pa-sidebar-open {
          transform: translateX(0);
        }
        .pa-sidebar-overlay {
          display: none;
        }
        .pa-sidebar-overlay.pa-sidebar-open {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 40;
          background: rgba(0,0,0,0.5);
        }
        .pa-sidebar-close-btn { display: flex; }
        .pa-sensor-badges {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          width: 100%;
          margin-left: 0;
        }
        .pa-sensor-badge { width: 100%; justify-content: center; }
        .pa-kpi-chips {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .pa-kpi-chip { min-width: 0; }
        @media (min-width: 768px) {
          .pa-sidebar-drawer {
            position: relative;
            top: auto;
            bottom: auto;
            left: auto;
            z-index: 10;
            transform: none !important;
            transition: none;
          }
          .pa-sidebar-overlay.pa-sidebar-open { display: none; }
          .pa-sidebar-close-btn { display: none; }
          .pa-sensor-badges {
            display: flex;
            flex-wrap: wrap;
            width: auto;
            margin-left: 8px;
          }
          .pa-sensor-badge { width: auto; }
          .pa-kpi-chips {
            display: flex;
            flex-wrap: wrap;
          }
          .pa-kpi-chip { min-width: 130px; }
        }
      `}</style>

      {/* Overlay del drawer — solo mobile, cierra el panel al tocar afuera */}
      <div
        className={`pa-sidebar-overlay${sidebarOpen ? " pa-sidebar-open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div
        className={`glass aero-sheen pa-sidebar-drawer flex flex-col shrink-0 h-full${sidebarOpen ? " pa-sidebar-open" : ""}`}
        style={{
          width: 256,
          padding: "28px 16px 16px",
          borderRight: "1px solid var(--glass-border)",
          borderTop: "none",
          borderBottom: "none",
          borderLeft: "none",
        }}
      >
        {/* Botón cerrar — solo mobile */}
        <button
          className="pa-sidebar-close-btn absolute top-3 right-3 items-center justify-center rounded-full"
          style={{ width: 28, height: 28, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar panel"
        >
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 12, height: 12 }}>
            <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        {/* Contenido scrolleable — corrección punto 9: si el usuario tiene muchas
            áreas asignadas (ej. Admin con 3), esta parte scrollea en vez de
            empujar el botón de "Cerrar sesión" fuera de la pantalla. */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col" style={{ paddingRight: 2 }}>
        {/* Brand */}
        <div className="flex items-center gap-2 mb-6 px-2">
          <PineLogo size={22} />
          <span
            className="font-display text-sm font-semibold tracking-wide"
            style={{ color: "var(--pine)" }}
          >
            Parque Ambiental
          </span>
        </div>

        {/* Top border */}
        <div style={{ height: 1, background: "var(--border)", marginBottom: 20 }} />

        {/* Profile */}
        <div className="flex flex-col items-center mb-5 px-2">
          <div
            className="rounded-full overflow-hidden mb-3 relative"
            style={{
              width: 80,
              height: 80,
              border: "2.5px solid var(--pine-border)",
              boxShadow: "0 2px 16px var(--pine-border)",
              cursor: currentEmployee ? "pointer" : "default",
            }}
            onClick={() => currentEmployee && photoInputRef.current?.click()}
            title={currentEmployee ? "Cambiar foto de perfil" : undefined}
          >
            <img
              src={localPhoto || currentEmployee?.photo || profilePhoto}
              alt="Foto de perfil"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {currentEmployee && (
              <div
                className="absolute inset-x-0 bottom-0 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.55)", padding: "3px 0" }}
              >
                <span style={{ fontSize: 9, color: "#fff", fontFamily: "'Outfit', sans-serif" }}>Cambiar</span>
              </div>
            )}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file || !currentEmployee) return;
              const reader = new FileReader();
              reader.onload = () => {
                const base64 = reader.result as string;
                actualizarFotoEmpleado(currentEmployee.id, base64)
                  .then(() => setLocalPhoto(base64))
                  .catch((err) => console.error("No se pudo actualizar la foto:", err));
              };
              reader.readAsDataURL(file);
            }}
          />

          <h2
            className="text-sm font-bold text-center"
            style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text)" }}
          >
            {currentEmployee ? `${currentEmployee.name} ${currentEmployee.lastName ?? ""}`.trim() : "Administrador"}
          </h2>

          {/* Role badge */}
          <div className="flex gap-1.5 mt-2 flex-wrap justify-center">
            <span
              className="font-soft rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{
                background: "linear-gradient(135deg, var(--pine-pale), var(--lime-pale))",
                border: "1px solid var(--pine-border)",
                color: "var(--pine)",
              }}
            >
              {currentEmployee?.role ?? (isAdmin ? "Admin" : "Encargado")}
            </span>
          </div>

          {/* Areas */}
          <div className="mt-3 w-full space-y-1">
            {(currentEmployee ? currentEmployee.areas.map((a) => AREA_LABELS[a]) : AREAS).map((area) => (
              <div
                key={area}
                className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg"
                style={{ background: "var(--surface-2)" }}
              >
                <span
                  className="mt-0.5 shrink-0 rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    background: "var(--lime)",
                    display: "inline-block",
                  }}
                />
                <span
                  className="font-soft text-xs leading-tight font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  {area}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)", marginBottom: 12 }} />

        {/* Nav */}
        <div className="flex flex-col gap-1 flex-1">
          {visibleNavItems.map((btn) => {
            const active = activePage === btn.key;
            return (
              <button
                key={btn.key}
                className="font-display flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                style={{
                  background: active ? "linear-gradient(135deg, var(--pine-pale), var(--lime-pale))" : "transparent",
                  border: active ? "1px solid var(--pine-border)" : "1px solid transparent",
                  color: active ? "var(--pine)" : "var(--text-muted)",
                  boxShadow: active ? "0 2px 10px var(--pine-border)" : "none",
                }}
                onClick={() => { setActivePage(btn.key as typeof activePage); setSidebarOpen(false); }}
              >
                {btn.icon}
                {btn.label}
              </button>
            );
          })}
        </div>
        </div>
        {/* fin del contenido scrolleable */}

        {/* Logout — fuera del área scrolleable: siempre visible, anclado abajo del todo */}
        <div style={{ height: 1, background: "var(--border)", margin: "8px 0 8px" }} />
        <button
          className="shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
          style={{
            fontFamily: "'Outfit', sans-serif",
            color: "var(--red)",
            border: "1px solid transparent",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--red-pale)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--red-border)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
          }}
          onClick={onBack}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
            <path
              fillRule="evenodd"
              d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
              clipRule="evenodd"
            />
          </svg>
          Cerrar sesión
        </button>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden min-h-0">
        {/* Topbar — en mobile apila logo+menú arriba y baja paddings; en desktop es la barra de siempre */}
        <div
          className="glass aero-sheen flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3.5 shrink-0 gap-2"
          style={{ borderBottom: "1px solid var(--glass-border)", borderLeft: "none", borderRight: "none", borderTop: "none" }}
        >
          {/* Marca — solo visible en mobile; al tocarla abre el panel lateral como cajón deslizable */}
          <button
            className="flex md:hidden items-center gap-1.5 shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir panel lateral"
          >
            <PineLogo size={20} />
          </button>

          <div className="min-w-0">
            <h1
              className="text-base sm:text-lg font-bold truncate"
              style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text)", letterSpacing: "-0.01em" }}
            >
              {activePage === "notif" ? "Centro de Notificaciones"
                : activePage === "stats" ? "Estadísticas"
                : activePage === "global" ? "Dashboard Global"
                : activePage === "empleados" ? "Empleados"
                : activePage === "historial" ? "Historial"
                : "Áreas"}
            </h1>
            <p className="hidden sm:block font-display text-xs mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
              {new Date().toLocaleDateString("es-AR", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Consulta directa por WhatsApp */}
            <WhatsAppButton />
            {/* Dark mode toggle */}
            <ThemeToggle dark={dark} onToggle={toggleDark} />
          </div>
        </div>

        {/* Content area */}
        {activePage === "stats" ? (
          <StatsPage dark={dark} />
        ) : activePage === "global" ? (
          <GlobalDashboard isAdmin={isAdmin} role={role} />
        ) : activePage === "empleados" ? (
          <EmpleadosPage isAdmin={isAdmin} />
        ) : activePage === "areas" ? (
          <AreasPage isAdmin={isAdmin} canEditSensors={isAdmin || currentEmployee?.role === "Encargado"} />
        ) : activePage === "historial" ? (
          <HistorialPage />
        ) : (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
            {/* Filter row */}
            <div className="flex justify-between items-center mb-5">
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                {pendientes.length} notificaciones pendientes
              </p>
              <div className="flex items-center gap-2">
                {canConfigurarUmbrales && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all"
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      background: "var(--surface)",
                      border: "1px solid var(--border-strong)",
                      color: "var(--text-muted)",
                    }}
                    onClick={() => setShowUmbralesPanel(true)}
                    title="Configurar umbrales de sensores"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 11, height: 11 }}>
                      <path d="M8 1a1 1 0 011 1v1.1a5.5 5.5 0 011.6.66l.78-.78a1 1 0 111.42 1.42l-.78.78c.3.49.53 1.03.66 1.6H14a1 1 0 110 2h-1.32a5.5 5.5 0 01-.66 1.6l.78.78a1 1 0 11-1.42 1.42l-.78-.78a5.5 5.5 0 01-1.6.66V14a1 1 0 11-2 0v-1.32a5.5 5.5 0 01-1.6-.66l-.78.78a1 1 0 11-1.42-1.42l.78-.78a5.5 5.5 0 01-.66-1.6H2a1 1 0 110-2h1.32c.13-.57.36-1.11.66-1.6l-.78-.78A1 1 0 114.62 3l.78.78A5.5 5.5 0 017 3.1V2a1 1 0 011-1zm0 5a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                    Umbrales de sensores
                  </button>
                )}
                <div className="relative">
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all"
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    background: filterOpen ? "var(--pine-pale)" : "var(--surface)",
                    border: filterOpen
                      ? "1px solid var(--pine-border)"
                      : "1px solid var(--border-strong)",
                    color: filterOpen ? "var(--pine)" : "var(--text-muted)",
                  }}
                  onClick={() => setFilterOpen((v) => !v)}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 11, height: 11 }}>
                    <path d="M1 2h14l-5.5 7V14L6.5 13V9L1 2z" />
                  </svg>
                  Filtrar por Estado
                  <svg
                    viewBox="0 0 10 6"
                    fill="currentColor"
                    style={{
                      width: 7,
                      height: 7,
                      transform: filterOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  >
                    <path d="M0 0l5 6 5-6H0z" />
                  </svg>
                </button>

                {filterOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-50 animate-fade-up"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border-strong)",
                      boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
                      minWidth: 176,
                    }}
                  >
                    {filterOptions.map((opt) => (
                      <button
                        key={opt.value}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors"
                        style={{
                          color:
                            filter === opt.value ? "var(--pine)" : "var(--text-muted)",
                          background:
                            filter === opt.value ? "var(--pine-pale)" : "transparent",
                          fontFamily: "'Outfit', sans-serif",
                          fontWeight: filter === opt.value ? 600 : 400,
                        }}
                        onMouseEnter={(e) => {
                          if (filter !== opt.value)
                            (e.currentTarget as HTMLButtonElement).style.background =
                              "var(--surface-2)";
                        }}
                        onMouseLeave={(e) => {
                          if (filter !== opt.value)
                            (e.currentTarget as HTMLButtonElement).style.background =
                              "transparent";
                        }}
                        onClick={() => {
                          setFilter(opt.value);
                          setFilterOpen(false);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
                </div>
              </div>
            </div>

            {/* Groups */}
            <div className="flex flex-col gap-7">
              {/* Llamados de emergencia pendientes — solo Admin (destino=admin) y Encargado (dirigidos a mí) */}
              {canSeeLlamados && llamadosPendientes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: "var(--red)", display: "inline-block" }} />
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--red)" }}>
                      Llamados de Emergencia · {llamadosPendientes.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">{llamadosPendientes.map(renderLlamadoCard)}</div>
                </div>
              )}

              {/* 1 — Urgentes: siempre arriba de todo */}
              {urgentes.length > 0 && (
                <NotifGroup
                  title="Urgentes"
                  count={urgentes.length}
                  color="var(--red)"
                  dot="var(--red)"
                  items={urgentes}
                  role={role}
                  onAdvance={advanceNotif}
                  onSetEstado={setEstadoNotif}
                  onDelete={eliminarNotif}
                  showEmpleado
                />
              )}

              {/* 2 — Reporte de sensores (asignados/en proceso, no urgentes) */}
              {reportesSensores.length > 0 && (
                <NotifGroup
                  title="Reporte Sensores"
                  count={reportesSensores.length}
                  color="var(--text-muted)"
                  dot="var(--orange, #f97316)"
                  items={reportesSensores}
                  role={role}
                  onAdvance={advanceNotif}
                  onSetEstado={setEstadoNotif}
                  onDelete={eliminarNotif}
                />
              )}

              {/* 3 — Notificaciones generales (asignadas entre empleados/encargados/admin) */}
              {generales.length > 0 && (
                <NotifGroup
                  title="Notificaciones Generales"
                  count={generales.length}
                  color="var(--text-muted)"
                  dot="var(--orange, #f97316)"
                  items={generales}
                  role={role}
                  onAdvance={advanceNotif}
                  onSetEstado={setEstadoNotif}
                  onDelete={eliminarNotif}
                  showArea
                  showEmpleado
                />
              )}

              {/* 4 — Solucionadas: separado, al final, de solo lectura */}
              {solucionadas.length > 0 && (
                <NotifGroup
                  title="Solucionadas"
                  count={solucionadas.length}
                  color="var(--pine)"
                  dot="var(--pine)"
                  items={solucionadas}
                  role={role}
                  onSetEstado={setEstadoNotif}
                  onDelete={eliminarNotif}
                  collapsible
                  showArea
                  showEmpleado
                />
              )}

              {/* Papelera — solo Admin, colapsada por defecto */}
              {isAdmin && papelera.length > 0 && (
                <NotifGroup
                  title="Papelera"
                  count={papelera.length}
                  color="var(--text-faint)"
                  dot="var(--text-faint)"
                  items={papelera}
                  role={role}
                  onRestore={restaurarNotif}
                  inTrash
                  collapsible
                  showArea
                  showEmpleado
                />
              )}

              {/* Llamados atendidos — sección propia, siempre al final de todo, de solo lectura */}
              {canSeeLlamados && llamadosAtendidos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 cursor-pointer select-none" onClick={() => setLlamadosAtendidosOpen((v) => !v)}>
                    <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: "var(--pine)", display: "inline-block" }} />
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--pine)" }}>
                      Llamados atendidos · {llamadosAtendidos.length}
                    </span>
                    <button
                      className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all"
                      style={{ color: "var(--pine)", background: "var(--pine-pale)", border: "1px solid var(--pine-border)", fontFamily: "'Outfit', sans-serif" }}
                    >
                      {llamadosAtendidosOpen ? "Plegar" : "Desplegar"}
                      <svg viewBox="0 0 10 6" fill="currentColor" style={{ width: 8, height: 8, transform: llamadosAtendidosOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}>
                        <path d="M0 0l5 6 5-6H0z" />
                      </svg>
                    </button>
                  </div>
                  {llamadosAtendidosOpen && (
                    <div className="flex flex-col gap-2 animate-collapse">{llamadosAtendidos.map(renderLlamadoCard)}</div>
                  )}
                </div>
              )}

              {visible.length === 0 && (
                <div className="text-center py-16">
                  <p
                    className="text-sm"
                    style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-faint)" }}
                  >
                    No hay notificaciones para mostrar
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botón flotante para crear una tarea/notificación (admin y encargado) */}
        {canCreateTasks && (
          <button
            onClick={() => setShowTaskPanel(true)}
            className="fixed rounded-full flex items-center justify-center transition-all"
            style={{
              width: 56,
              height: 56,
              // Corrección punto 8: cuando el Encargado también tiene el botón de
              // Llamado de emergencia (más abajo), este queda al lado, no encima.
              right: (canLlamar || canLlamarAdmin) ? 96 : 28,
              bottom: 28,
              background: "linear-gradient(135deg, var(--pine), var(--pine-mid))",
              color: "#fff",
              border: "none",
              boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
              zIndex: 40,
            }}
            title="Crear tarea/notificación"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 22, height: 22 }}>
              <path d="M8 2a1 1 0 011 1v4h4a1 1 0 110 2H9v4a1 1 0 11-2 0V9H3a1 1 0 110-2h4V3a1 1 0 011-1z" />
            </svg>
          </button>
        )}

        {showTaskPanel && (
          <TaskFormModal
            restrictedAreas={isAdmin ? undefined : currentEmployee?.areas}
            onCancel={() => setShowTaskPanel(false)}
            onSave={(datos) => {
              crearNotificacion({ ...datos, emitidoPor: emitidoPorLabel })
                .then(() => {
                  setShowTaskPanel(false);
                  reloadNotifs();
                })
                .catch((err) => console.error("No se pudo crear la notificación:", err));
            }}
          />
        )}

        {showUmbralesPanel && (
          <UmbralesModal onClose={() => setShowUmbralesPanel(false)} />
        )}

        {/* Botón flotante de llamado de emergencia — Empleado (a Encargado o Admin) o Encargado (a Admin) */}
        {(canLlamar || canLlamarAdmin) && (
          <button
            onClick={() => setShowLlamarPanel(true)}
            className="fixed rounded-full flex items-center justify-center transition-all right-5 bottom-[88px] md:right-7 md:bottom-7"
            style={{
              width: 56,
              height: 56,
              background: "linear-gradient(135deg, var(--red), #b91c1c)",
              color: "#fff",
              border: "none",
              boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
              zIndex: 40,
            }}
            title="Llamado de emergencia"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 22, height: 22 }}>
              <path d="M2.5 2h2.4a1 1 0 011 .8l.5 2.5a1 1 0 01-.5 1.1l-1 .6a9 9 0 004.2 4.2l.6-1a1 1 0 011.1-.5l2.5.5a1 1 0 01.8 1V13.5a1 1 0 01-1 1C6.5 14.5 1.5 9.5 1.5 3a1 1 0 011-1z" />
            </svg>
          </button>
        )}

        {showLlamarPanel && currentEmployee && (
          <LlamarEncargadoModal
            areas={currentEmployee.areas}
            rol={currentEmployee.role as "Empleado" | "Encargado"}
            onCancel={() => setShowLlamarPanel(false)}
            onSave={(datos) => {
              crearLlamado({ empleadoId: currentEmployee.id, ...datos })
                .then(() => {
                  setShowLlamarPanel(false);
                  reloadLlamados();
                })
                .catch((err) => console.error("No se pudo enviar el llamado:", err));
            }}
          />
        )}
      </div>

      {/* Nav inferior — solo mobile, reemplaza al sidebar */}
      <MobileTabBar
        items={visibleNavItems}
        active={activePage}
        onSelect={(key) => setActivePage(key as typeof activePage)}
      />
    </div>
  );
}

// ─── Task Form Modal (crear notificación/tarea manual) ─────────────────────────
function TaskFormModal({
  restrictedAreas,
  onCancel,
  onSave,
}: {
  // Corrección punto 8: mismo formulario para Admin y Encargado. Si se pasa
  // `restrictedAreas` (las áreas del Encargado que abre el formulario), se oculta
  // la opción "General" y el selector de área queda limitado a esas áreas nomás.
  // Admin sigue llamando a este componente sin esta prop (undefined = sin límites).
  restrictedAreas?: AreaKey[];
  onCancel: () => void;
  onSave: (datos: {
    urgente: boolean;
    alcance: NotifAlcance;
    area?: string;
    empleadoIds?: number[];
    texto: string;
    descripcion?: string;
  }) => void;
}) {
  const [texto, setTexto] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [alcance, setAlcance] = useState<NotifAlcance>("area");
  const [area, setArea] = useState<AreaKey>(restrictedAreas?.[0] ?? "plantines");
  const [descripcion, setDescripcion] = useState("");
  const [empleados, setEmpleados] = useState<Employee[]>([]);
  const [empleadoIds, setEmpleadoIds] = useState<number[]>([]);

  const areasDisponibles: AreaKey[] = restrictedAreas && restrictedAreas.length > 0
    ? restrictedAreas
    : (["plantines", "nativos", "hidroponia"] as AreaKey[]);

  useEffect(() => {
    fetchEmpleados()
      .then((data) => setEmpleados(data))
      .catch((err) => console.error("No se pudieron cargar los empleados:", err));
  }, []);

  // Empleados de la misma área elegida (sección 6: "limitado a los empleados de la misma área elegida")
  const empleadosDeArea = empleados.filter((e) => e.areas.includes(area));

  function toggleEmpleado(id: number) {
    setEmpleadoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const fieldStyle: CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    background: "var(--surface)",
    color: "var(--text)",
    fontFamily: "'Outfit', sans-serif",
    fontSize: 13,
  };
  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 4,
    display: "block",
    fontFamily: "'Outfit', sans-serif",
  };

  const puedeGuardar =
    !!texto.trim() && (alcance !== "empleados" || empleadoIds.length > 0);

  function handleSave() {
    onSave({
      urgente,
      alcance,
      area: alcance === "general" ? undefined : area,
      empleadoIds: alcance === "empleados" ? empleadoIds : undefined,
      texto: texto.trim(),
      descripcion: descripcion.trim() || undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onCancel}
    >
      <div
        className="float-card aero-sheen rounded-2xl p-6 w-full max-w-md mx-4 overflow-y-auto"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--pine)" }}>
          Nueva tarea / notificación
        </h3>

        <div className="flex flex-col gap-3">
          <div>
            <label style={labelStyle}>Título de la tarea</label>
            <input style={fieldStyle} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="ej: Revisar riego del sector 2" />
          </div>

          <div>
            <label style={labelStyle}>Asignada / Urgente</label>
            <div className="flex gap-2">
              <button
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  background: !urgente ? "var(--orange-pale, rgba(249,115,22,0.12))" : "var(--surface-2)",
                  border: !urgente ? "1px solid var(--orange-border, rgba(249,115,22,0.32))" : "1px solid var(--border)",
                  color: !urgente ? "var(--orange, #f97316)" : "var(--text-faint)",
                }}
                onClick={() => setUrgente(false)}
              >
                Asignada
              </button>
              <button
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  background: urgente ? "var(--red-pale)" : "var(--surface-2)",
                  border: urgente ? "1px solid var(--red-border)" : "1px solid var(--border)",
                  color: urgente ? "var(--red)" : "var(--text-faint)",
                }}
                onClick={() => setUrgente(true)}
              >
                Urgente
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Alcance</label>
            <div className="flex gap-2">
              {([
                { value: "area", label: "Un área" },
                { value: "empleados", label: "Empleados" },
                ...(restrictedAreas ? [] : [{ value: "general" as NotifAlcance, label: "General" }]),
              ] as { value: NotifAlcance; label: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  className="flex-1 py-2 rounded-xl text-xs font-medium"
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    background: alcance === opt.value ? "var(--pine-pale)" : "var(--surface-2)",
                    border: alcance === opt.value ? "1px solid var(--pine-border)" : "1px solid var(--border)",
                    color: alcance === opt.value ? "var(--pine)" : "var(--text-faint)",
                  }}
                  onClick={() => { setAlcance(opt.value); setEmpleadoIds([]); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {alcance !== "general" && (
            <div>
              <label style={labelStyle}>Área</label>
              <select style={fieldStyle} value={area} onChange={(e) => { setArea(e.target.value as AreaKey); setEmpleadoIds([]); }}>
                {areasDisponibles.map((a) => (
                  <option key={a} value={a}>{AREA_LABELS[a]}</option>
                ))}
              </select>
            </div>
          )}

          {alcance === "empleados" && (
            <div>
              <label style={labelStyle}>Empleados del área elegida</label>
              <div
                className="flex flex-col gap-1 rounded-xl p-2"
                style={{ border: "1px solid var(--border)", maxHeight: 140, overflowY: "auto" }}
              >
                {empleadosDeArea.length === 0 && (
                  <p className="text-xs px-2 py-1" style={{ color: "var(--text-faint)" }}>
                    No hay empleados cargados en esta área.
                  </p>
                )}
                {empleadosDeArea.map((emp) => {
                  const checked = empleadoIds.includes(emp.id);
                  return (
                    <button
                      key={emp.id}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg text-sm"
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        background: checked ? "var(--pine-pale)" : "transparent",
                        color: checked ? "var(--pine)" : "var(--text)",
                      }}
                      onClick={() => toggleEmpleado(emp.id)}
                    >
                      <span>{emp.name} {emp.lastName ?? ""}</span>
                      {checked && (
                        <svg viewBox="0 0 12 10" fill="none" style={{ width: 12, height: 12 }}>
                          <path d="M1 5l3.5 3.5L11 1" stroke="var(--pine)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Descripción (opcional)</label>
            <textarea
              style={{ ...fieldStyle, minHeight: 70, resize: "vertical" }}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles adicionales de la tarea..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              fontFamily: "'Outfit', sans-serif",
              background: "linear-gradient(135deg, var(--pine), var(--pine-mid))",
              color: "#fff",
              border: "none",
              opacity: puedeGuardar ? 1 : 0.5,
            }}
            disabled={!puedeGuardar}
            onClick={handleSave}
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Umbrales de sensores (sección 8.1) ─────────────────────────────────────────
// Componente separado que solo llama a su propio endpoint (/api/umbrales), sin
// depender de tocar el gráfico de Estadísticas (por si otro proceso lo modifica
// en paralelo). Visible para Encargado y Admin.
function UmbralesModal({ onClose }: { onClose: () => void }) {
  const [umbrales, setUmbrales] = useState<UmbralSensor[]>([]);
  const [valores, setValores] = useState<Record<number, { minimo: string; maximo: string }>>({});
  const [cargando, setCargando] = useState(true);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUmbrales()
      .then((data) => {
        setUmbrales(data);
        const iniciales: Record<number, { minimo: string; maximo: string }> = {};
        for (const u of data) {
          iniciales[u.sensor_id] = {
            minimo: u.minimo != null ? String(u.minimo) : "",
            maximo: u.maximo != null ? String(u.maximo) : "",
          };
        }
        setValores(iniciales);
      })
      .catch((err) => console.error("No se pudieron cargar los umbrales:", err))
      .finally(() => setCargando(false));
  }, []);

  const fieldStyle: CSSProperties = {
    width: "100%",
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid var(--border-strong)",
    background: "var(--surface)",
    color: "var(--text)",
    fontFamily: "'Outfit', sans-serif",
    fontSize: 13,
  };
  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 4,
    display: "block",
    fontFamily: "'Outfit', sans-serif",
  };

  function actualizarValor(sensorId: number, campo: "minimo" | "maximo", valor: string) {
    setValores((prev) => ({ ...prev, [sensorId]: { ...prev[sensorId], [campo]: valor } }));
  }

  function guardar(sensorId: number) {
    const v = valores[sensorId] ?? { minimo: "", maximo: "" };
    if (!v.minimo.trim() && !v.maximo.trim()) {
      setError("Definí al menos un valor (mínimo o máximo).");
      return;
    }
    setError(null);
    setGuardandoId(sensorId);
    guardarUmbral(sensorId, {
      minimo: v.minimo.trim() ? Number(v.minimo) : null,
      maximo: v.maximo.trim() ? Number(v.maximo) : null,
    })
      .then(() => setGuardandoId(null))
      .catch((err) => {
        setError(err.message || "No se pudo guardar el umbral");
        setGuardandoId(null);
      });
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="float-card aero-sheen rounded-2xl p-6 w-full max-w-md mx-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold mb-1" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--pine)" }}>
          Umbrales de sensores
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-faint)" }}>
          Por sensor, global para toda la demo. La Temp. de Emergencia sigue con su propio umbral fijo (50°).
        </p>

        {cargando ? (
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Cargando...</p>
        ) : (
          <div className="flex flex-col gap-4">
            {umbrales.map((u) => (
              <div key={u.sensor_id} className="rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text)" }}>
                  {u.nombre}
                </p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label style={labelStyle}>Mínimo</label>
                    <input
                      style={fieldStyle}
                      type="number"
                      value={valores[u.sensor_id]?.minimo ?? ""}
                      onChange={(e) => actualizarValor(u.sensor_id, "minimo", e.target.value)}
                      placeholder="opcional"
                    />
                  </div>
                  <div className="flex-1">
                    <label style={labelStyle}>Máximo</label>
                    <input
                      style={fieldStyle}
                      type="number"
                      value={valores[u.sensor_id]?.maximo ?? ""}
                      onChange={(e) => actualizarValor(u.sensor_id, "maximo", e.target.value)}
                      placeholder="opcional"
                    />
                  </div>
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      background: "var(--pine)",
                      color: "#fff",
                      border: "none",
                      opacity: guardandoId === u.sensor_id ? 0.6 : 1,
                    }}
                    disabled={guardandoId === u.sensor_id}
                    onClick={() => guardar(u.sensor_id)}
                  >
                    {guardandoId === u.sensor_id ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs mt-3" style={{ color: "var(--red)" }}>{error}</p>
        )}

        <div className="flex justify-end mt-5">
          <button
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Llamado de Emergencia Modal ────────────────────────────────────────────────
// Empleado: elige área -> destino (un Encargado puntual de esa área, o el Admin).
// Encargado: solo puede llamar al Admin (no ve notificaciones comunes de
// empleados, y tampoco llama a otros encargados) — el destino queda fijo.
function LlamarEncargadoModal({
  areas,
  rol,
  onCancel,
  onSave,
}: {
  areas: AreaKey[];
  rol: "Empleado" | "Encargado";
  onCancel: () => void;
  onSave: (datos: { area: string; destino: LlamadoDestino; destinoEmpleadoId?: number; mensaje?: string }) => void;
}) {
  const [area, setArea] = useState<AreaKey>(areas[0] ?? "plantines");
  const [destino, setDestino] = useState<LlamadoDestino>(rol === "Encargado" ? "admin" : "encargado");
  const [encargados, setEncargados] = useState<Employee[]>([]);
  const [destinoEmpleadoId, setDestinoEmpleadoId] = useState<number | undefined>(undefined);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (rol === "Empleado") {
      fetchEmpleados()
        .then((data) => setEncargados(data.filter((e) => e.role === "Encargado")))
        .catch((err) => console.error("No se pudieron cargar los encargados:", err));
    }
  }, [rol]);

  const encargadosDeArea = encargados.filter((e) => e.areas.includes(area));

  useEffect(() => {
    // Si cambia el área y el encargado elegido ya no pertenece a ella, se resetea.
    if (destino === "encargado" && !encargadosDeArea.some((e) => e.id === destinoEmpleadoId)) {
      setDestinoEmpleadoId(encargadosDeArea[0]?.id);
    }
  }, [area, destino, encargados]);

  const fieldStyle: CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    background: "var(--surface)",
    color: "var(--text)",
    fontFamily: "'Outfit', sans-serif",
    fontSize: 13,
  };
  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 4,
    display: "block",
    fontFamily: "'Outfit', sans-serif",
  };

  const puedeEnviar = destino === "admin" || !!destinoEmpleadoId;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onCancel}
    >
      <div
        className="float-card aero-sheen rounded-2xl p-6 w-full max-w-md mx-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--red)" }}>
          Llamado de emergencia
        </h3>

        <div className="flex flex-col gap-3">
          <div>
            <label style={labelStyle}>Área</label>
            <select style={fieldStyle} value={area} onChange={(e) => setArea(e.target.value as AreaKey)}>
              {areas.map((a) => (
                <option key={a} value={a}>{AREA_LABELS[a]}</option>
              ))}
            </select>
          </div>

          {rol === "Empleado" && (
            <div>
              <label style={labelStyle}>Destino</label>
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 rounded-xl text-sm font-medium"
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    background: destino === "encargado" ? "var(--red-pale)" : "var(--surface-2)",
                    border: destino === "encargado" ? "1px solid var(--red-border)" : "1px solid var(--border)",
                    color: destino === "encargado" ? "var(--red)" : "var(--text-faint)",
                  }}
                  onClick={() => setDestino("encargado")}
                >
                  Mi Encargado
                </button>
                <button
                  className="flex-1 py-2 rounded-xl text-sm font-medium"
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    background: destino === "admin" ? "var(--red-pale)" : "var(--surface-2)",
                    border: destino === "admin" ? "1px solid var(--red-border)" : "1px solid var(--border)",
                    color: destino === "admin" ? "var(--red)" : "var(--text-faint)",
                  }}
                  onClick={() => setDestino("admin")}
                >
                  Admin
                </button>
              </div>
            </div>
          )}

          {rol === "Empleado" && destino === "encargado" && (
            <div>
              <label style={labelStyle}>Encargado</label>
              <select
                style={fieldStyle}
                value={destinoEmpleadoId ?? ""}
                onChange={(e) => setDestinoEmpleadoId(Number(e.target.value))}
              >
                {encargadosDeArea.length === 0 && <option value="">Sin encargados en esta área</option>}
                {encargadosDeArea.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} {e.lastName ?? ""}</option>
                ))}
              </select>
            </div>
          )}

          {rol === "Encargado" && (
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Este llamado se envía directo al Admin.
            </p>
          )}

          <div>
            <label style={labelStyle}>Mensaje (opcional)</label>
            <textarea
              style={{ ...fieldStyle, minHeight: 70, resize: "vertical" }}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="ej: Necesito ayuda urgente en el sector 3"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              fontFamily: "'Outfit', sans-serif",
              background: "linear-gradient(135deg, var(--red), #b91c1c)",
              color: "#fff",
              border: "none",
              opacity: puedeEnviar ? 1 : 0.5,
            }}
            disabled={!puedeEnviar}
            onClick={() => onSave({ area, destino, destinoEmpleadoId: destino === "encargado" ? destinoEmpleadoId : undefined, mensaje: mensaje.trim() || undefined })}
          >
            Llamar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Historial (Admin) — sección 5, Parte 2 ────────────────────────────────────
// Separado del Dashboard Global. Por ahora deja armadas dos vistas reales
// (Llamados, que se resuelve acá mismo; Sensores, en base a `lecturas_sensores`)
// y dos lugares reservados para cuando estén disponibles: la exportación a PDF
// y el historial de Notificaciones (se suma después, cuando la Parte 1 lo tenga listo).
// ─── Exportar Historial a PDF ───────────────────────────────────────────────────
// Siempre pregunta categoría/área/rango al abrirse (no depende de lo que esté
// filtrado en pantalla en ese momento) y hace su propio fetch con esos filtros.
const NOMBRE_SENSOR_EXPORT: Record<number, string> = {
  1: "Luz", 2: "Temperatura Ambiente", 3: "Humedad", 4: "Temperatura de Emergencia",
};

const ESTADO_LABEL: Record<NotifEstado, string> = {
  asignada: "Asignada",
  en_proceso: "En proceso",
  solucionada: "Solucionada",
};

function ExportarPdfModal({
  categoriaInicial,
  onClose,
}: {
  categoriaInicial: "llamados" | "sensores" | "notificaciones";
  onClose: () => void;
}) {
  const [categoria, setCategoria] = useState<"llamados" | "sensores" | "notificaciones">(categoriaInicial);
  const [areaFiltro, setAreaFiltro] = useState<AreaFilter>("all");
  const [rango, setRango] = useState<"hoy" | "semana" | "mes" | "custom" | "todo">("semana");
  const [diasCustom, setDiasCustom] = useState<number>(3);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function desdeDate(): Date | null {
    if (rango === "todo") return null;
    const ahora = new Date();
    const desde = new Date(ahora);
    if (rango === "hoy") desde.setHours(0, 0, 0, 0);
    else if (rango === "semana") desde.setDate(desde.getDate() - 7);
    else if (rango === "mes") desde.setDate(desde.getDate() - 30);
    else if (rango === "custom") desde.setDate(desde.getDate() - Math.max(1, diasCustom || 1));
    return desde;
  }

  function rangoLabel(): string {
    if (rango === "hoy") return "Hoy";
    if (rango === "semana") return "Última semana";
    if (rango === "mes") return "Último mes";
    if (rango === "custom") return `Últimos ${Math.max(1, diasCustom || 1)} día(s)`;
    return "Todo el historial";
  }

  async function generar() {
    setGenerando(true);
    setError(null);
    try {
      const desde = desdeDate();
      const areaLabel = areaFiltro === "all" ? "Todas las áreas" : AREA_LABELS[areaFiltro];

      const doc = new jsPDF();

      // ── Encabezado con marca (sección "más prolijo") ──
      // PINE_HEX: si tu variable CSS --pine tiene otro tono exacto, ajustalo acá.
      const PINE: [number, number, number] = [35, 90, 65];
      doc.setFillColor(...PINE);
      doc.rect(0, 0, 210, 28, "F");
      // Logo simplificado (pino con dos capas + tronco) en blanco, sin depender de un archivo de imagen.
      doc.setFillColor(255, 255, 255);
      doc.triangle(18, 5, 12, 15, 24, 15, "F");
      doc.triangle(18, 10, 11, 21, 25, 21, "F");
      doc.setFillColor(210, 200, 180);
      doc.rect(16.5, 21, 3, 4, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text("Parque Ambiental", 30, 14);
      doc.setFontSize(10);
      const tituloCategoria =
        categoria === "llamados" ? "Historial de Llamados de Emergencia" :
        categoria === "sensores" ? "Historial de Sensores (resumen)" :
        "Historial de Notificaciones";
      doc.text(tituloCategoria, 30, 21);

      doc.setTextColor(70, 70, 70);
      doc.setFontSize(9);
      const generadoEl = new Date().toLocaleString("es-AR");
      doc.text(`Generado el ${generadoEl}   ·   Área: ${areaLabel}   ·   Rango: ${rangoLabel()}`, 14, 36);

      let head: string[][] = [];
      let body: (string | number)[][] = [];

      if (categoria === "llamados") {
        const data = await fetchLlamados();
        const filtrados = data
          .filter((l) => areaFiltro === "all" || l.area === areaFiltro)
          .filter((l) => !desde || !l.creadoEn || new Date(l.creadoEn) >= desde);
        head = [["Fecha", "Empleado", "Rol", "Destino", "Área", "Estado", "Mensaje"]];
        body = filtrados.map((l) => [
          l.creadoEn ? new Date(l.creadoEn).toLocaleString("es-AR") : "-",
          l.empleadoNombre,
          l.empleadoRol ?? "-",
          l.destinoNombre ?? "-",
          AREA_LABELS[l.area],
          ESTADO_LABEL[l.estado],
          l.mensaje ?? "",
        ]);
      } else if (categoria === "notificaciones") {
        const data = await fetchNotificaciones();
        const filtrados = data
          .filter((n) => areaFiltro === "all" || n.area === areaFiltro)
          .filter((n) => !desde || !n.creadoEn || new Date(n.creadoEn) >= desde);
        head = [["Fecha", "Texto", "Área", "Emitida por", "Para", "Estado"]];
        body = filtrados.map((n) => [
          n.creadoEn ? new Date(n.creadoEn).toLocaleString("es-AR") : "-",
          n.text,
          n.area ? AREA_LABELS[n.area] : "General",
          n.emitidoPor || "—",
          n.alcance === "general"
            ? "General (todos)"
            : n.alcance === "empleados"
              ? (n.empleadoNombre ? `Empleado: ${n.empleadoNombre}` : "Empleado específico")
              : (n.area ? `Área completa: ${AREA_LABELS[n.area]}` : "Área completa"),
          ESTADO_LABEL[n.estado],
        ]);
      } else {
        const lecturas = await fetchLecturas(desde ? desde.toISOString() : undefined);
        // Los sensores de esta demo pertenecen todos al área Plantines (ver App.tsx / HistorialPage).
        const lecturasVálidas = (areaFiltro === "all" || areaFiltro === "plantines") ? lecturas : [];
        const porSensor = lecturasVálidas.reduce<Record<number, { count: number; min: number; max: number; sum: number }>>((acc, r) => {
          const valor = Number(r.valor);
          const s = acc[r.sensor_id] ?? { count: 0, min: Infinity, max: -Infinity, sum: 0 };
          s.count += 1;
          s.min = Math.min(s.min, valor);
          s.max = Math.max(s.max, valor);
          s.sum += valor;
          acc[r.sensor_id] = s;
          return acc;
        }, {});
        head = [["Sensor", "Lecturas", "Mínimo", "Máximo", "Promedio"]];
        body = Object.entries(porSensor).map(([id, s]) => [
          NOMBRE_SENSOR_EXPORT[Number(id)] || `Sensor ${id}`,
          s.count,
          s.count > 0 ? s.min.toFixed(1) : "-",
          s.count > 0 ? s.max.toFixed(1) : "-",
          s.count > 0 ? (s.sum / s.count).toFixed(1) : "-",
        ]);
        if (body.length === 0) {
          body = [["Sin datos en el rango elegido", "-", "-", "-", "-"]];
        }
      }

      autoTable(doc, {
        head,
        body,
        startY: 42,
        theme: "striped",
        headStyles: { fillColor: PINE, textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [244, 247, 245] },
        margin: { left: 14, right: 14 },
      });

      // Numeración de página, al final (ya sabemos cuántas páginas hay)
      const totalPaginas = doc.getNumberOfPages();
      for (let i = 1; i <= totalPaginas; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${totalPaginas}`, 196, 290, { align: "right" });
      }

      const fechaArchivo = new Date().toISOString().slice(0, 10);
      doc.save(`historial_${categoria}_${fechaArchivo}.pdf`);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No se pudo generar el PDF");
    } finally {
      setGenerando(false);
    }
  }

  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 4,
    display: "block",
    fontFamily: "'Outfit', sans-serif",
  };
  const fieldStyle: CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    background: "var(--surface)",
    color: "var(--text)",
    fontFamily: "'Outfit', sans-serif",
    fontSize: 13,
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="float-card aero-sheen rounded-2xl p-6 w-full max-w-md mx-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--pine)" }}>
          Exportar a PDF
        </h3>

        <div className="flex flex-col gap-3">
          <div>
            <label style={labelStyle}>Categoría</label>
            <div className="flex gap-2">
              {([
                { value: "llamados", label: "Llamados" },
                { value: "sensores", label: "Sensores" },
                { value: "notificaciones", label: "Notificaciones" },
              ] as { value: typeof categoria; label: string }[]).map((c) => (
                <button
                  key={c.value}
                  className="flex-1 py-2 rounded-xl text-xs font-medium"
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    background: categoria === c.value ? "var(--pine-pale)" : "var(--surface-2)",
                    border: categoria === c.value ? "1px solid var(--pine-border)" : "1px solid var(--border)",
                    color: categoria === c.value ? "var(--pine)" : "var(--text-faint)",
                  }}
                  onClick={() => setCategoria(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Área</label>
            <select style={fieldStyle} value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value as AreaFilter)}>
              <option value="all">Todas las áreas</option>
              <option value="plantines">Plantines</option>
              <option value="nativos">Árboles Nativos</option>
              <option value="hidroponia">Hidroponía</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Rango</label>
            <select style={fieldStyle} value={rango} onChange={(e) => setRango(e.target.value as typeof rango)}>
              <option value="hoy">Hoy</option>
              <option value="semana">Última semana</option>
              <option value="mes">Último mes</option>
              <option value="custom">Personalizado (días)</option>
              <option value="todo">Todo</option>
            </select>
          </div>

          {rango === "custom" && (
            <div>
              <label style={labelStyle}>Últimos... días</label>
              <input
                type="number"
                min={1}
                style={fieldStyle}
                value={diasCustom}
                onChange={(e) => setDiasCustom(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          )}

          {error && <p className="text-xs" style={{ color: "var(--red)" }}>{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ fontFamily: "'Outfit', sans-serif", background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              fontFamily: "'Outfit', sans-serif",
              background: "linear-gradient(135deg, var(--pine), var(--pine-mid))",
              color: "#fff",
              border: "none",
              opacity: generando ? 0.6 : 1,
            }}
            disabled={generando}
            onClick={generar}
          >
            {generando ? "Generando..." : "Generar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistorialPage() {
  // Corrección punto 5: "Notificaciones" pasa de placeholder deshabilitado a
  // categoría real — reutiliza fetchNotificaciones(), que ya trae área, emisor
  // (emitidoPor) y destinatario (alcance/área/empleado), guardados desde la
  // Parte 1 al crear la notificación. No hacía falta ningún endpoint nuevo.
  const [categoria, setCategoria] = useState<"llamados" | "sensores" | "notificaciones">("llamados");
  // Corrección punto 6: además de los rangos fijos, "custom" deja elegir la
  // cantidad de días a mano (ej. "últimos 3 días", "últimos 12 días").
  const [rango, setRango] = useState<"hoy" | "semana" | "mes" | "custom" | "todo">("semana");
  const [diasCustom, setDiasCustom] = useState<number>(3);
  const [areaFiltro, setAreaFiltro] = useState<AreaFilter>("all");

  const [llamados, setLlamados] = useState<Llamado[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notif[]>([]);
  const [lecturas, setLecturas] = useState<LecturaSensor[]>([]);
  const [cargando, setCargando] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  function desdeDate(): Date | null {
    if (rango === "todo") return null;
    const ahora = new Date();
    const desde = new Date(ahora);
    if (rango === "hoy") desde.setHours(0, 0, 0, 0);
    else if (rango === "semana") desde.setDate(desde.getDate() - 7);
    else if (rango === "mes") desde.setDate(desde.getDate() - 30);
    else if (rango === "custom") desde.setDate(desde.getDate() - Math.max(1, diasCustom || 1));
    return desde;
  }

  useEffect(() => {
    setCargando(true);
    if (categoria === "llamados") {
      fetchLlamados()
        .then((data) => setLlamados(data))
        .catch((err) => console.error("No se pudo cargar el historial de llamados:", err))
        .finally(() => setCargando(false));
    } else if (categoria === "notificaciones") {
      fetchNotificaciones()
        .then((data) => setNotificaciones(data))
        .catch((err) => console.error("No se pudo cargar el historial de notificaciones:", err))
        .finally(() => setCargando(false));
    } else {
      const d = desdeDate();
      fetchLecturas(d ? d.toISOString() : undefined)
        .then((data) => setLecturas(data))
        .catch((err) => console.error("No se pudo cargar el historial de sensores:", err))
        .finally(() => setCargando(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria, rango, diasCustom]);

  const desde = desdeDate();

  const llamadosFiltrados = llamados
    .filter((l) => areaFiltro === "all" || l.area === areaFiltro)
    .filter((l) => !desde || !l.creadoEn || new Date(l.creadoEn) >= desde);

  const notifsFiltradas = notificaciones
    .filter((n) => areaFiltro === "all" || n.area === areaFiltro)
    .filter((n) => !desde || !n.creadoEn || new Date(n.creadoEn) >= desde);

  // Corrección punto 5: cómo se muestra el destinatario de cada notificación
  // (área completa / empleado específico / general), con nombres, no ids.
  function destinoNotif(n: Notif): string {
    if (n.alcance === "general") return "General (todos)";
    if (n.alcance === "empleados") return n.empleadoNombre ? `Empleado: ${n.empleadoNombre}` : "Empleado específico";
    return n.area ? `Área completa: ${AREA_LABELS[n.area]}` : "Área completa";
  }

  const NOMBRE_SENSOR: Record<number, string> = {
    1: "Luz", 2: "Temperatura Ambiente", 3: "Humedad", 4: "Temperatura de Emergencia",
  };

  const porSensor = lecturas.reduce<Record<number, { count: number; min: number; max: number; sum: number }>>((acc, r) => {
    // Number(...) defensivo: la API ya normaliza `valor` a número (ver server.js),
    // pero si en algún momento vuelve a llegar como string (DECIMAL de MySQL),
    // sumarlo sin convertir haría concatenación de texto y el promedio daría NaN
    // — exactamente el bug del punto 4 ("Promedio NaN").
    const valor = Number(r.valor);
    const s = acc[r.sensor_id] ?? { count: 0, min: Infinity, max: -Infinity, sum: 0 };
    s.count += 1;
    s.min = Math.min(s.min, valor);
    s.max = Math.max(s.max, valor);
    s.sum += valor;
    acc[r.sensor_id] = s;
    return acc;
  }, {});

  const colorStyles: Record<NotifColor, { text: string; bg: string; border: string }> = {
    red:    { text: "var(--red)",    bg: "var(--red-pale)",    border: "var(--red-border)" },
    orange: { text: "var(--orange, #f97316)", bg: "var(--orange-pale, rgba(249,115,22,0.12))", border: "var(--orange-border, rgba(249,115,22,0.32))" },
    yellow: { text: "var(--yellow)", bg: "var(--yellow-pale)", border: "var(--yellow-border)" },
    green:  { text: "var(--pine)",   bg: "var(--pine-pale)",   border: "var(--pine-border)" },
  };

  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 4,
    display: "block",
    fontFamily: "'Outfit', sans-serif",
  };
  const fieldStyle: CSSProperties = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid var(--border-strong)",
    background: "var(--surface)",
    color: "var(--text)",
    fontFamily: "'Outfit', sans-serif",
    fontSize: 12,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar de filtros */}
      <div
        className="aero-sheen shrink-0 flex flex-wrap items-end gap-3 px-4 sm:px-6 py-4"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        <div className="flex gap-2">
          {([
            { key: "llamados", label: "Llamados" },
            { key: "sensores", label: "Sensores" },
            { key: "notificaciones", label: "Notificaciones" },
          ] as { key: "llamados" | "sensores" | "notificaciones"; label: string }[]).map((c) => (
            <button
              key={c.key}
              className="px-4 py-2 rounded-xl text-xs font-semibold"
              style={{
                fontFamily: "'Outfit', sans-serif",
                background: categoria === c.key ? "var(--pine-pale)" : "var(--surface)",
                border: categoria === c.key ? "1px solid var(--pine-border)" : "1px solid var(--border-strong)",
                color: categoria === c.key ? "var(--pine)" : "var(--text-muted)",
              }}
              onClick={() => setCategoria(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div>
          <label style={labelStyle}>Área</label>
          <select style={fieldStyle} value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value as AreaFilter)}>
            <option value="all">Todas las áreas</option>
            <option value="plantines">Plantines</option>
            <option value="nativos">Árboles Nativos</option>
            <option value="hidroponia">Hidroponía</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Rango</label>
          <select style={fieldStyle} value={rango} onChange={(e) => setRango(e.target.value as typeof rango)}>
            <option value="hoy">Hoy</option>
            <option value="semana">Última semana</option>
            <option value="mes">Último mes</option>
            <option value="custom">Personalizado (días)</option>
            <option value="todo">Todo</option>
          </select>
        </div>

        {rango === "custom" && (
          <div>
            <label style={labelStyle}>Últimos... días</label>
            <input
              type="number"
              min={1}
              style={{ ...fieldStyle, width: 90 }}
              value={diasCustom}
              onChange={(e) => setDiasCustom(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        )}

        <button
          className="font-display ml-auto px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide"
          style={{ background: "linear-gradient(135deg, var(--pine), var(--lime))", border: "none", color: "#fff", boxShadow: "0 4px 14px var(--pine-border)" }}
          onClick={() => setShowExportModal(true)}
        >
          Exportar a PDF
        </button>
      </div>

      {showExportModal && (
        <ExportarPdfModal categoriaInicial={categoria} onClose={() => setShowExportModal(false)} />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        {cargando ? (
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>Cargando...</p>
        ) : categoria === "llamados" ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>
              {llamadosFiltrados.length} llamados (incluye atendidos)
            </p>
            {llamadosFiltrados.map((l) => {
              const c = colorStyles[colorDeLlamado(l.estado)];
              return (
                <div
                  key={l.id}
                  className="notif-glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                  style={{ background: c.bg, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.text}` }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: c.text, fontFamily: "'Outfit', sans-serif" }}>
                      {l.empleadoNombre} ({l.empleadoRol}) → {l.destinoNombre} · {AREA_LABELS[l.area]}
                    </p>
                    {l.mensaje && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{l.mensaje}</p>}
                  </div>
                  <span className="font-display text-xs shrink-0 tracking-wide" style={{ color: "var(--text-faint)" }}>{l.time}</span>
                </div>
              );
            })}
            {llamadosFiltrados.length === 0 && (
              <p className="text-sm text-center py-16" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-faint)" }}>
                No hay llamados para mostrar
              </p>
            )}
          </div>
        ) : categoria === "notificaciones" ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>
              {notifsFiltradas.length} notificaciones
            </p>
            {notifsFiltradas.map((n) => {
              const c = colorStyles[colorDeNotificacion(n.estado, n.urgente)];
              return (
                <div
                  key={n.id}
                  className="notif-glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                  style={{ background: c.bg, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.text}` }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: c.text, fontFamily: "'Outfit', sans-serif" }}>
                      {n.text}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {n.area ? AREA_LABELS[n.area] : "General"} · Emitida por: {n.emitidoPor || "—"} · Para: {destinoNotif(n)}
                    </p>
                  </div>
                  <span className="font-display text-xs shrink-0 tracking-wide" style={{ color: "var(--text-faint)" }}>{n.time}</span>
                </div>
              );
            })}
            {notifsFiltradas.length === 0 && (
              <p className="text-sm text-center py-16" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-faint)" }}>
                No hay notificaciones para mostrar
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>
              {lecturas.length} lecturas en el rango elegido
              {areaFiltro !== "all" && areaFiltro !== "plantines" ? " — esta área todavía no tiene sensores propios en la demo" : ""}
            </p>
            {(areaFiltro === "all" || areaFiltro === "plantines") &&
              Object.entries(porSensor).map(([sensorId, s]) => (
                <div key={sensorId} className="float-card rounded-xl px-4 py-3 flex items-center justify-between" style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--lime)", background: "var(--surface)" }}>
                  <p className="text-sm font-semibold" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text)" }}>
                    {NOMBRE_SENSOR[Number(sensorId)] || `Sensor ${sensorId}`}
                  </p>
                  <div className="flex gap-4 items-baseline" style={{ color: "var(--text-muted)" }}>
                    {s.count > 0 ? (
                      <>
                        <span className="font-display text-xs">{s.count} lecturas</span>
                        <span className="font-organic text-lg font-medium" style={{ color: "var(--text)" }}>{s.min}<span className="text-xs font-display" style={{ color: "var(--text-faint)" }}> mín</span></span>
                        <span className="font-organic text-lg font-medium" style={{ color: "var(--text)" }}>{s.max}<span className="text-xs font-display" style={{ color: "var(--text-faint)" }}> máx</span></span>
                        <span className="font-organic text-lg font-medium" style={{ color: "var(--pine)" }}>{(s.sum / s.count).toFixed(1)}<span className="text-xs font-display" style={{ color: "var(--text-faint)" }}> prom</span></span>
                      </>
                    ) : (
                      <span className="text-xs">Sin datos</span>
                    )}
                  </div>
                </div>
              ))}
            {lecturas.length === 0 && (
              <p className="text-sm text-center py-16" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-faint)" }}>
                No hay lecturas para mostrar en este rango
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const { dark, toggleDark } = useTheme();

  return (
    <div className={`size-full ${dark ? "dark" : ""}`}>
      {page === "login" ? (
        <LoginPage
          onConfirm={(admin, employee) => { setIsAdmin(admin); setCurrentEmployee(employee); setPage("dashboard"); }}
          dark={dark}
          toggleDark={toggleDark}
        />
      ) : (
        <DashboardPage onBack={() => setPage("login")} dark={dark} toggleDark={toggleDark} isAdmin={isAdmin} currentEmployee={currentEmployee} />
      )}
    </div>
  );
}
