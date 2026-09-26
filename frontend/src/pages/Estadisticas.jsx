import React, { useState, useEffect, useMemo } from "react";
import {
  CalendarDays, Users, UserCheck, AlertTriangle, Pill, Loader2,
  Activity, BarChart3, RefreshCw, Check, EyeOff,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Cell, PieChart, Pie, Legend,
} from "recharts";
import { api } from "../services/api";
import Layout from "../components/Layout";
import MapaBrotes from "../components/MapaBrotes";
import { CATALOGO_LUGARES, LUGARES } from "../services/zonas";

const PALETA = {
  azul: "#00478d",
  azulClaro: "#005eb8",
  celeste: "#d0e1fb",
  verde: "#006a71",
  verdeClaro: "#c7f0f4",
  rojo: "#ba1a1a",
  rojoClaro: "#ffdad6",
  ambar: "#f59e0b",
  amberClaro: "#fde7c2",
  neutral: "#424752",
  gris: "#c2c6d4",
};

const rangos = {
  "7 días": 7,
  "30 días": 30,
  "90 días": 90,
};

function fechaLocalISO(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function hoyISO() {
  return fechaLocalISO(new Date());
}

function inicioISO(dias) {
  const d = new Date();
  d.setDate(d.getDate() - (dias - 1));
  return fechaLocalISO(d);
}

const formatFechaCorta = (fecha) => {
  const [y, m, d] = fecha.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-GT", { day: "2-digit", month: "short" });
};

// Palabras sin significado clínico que impiden unir diagnósticos iguales
const PALABRAS_RUIDO = new Set([
  "de", "del", "con", "sin", "para", "por", "en", "el", "la", "los", "las",
  "un", "una", "unos", "unas", "y", "e", "o", "u", "a", "al", "que", "cual",
  "tiene", "tuvo", "tenia", "es", "era", "paciente", "presenta", "presento",
  "presentaba", "diagnostico", "dx", "motivo", "consulta", "control",
  "valoracion", "segun", "refiere",
]);

// Normaliza el diagnóstico: minúsculas, sin tildes ni puntuación, sin ruido
const normalizarDiagnostico = (texto) => {
  const norm = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !PALABRAS_RUIDO.has(w) && !/^\d+$/.test(w))
    .join(" ");
  return norm || texto.toLowerCase().trim();
};

// Dos diagnósticos son "iguales" si comparten todas las palabras de la
// versión más corta (p. ej. "gripe" y "tiene gripe" → "gripe").
const sonSimilares = (normA, normB) => {
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  const pa = normA.split(" ");
  const pb = normB.split(" ");
  const menor = pa.length <= pb.length ? pa : pb;
  const mayor = pa.length <= pb.length ? pb : pa;
  return menor.every((w) => mayor.includes(w));
};

// Agrupa los diagnósticos similares, conservando como etiqueta el texto
// más usado del grupo.
const agruparDiagnosticos = (lista) => {
  const grupos = [];
  for (const item of lista) {
    const norm = normalizarDiagnostico(item.diagnostico);
    let grupo = grupos.find((g) => sonSimilares(g.norm, norm));
    if (!grupo) {
      grupo = { norm, items: [] };
      grupos.push(grupo);
    }
    grupo.items.push({ ...item, norm });
  }
  return grupos
    .map((g) => {
      const total = g.items.reduce((s, i) => s + i.cantidad, 0);
      const mejor = [...g.items].sort(
        (a, b) => b.cantidad - a.cantidad || a.diagnostico.length - b.diagnostico.length
      )[0];
      return { diagnostico: mejor.diagnostico, cantidad: total };
    })
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);
};

const NUMEROS_ZONA = {
  uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};

const PALETA_DX = [
  "#006a71", "#00478d", "#5b3aa8", "#c2410c",
  "#be185d", "#334155", "#0e7490", "#7a5c00",
];
const colorPorDiagnostico = (norm) => {
  const n = (norm || "").toLowerCase();
  if (n.includes("gripe")) return "#ba1a1a";
  if (n.includes("diarrea") || n.includes("gastroenteritis")) return "#15803d";
  if (n.includes("dengue")) return "#f59e0b";
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return PALETA_DX[h % PALETA_DX.length];
};

// Solo se dibujan en el mapa los padecimientos con al menos este número de
// pacientes (en total, sumando todas las zonas del período).
const UMBRAL_BROTE = 5;

