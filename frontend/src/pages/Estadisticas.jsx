import React, { useState, useEffect, useMemo } from "react";
import {
  CalendarDays, Users, UserCheck, AlertTriangle, Pill, Loader2,
  Activity, BarChart3, RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Cell, PieChart, Pie, Legend,
} from "recharts";
import { api } from "../services/api";
import Layout from "../components/Layout";

const PALETA = {
  azul: "#00478d",
  azulClaro: "#005eb8",
  celeste: "#d0e1fb",
  verde: "#006a71",
  verdeClaro: "#c7f0f4",
  rojo: "#ba1a1a",
  rojoClaro: "#ffdad6",
  neutral: "#424752",
  gris: "#c2c6d4",
};

const rangos = {
  "7 días": 7,
  "30 días": 30,
  "90 días": 90,
};

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function inicioISO(dias) {
  const d = new Date();
  d.setDate(d.getDate() - (dias - 1));
  return d.toISOString().slice(0, 10);
}

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
  const [error, setError] = useState(null);
  const [visitas, setVisitas] = useState({ diario: [], resumen: {} });
  const [medicamentos, setMedicamentos] = useState({ top: [], total_unidades: 0 });
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [pacientes, setPacientes] = useState({});

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

  useEffect(() => {
    cargarDatos(desde, hasta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarRango = (dias) => {
    const d = inicioISO(dias);
    const h = hoyISO();
    setRangoDias(dias);
    setDesde(d);
    setHasta(h);
    cargarDatos(d, h);
  };

  const kpis = [
    {
      label: "Visitas en el período",
      value: visitas.resumen.total_visitas ?? "—",
      sub: `${desde} — ${hasta}`,
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
    const formatoFecha = (fecha) =>
      new Date(fecha + "T00:00:00").toLocaleDateString("es-GT", { day: "2-digit", month: "short" });
    const diario = (visitas.diario || []).map((v) => ({
      ...v,
      fecha: formatoFecha(v.fecha),
    }));
    const topMeds = (medicamentos.top || []).map((m) => ({
      nombre: m.nombre.length > 22 ? m.nombre.slice(0, 21) + "…" : m.nombre,
      unidades: m.unidades_dispensadas,
    }));
    const diags = (diagnosticos || []).map((d) => ({
      diagnostico: d.diagnostico.length > 26 ? d.diagnostico.slice(0, 25) + "…" : d.diagnostico,
      cantidad: d.cantidad,
    }));
    return { diario, topMeds, diags };
  }, [visitas, medicamentos, diagnosticos]);

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
              onClick={() => cargarDatos(desde, hasta)}
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
            subtitle="Total de visitas y consultas completadas en el período"
            className="xl:col-span-2"
          >
            {chartsData.diario.every((d) => d.total === 0) ? (
              <EmptyChart texto="No hay visitas registradas en el período seleccionado." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartsData.diario} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PALETA.azul} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={PALETA.azul} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gCompletadas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PALETA.verde} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={PALETA.verde} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: PALETA.neutral }} tickLine={false} axisLine={{ stroke: PALETA.gris }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: PALETA.neutral }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="total" name="Visitas" stroke={PALETA.azul} strokeWidth={2} fill="url(#gTotal)" />
                  <Area type="monotone" dataKey="completadas" name="Completadas" stroke={PALETA.verde} strokeWidth={2} fill="url(#gCompletadas)" />
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
                  Por sexo
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
            subtitle="Top 10 diagnósticos registrados en el período"
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
        <div className="text-xs text-[#424752] mt-1">{subtitle}</div>
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