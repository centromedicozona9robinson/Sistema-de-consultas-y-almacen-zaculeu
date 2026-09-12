import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MUNICIPIO } from "../services/zonas";

const PALETA_DX = [
  "#006a71", "#00478d", "#5b3aa8", "#c2410c",
  "#be185d", "#334155", "#0e7490", "#7a5c00",
];

// Colores fijos para padecimientos comunes, de modo que "gripe" se vea siempre
// con el mismo color aunque esté en otra zona.
const colorPorDiagnostico = (norm) => {
  const n = (norm || "").toLowerCase();
  if (n.includes("gripe")) return "#ba1a1a";
  if (n.includes("diarrea") || n.includes("gastroenteritis")) return "#15803d";
  if (n.includes("dengue")) return "#f59e0b";
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return PALETA_DX[h % PALETA_DX.length];
};

// A más casos, más fuerte la intensidad (misma zona de color)
const opacidadPorCantidad = (c) => (c >= 6 ? 0.65 : c >= 3 ? 0.45 : 0.28);

const radioPorCantidad = (c) => Math.round(180 + Math.min(c, 12) * 22);

const tooltipHTML = (g) => {
  const filas = (g.pacientes || [])
    .slice(0, 12)
    .map((n) => `<li>${n}</li>`)
    .join("");
  const adicional = (g.pacientes?.length || 0) > 12
    ? `<li class="leaflet-tooltip-mas">y ${(g.pacientes.length - 12)} más…</li>`
    : "";
  return `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; line-height: 1.35; min-width: 170px;">
      <div style="font-weight: 700; color: #ba1a1a; font-size: 13px;">${g.diagnostico}</div>
      <div style="color: #424752; margin: 2px 0 4px;">${g.zona} · <b>${g.cantidad}</b> paciente(s)${g.consultas > g.cantidad ? ` · ${g.consultas} consulta(s)` : ""}</div>
      <ul style="padding-left: 18px; margin: 0; color: #191c1e;">${filas}${adicional}</ul>
    </div>`;
};

export default function MapaBrotes({ grupos, enfermedades = [], ocultos = new Set(), onToggle }) {
  const contenedorRef = useRef(null);
  const mapRef = useRef(null);
  const capaRef = useRef(null);

  useEffect(() => {
    if (!contenedorRef.current || mapRef.current) return;
    const map = L.map(contenedorRef.current, { scrollWheelZoom: false }).setView(
      [MUNICIPIO.centroSalud.lat, MUNICIPIO.centroSalud.lng],
      14
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    capaRef.current = L.featureGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      capaRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const capa = capaRef.current;
    if (!map || !capa) return;

    capa.clearLayers();

    L.circleMarker(
      [MUNICIPIO.centroSalud.lat, MUNICIPIO.centroSalud.lng],
      { radius: 7, color: "#00478d", weight: 2, fillColor: "#005eb8", fillOpacity: 1 }
    )
      .bindTooltip(
        `<b>${MUNICIPIO.centroSalud.nombre}</b><br/>${MUNICIPIO.nombre}`,
        { direction: "top", offset: [0, -8] }
      )
      .addTo(capa);

    const conteoPorZona = {};
    grupos.forEach((g) => {
      conteoPorZona[g.zona] = (conteoPorZona[g.zona] || 0) + 1;
    });

    // Dibuja primero los pequeños para que los de más casos queden encima
    const ordenados = [...grupos].sort((a, b) => a.cantidad - b.cantidad);

    ordenados.forEach((g) => {
      const totalZona = conteoPorZona[g.zona] || 1;
      const idx = ordenados.filter((x) => x.zona === g.zona).indexOf(g);
      const sep = 0.004;
      const angulo = totalZona > 1 ? (idx / totalZona) * Math.PI * 2 - Math.PI / 2 : 0;
      const lat = totalZona > 1 ? g.lat + Math.sin(angulo) * sep : g.lat;
      const lng = totalZona > 1 ? g.lng + Math.cos(angulo) * sep : g.lng;

      L.circle([lat, lng], {
        radius: radioPorCantidad(g.cantidad),
        color: colorPorDiagnostico(g.norm),
        weight: 2,
        fillColor: colorPorDiagnostico(g.norm),
        fillOpacity: opacidadPorCantidad(g.cantidad),
      })
        .bindTooltip(tooltipHTML(g), { direction: "top", offset: [0, -10] })
        .addTo(capa);
    });

    if (grupos.length > 0) {
      map.fitBounds(capa.getBounds(), { padding: [35, 35], maxZoom: 15 });
    } else {
      map.setView([MUNICIPIO.centroSalud.lat, MUNICIPIO.centroSalud.lng], 14);
    }
  }, [grupos]);

  const todasOcultas = (enfermedades || []).every((l) => ocultos.has(l.norm));

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={contenedorRef}
        className="w-full rounded-lg border border-[#c2c6d4]"
        style={{ height: 460, zIndex: 0 }}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#424752]">
        <span className="font-semibold text-[#191c1e]">Padecimientos:</span>
        {enfermedades.slice(0, 8).map((l) => (
          <span
            key={l.norm}
            role="button"
            tabIndex={0}
            onClick={() => onToggle(l.norm)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onToggle(l.norm);
            }}
            title={ocultos.has(l.norm) ? "Clic para mostrar en el mapa" : "Clic para ocultar del mapa"}
            className={`flex items-center gap-1.5 cursor-pointer select-none rounded px-1 py-0.5 transition-opacity ${
              ocultos.has(l.norm) ? "opacity-40 line-through" : "hover:bg-[#f2f3f7]"
            }`}
          >
            <span
              className="w-3 h-3 rounded-full inline-block border border-[#c2c6d4]"
              style={{ backgroundColor: l.color }}
            />
            {l.label}
            <span className="text-[10px] text-[#8a8f9a]">
              {!ocultos.has(l.norm) && (l.cantidad || 0)}
            </span>
          </span>
        ))}
        {enfermedades.length > 8 && <span>y {enfermedades.length - 8} más…</span>}
        <span className="w-full sm:w-auto text-[#8a8f9a]">
          Solo se muestran padecimientos con 5 o más pacientes. Haz clic en uno para
          ocultarlo o mostrarlo en el mapa.
        </span>
        {grupos.length === 0 && !todasOcultas && (
          <span className="w-full sm:w-auto">
            No hay padecimientos con 5 o más pacientes ni ubicación reconocible en el período
            seleccionado. El círculo azul marca el centro médico.
          </span>
        )}
        {todasOcultas && enfermedades.length > 0 && (
          <span className="w-full sm:w-auto">
            Todos los padecimientos están ocultos. Haz clic en la leyenda para mostrarlos.
          </span>
        )}
      </div>
    </div>
  );
}