// Resuelve la localidad de una dirección: primero "Zona N" (número o palabra),
// luego lugares del catálogo (aldeas/municipios como Chiantla) por palabra clave,
// y por último las coordenadas exactas geocodificadas por el backend.
const extraerLocalidad = (direccion) => {
  if (!direccion) return null;
  const patZona =
    direccion.match(/zona\s*(\d{1,2})\b/i) ||
    direccion.match(/zona\s*(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/i);
  if (patZona) {
    const num = /^\d+$/.test(patZona[1])
      ? Number(patZona[1])
      : NUMEROS_ZONA[patZona[1].toLowerCase()];
    return CATALOGO_LUGARES[`Zona ${num}`] || null;
  }
  for (const lugar of LUGARES) {
    if (lugar.patron.test(direccion)) return lugar;
  }
  return null;
};

// Resuelve una fila del mapa a una ubicación dibujable:
// catálogo (zona/lugar) o coordenadas geocodificadas del backend.
const resolverUbicacion = (fila) => {
  const loc = extraerLocalidad(fila.direccion);
  if (loc) return loc;
  if (fila.lat != null && fila.lng != null) {
    const nombre = fila.lugar || fila.direccion;
    return {
      clave: `GEO|${fila.direccion}`,
      nombre,
      lat: Number(fila.lat),
      lng: Number(fila.lng),
    };
  }
  return null;
};

const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #c2c6d4",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#191c1e",
};

export default function Estadisticas() {
  const [rangoDias, setRangoDias] = useState(30);
  const [desde, setDesde] = useState(inicioISO(30));
  const [hasta, setHasta] = useState(hoyISO());
  const [loading, setLoading] = useState(true);
  const [cargandoMapa, setCargandoMapa] = useState(false);
  const [error, setError] = useState(null);
  const [visitas, setVisitas] = useState({ diario: [], resumen: {} });
  const [medicamentos, setMedicamentos] = useState({ top: [], total_unidades: 0 });
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [pacientes, setPacientes] = useState({});
  const [mapa, setMapa] = useState([]);
  const [visibles, setVisibles] = useState({ total: true, completadas: true });

  const alternarSerie = (clave) => setVisibles((v) => ({ ...v, [clave]: !v[clave] }));

  const cargarDatos = async (d, h) => {
    setLoading(true);
    setError(null);
    try {
      const [v, m, diag, p] = await Promise.all([
        api.getEstadisticasVisitas(d, h),
        api.getEstadisticasMedicamentos(d, h),
        api.getEstadisticasDiagnosticos(d, h),
        api.getEstadisticasPacientes(),
      ]);
      setVisitas(v);
      setMedicamentos(m);
      setDiagnosticos(diag);
      setPacientes(p);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las estadísticas. Verifique la conexión con el backend.");
    } finally {
      setLoading(false);
    }
  };

  // El mapa de brotes se carga en paralelo, de forma independiente: no bloquea
  // el render de las tarjetas y gráficas del resto de la página.
  const cargarMapa = async (d, h) => {
    setCargandoMapa(true);
    setMapa([]);
    try {
      const mp = await api.getEstadisticasMapa(d, h);
      setMapa(mp);
    } catch (err) {
      console.error(err);
    } finally {
      setCargandoMapa(false);
    }
  };

  useEffect(() => {
    cargarDatos(desde, hasta);
    cargarMapa(desde, hasta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarRango = (dias) => {
    const d = inicioISO(dias);
    const h = hoyISO();
    setRangoDias(dias);
    setDesde(d);
    setHasta(h);
    cargarDatos(d, h);
    cargarMapa(d, h);
  };

  const kpis = [
    {
      label: "Visitas en el período",
      value: visitas.resumen.total_visitas ?? "—",
      sub: `${formatFechaCorta(desde)} — ${formatFechaCorta(hasta)}`,
      icon: CalendarDays,
      iconBg: "bg-[#d0e1fb]",
      borderColor: "border-l-[#005eb8]",
      valueColor: "text-[#00478d]",
    },
    {
      label: "Pacientes únicos atendidos",
      value: visitas.resumen.pacientes_unicos ?? "—",
      sub: "Con visita registrada",
      icon: Users,
      iconBg: "bg-[#c7f0f4]",
      borderColor: "border-l-[#006a71]",
      valueColor: "text-[#006a71]",
    },
    {
      label: "Consultas completadas",
      value: visitas.resumen.consultas_completadas ?? "—",
      sub: "Con diagnóstico médico",
      icon: UserCheck,
      iconBg: "bg-[#d0e1fb]",
      borderColor: "border-l-[#00478d]",
      valueColor: "text-[#00478d]",
    },
    {
      label: "Unidades dispensadas",
      value: medicamentos.total_unidades ?? "—",
      sub: "Medicamentos entregados",
      icon: Pill,
      iconBg: "bg-[#ffdad6]",
      borderColor: "border-l-[#ba1a1a]",
      valueColor: "text-[#ba1a1a]",
    },
  ];

  const chartsData = useMemo(() => {
    const diario = (visitas.diario || []).map((v) => ({
      ...v,
      fecha: formatFechaCorta(v.fecha),
    }));
    const topMeds = (medicamentos.top || []).map((m) => ({
      nombre: m.nombre.length > 22 ? m.nombre.slice(0, 21) + "…" : m.nombre,
      unidades: m.unidades_dispensadas,
    }));
    const diags = agruparDiagnosticos(diagnosticos || []).map((d) => ({
      diagnostico: d.diagnostico.length > 26 ? d.diagnostico.slice(0, 25) + "…" : d.diagnostico,
      cantidad: d.cantidad,
    }));
    return { diario, topMeds, diags };
  }, [visitas, medicamentos, diagnosticos]);

  const mapaGrupos = useMemo(() => {
    const conUbicacion = [];
    (mapa || []).forEach((r) => {
      const loc = resolverUbicacion(r);
      if (!loc) return;
      conUbicacion.push({
        r,
        loc,
        norm: normalizarDiagnostico(r.diagnostico),
      });
    });

    const frecuencia = {};
    conUbicacion.forEach(({ norm }) => {
      frecuencia[norm] = (frecuencia[norm] || 0) + 1;
    });
    const normas = Object.keys(frecuencia).sort(
      (a, b) => frecuencia[b] - frecuencia[a] || a.length - b.length
    );
    const representante = {};
    normas.forEach((n) => {
      const padre = normas.find(
        (m) => representante[m] === m && sonSimilares(m, n)
      );
      representante[n] = padre || n;
    });

    const porLugar = {};
    conUbicacion.forEach(({ r, loc, norm }) => {
      const raiz = representante[norm] || norm;
      const clave = `${loc.clave}|${raiz}`;
      if (!porLugar[clave]) porLugar[clave] = { loc, raiz, items: [] };
      porLugar[clave].items.push({
        nombre_completo: r.nombre_completo,
        diagnostico: r.diagnostico,
      });
    });

    const resultado = [];
    Object.values(porLugar).forEach(({ loc, raiz, items }) => {
      const textoFrec = {};
      const pacientes = [];
      let consultas = 0;
      items.forEach((it) => {
        textoFrec[it.diagnostico] = (textoFrec[it.diagnostico] || 0) + 1;
        consultas += 1;
        if (!pacientes.includes(it.nombre_completo)) {
          pacientes.push(it.nombre_completo);
        }
      });
      const label = Object.entries(textoFrec).sort(
        (a, b) => b[1] - a[1] || a[0].length - b[0].length
      )[0][0];
      resultado.push({
        clave: loc.clave,
        zona: loc.nombre,
        lat: loc.lat,
        lng: loc.lng,
        norm: raiz,
        diagnostico: label,
        pacientes,
        cantidad: pacientes.length,
        consultas,
      });
    });
    const totalPorNorm = {};
    resultado.forEach((g) => {
      totalPorNorm[g.norm] = (totalPorNorm[g.norm] || 0) + g.cantidad;
    });
    return resultado
      .filter((g) => (totalPorNorm[g.norm] || 0) >= UMBRAL_BROTE)
      .sort(
        (a, b) => b.cantidad - a.cantidad || a.zona.localeCompare(b.zona)
      );
  }, [mapa]);

  const [ocultos, setOcultos] = useState(() => new Set());

  const togglePadecimiento = (norm) => {
    setOcultos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(norm)) siguiente.delete(norm);
      else siguiente.add(norm);
      return siguiente;
    });
  };

  const enfermedades = useMemo(() => {
    const lista = [];
    mapaGrupos.forEach((g) => {
      const l = lista.find((x) => x.norm === g.norm);
      if (l) l.cantidad += g.cantidad;
      else lista.push({
        norm: g.norm,
        label: g.diagnostico,
        color: colorPorDiagnostico(g.norm),
        cantidad: g.cantidad,
      });
    });
    return lista;
  }, [mapaGrupos]);

  const mapaVisibles = useMemo(
    () => mapaGrupos.filter((g) => !ocultos.has(g.norm)),
    [mapaGrupos, ocultos]
  );

  return (
    <Layout activePath="/estadisticas">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-bold text-2xl sm:text-[32px]">Estadísticas y Reportes</h1>
          <div className="text-sm text-[#424752] mt-1 flex items-center gap-1.5">
            <BarChart3 size={15} className="text-[#006a71]" />
            Análisis del flujo de pacientes, consultas y farmacia.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(rangos).map(([label, dias]) => (
            <button
              key={label}
              onClick={() => aplicarRango(dias)}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors border ${
                rangoDias === dias
                  ? "bg-[#00478d] text-white border-[#00478d]"
                  : "bg-white text-[#424752] border-[#c2c6d4] hover:bg-[#f2f4f6]"
              }`}
            >
              {label}
            </button>
          ))}
          <div className="flex items-center gap-1.5 bg-white border border-[#c2c6d4] rounded-md px-2 py-1">
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="text-sm outline-none bg-transparent"
            />
            <span className="text-[#424752]">—</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="text-sm outline-none bg-transparent"
            />
            <button
              onClick={() => {
                cargarDatos(desde, hasta);
                cargarMapa(desde, hasta);
              }}
              className="p-1.5 rounded-md bg-[#d0e1fb] text-[#00478d] hover:bg-[#c3d7f2] transition-colors"
              title="Aplicar rango"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-[#ffdad6] border border-[#ba1a1a]/30 text-[#8a1313] rounded-lg p-4 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5 mb-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`bg-white border border-[#c2c6d4] border-l-4 ${k.borderColor} rounded-lg p-5 flex justify-between items-start`}
          >
            <div>
              <div className="font-semibold text-sm text-[#424752]">{k.label}</div>
              <div className={`font-bold text-[32px] mt-1.5 ${k.valueColor}`}>{k.value}</div>
              <div className="text-xs text-[#424752] mt-1.5">{k.sub}</div>
            </div>
            <div className={`w-11 h-11 rounded-md ${k.iconBg} flex items-center justify-center shrink-0`}>
              <k.icon size={20} className="text-[#00478d]" />
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#424752] bg-white border border-[#c2c6d4] rounded-lg">
          <Loader2 size={32} className="animate-spin mb-3 text-[#00478d]" />
          <p className="font-semibold">Cargando estadísticas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Card
            title="Visitas por día"
            subtitle="Marca o desmarca cada serie para comparar el total de visitas con las completadas"
            className="xl:col-span-2"
          >
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {[
                { clave: "total", label: "Visitas", color: PALETA.azul },
                { clave: "completadas", label: "Completadas", color: PALETA.ambar },
              ].map((s) => {
                const activo = visibles[s.clave];
                return (
                  <button
                    key={s.clave}
                    onClick={() => alternarSerie(s.clave)}
                    className={`flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full text-sm font-bold border transition-all cursor-pointer ${
                      activo ? "bg-white shadow-sm" : "bg-[#f2f4f6] opacity-45"
                    }`}
                    style={{ borderColor: activo ? s.color : PALETA.gris }}
                    title={activo ? `Ocultar "${s.label}"` : `Mostrar "${s.label}"`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full inline-block"
                      style={{ backgroundColor: activo ? s.color : PALETA.gris }}
                    />
                    {s.label}
                    {activo ? (
                      <Check size={15} className="text-[#006a71]" />
                    ) : (
                      <EyeOff size={15} className="text-[#424752]" />
                    )}
                  </button>
                );
              })}
            </div>
            {chartsData.diario.every((d) => d.total === 0) ? (
              <EmptyChart texto="No hay visitas registradas en el período seleccionado." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartsData.diario} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    {visibles.total && (
                      <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PALETA.azul} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={PALETA.azul} stopOpacity={0} />
                      </linearGradient>
                    )}
                    {visibles.completadas && (
                      <linearGradient id="gCompletadas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PALETA.ambar} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={PALETA.ambar} stopOpacity={0} />
                      </linearGradient>
                    )}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: PALETA.neutral }} tickLine={false} axisLine={{ stroke: PALETA.gris }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: PALETA.neutral }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  {visibles.total && (
                    <Area type="monotone" dataKey="total" name="Visitas" stroke={PALETA.azul} strokeWidth={2} fill="url(#gTotal)" />
                  )}
                  {visibles.completadas && (
                    <Area type="monotone" dataKey="completadas" name="Completadas" stroke={PALETA.ambar} strokeWidth={2} fill="url(#gCompletadas)" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card
            title="Top medicamentos dispensados"
            subtitle="Los 10 medicamentos más entregados en el período"
          >
            {chartsData.topMeds.length === 0 ? (
              <EmptyChart texto="Aún no hay dispensaciones registradas en el período." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartsData.topMeds} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: PALETA.neutral }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    width={135}
                    tick={{ fontSize: 10, fill: PALETA.neutral }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} unidades`, "Dispensado"]} />
                  <Bar dataKey="unidades" fill={PALETA.azul} radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Demografía de pacientes" subtitle="Distribución por sexo, edad y condición crónica">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="text-xs font-semibold text-[#424752] uppercase tracking-wide mb-1">
                  Por Sexualidad:
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pacientes.por_sexo || []}
                      dataKey="valor"
                      nameKey="nombre"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      label={(entrada) => entrada.valor}
                      labelLine={false}
                    >
                      {(pacientes.por_sexo || []).map((_, i) => (
                        <Cell key={i} fill={i === 0 ? PALETA.azul : PALETA.verde} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                {pacientes.cronicos > 0 && (
                  <div className="mt-2 text-xs text-[#424752] flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-[#ba1a1a]" />
                    {pacientes.cronicos} paciente(s) con enfermedades crónicas registradas.
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-[#424752] uppercase tracking-wide mb-1">
                  Rango de edad
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={pacientes.por_edad || []} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris} vertical={false} />
                    <XAxis dataKey="rango" tick={{ fontSize: 9, fill: PALETA.neutral }} tickLine={false} axisLine={{ stroke: PALETA.gris }} />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: PALETA.neutral }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} pacientes`, "Cantidad"]} />
                    <Bar dataKey="cantidad" fill={PALETA.celeste} radius={[4, 4, 0, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card
            title="Diagnósticos más frecuentes"
            className="xl:col-span-2"
          >
            {chartsData.diags.length === 0 ? (
              <EmptyChart texto="Aún no hay diagnósticos registrados en el período." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.min(300, chartsData.diags.length * 26 + 40)}>
                <BarChart data={chartsData.diags} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: PALETA.neutral }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="diagnostico"
                    width={180}
                    tick={{ fontSize: 10, fill: PALETA.neutral }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} consultas`, "Frecuencia"]} />
                  <Bar dataKey="cantidad" fill={PALETA.verde} radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card
            title="Mapa de brotes por zona"
            subtitle="Pacientes con diagnóstico registrado, ubicados según su dirección. Las direcciones libres se ubican automáticamente en el mapa real (geocodificación OpenStreetMap). Solo se muestran padecimientos con 5 o más pacientes"
            className="xl:col-span-2"
          >
            {cargandoMapa ? (
              <EmptyChart texto="Cargando mapa..." />
            ) : (
              <MapaBrotes
                grupos={mapaVisibles}
                enfermedades={enfermedades}
                ocultos={ocultos}
                onToggle={togglePadecimiento}
              />
            )}
          </Card>
        </div>
      )}
    </Layout>
  );
}

function Card({ title, subtitle, className = "", children }) {
  return (
    <div className={`bg-white border border-[#c2c6d4] rounded-lg p-4 sm:p-6 ${className}`}>
      <div className="mb-4">
        <div className="font-bold text-lg sm:text-xl flex items-center gap-2">
          <Activity size={18} className="text-[#006a71]" />
          {title}
        </div>
        {subtitle && <div className="text-xs text-[#424752] mt-1">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ texto }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-[#727783]">
      <BarChart3 size={40} className="opacity-30 mb-3" />
      <p className="text-sm font-semibold text-center">{texto}</p>
    </div>
  );
}