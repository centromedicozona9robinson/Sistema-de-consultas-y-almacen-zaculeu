import React, { useState, useEffect } from "react";
import {
  Users, Clock, Calendar, Eye, Loader2, Stethoscope, HeartPulse, UserCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import Layout from "../components/Layout";

const roleMessages = {
  enfermera: "Triaje y signos vitales: atiende a los pacientes que llegan al centro.",
  medico: "Diagnósticos: revisa a los pacientes en espera y finaliza sus consultas.",
  administrador: "Resumen de operaciones del sistema de pre-consultas para hoy.",
  director: "Supervisión general de las operaciones del centro médico.",
};

const roleStats = {
  enfermera: [
    { label: "Pacientes de Hoy", value: "total_visitas_hoy", sub: "completados", subCount: "completados", icon: Users, iconBg: "bg-[#d0e1fb]", borderColor: "border-l-[#005eb8]" },
    { label: "Triaje Pendiente", value: "pendientes", valueColor: "text-[#ba1a1a]", sub: "Esperando signos vitales", icon: Clock, iconBg: "bg-[#ffdad6]", borderColor: "border-l-[#ba1a1a]" },
    { label: "En Triaje", value: "en_triaje", valueColor: "text-[#006a71]", sub: "Signos vitales registrados", icon: HeartPulse, iconBg: "bg-[#c7f0f4]", borderColor: "border-l-[#006a71]" },
  ],
  medico: [
    { label: "Pacientes de Hoy", value: "total_visitas_hoy", sub: "atendidos", subCount: "completados", icon: Users, iconBg: "bg-[#d0e1fb]", borderColor: "border-l-[#005eb8]" },
    { label: "En Espera de Consulta", value: "en_triaje", valueColor: "text-[#006a71]", sub: "Listos para diagnóstico", icon: Stethoscope, iconBg: "bg-[#c7f0f4]", borderColor: "border-l-[#006a71]" },
    { label: "Consultas Completadas", value: "completados", valueColor: "text-[#00478d]", sub: "Pacientes atendidos hoy", icon: UserCheck, iconBg: "bg-[#d0e1fb]", borderColor: "border-l-[#00478d]" },
  ],
  administrador: [
    { label: "Pacientes de Hoy", value: "total_visitas_hoy", sub: "completados", subCount: "completados", icon: Users, iconBg: "bg-[#d0e1fb]", borderColor: "border-l-[#005eb8]" },
    { label: "Pendientes", value: "pendientes", valueColor: "text-[#ba1a1a]", sub: "En espera de atención", icon: Clock, iconBg: "bg-[#ffdad6]", borderColor: "border-l-[#ba1a1a]" },
    { label: "En Triaje", value: "en_triaje", valueColor: "text-[#006a71]", sub: "Con signos vitales", icon: HeartPulse, iconBg: "bg-[#c7f0f4]", borderColor: "border-l-[#006a71]" },
    { label: "Completados", value: "completados", valueColor: "text-[#00478d]", sub: "Consultas terminadas", icon: UserCheck, iconBg: "bg-[#d0e1fb]", borderColor: "border-l-[#00478d]" },
  ],
  director: [
    { label: "Pacientes de Hoy", value: "total_visitas_hoy", sub: "completados", subCount: "completados", icon: Users, iconBg: "bg-[#d0e1fb]", borderColor: "border-l-[#005eb8]" },
    { label: "Pendientes", value: "pendientes", valueColor: "text-[#ba1a1a]", sub: "En espera de atención", icon: Clock, iconBg: "bg-[#ffdad6]", borderColor: "border-l-[#ba1a1a]" },
    { label: "En Triaje", value: "en_triaje", valueColor: "text-[#006a71]", sub: "Con signos vitales", icon: HeartPulse, iconBg: "bg-[#c7f0f4]", borderColor: "border-l-[#006a71]" },
    { label: "Completados", value: "completados", valueColor: "text-[#00478d]", sub: "Consultas terminadas", icon: UserCheck, iconBg: "bg-[#d0e1fb]", borderColor: "border-l-[#00478d]" },
  ],
};

const statusStyles = {
  completado: "bg-[#d0e1fb] text-[#00478d]",
  pendiente: "bg-[#ffdad6] text-[#ba1a1a]",
  en_triaje: "bg-[#c7f0f4] text-[#006a71]",
};

const statusLabel = {
  completado: "Completado",
  pendiente: "Pendiente",
  en_triaje: "En Triaje",
};

export default function PanelControl() {
  const navigate = useNavigate();
  const [visitas, setVisitas] = useState([]);
  const [stats, setStats] = useState({ total_visitas_hoy: 0, pendientes: 0, en_triaje: 0, completados: 0, ultima_hora: 0 });
  const [loading, setLoading] = useState(true);
  const [busquedaExpediente, setBusquedaExpediente] = useState("");

  const user = JSON.parse(localStorage.getItem("auth") || "{}");
  const rol = user.rol || "enfermera";
  const statCards = (roleStats[rol] || roleStats.enfermera).map((s) => ({
    ...s,
    value: stats[s.value],
    sub: s.subCount ? `${stats[s.subCount]} ${s.sub}` : s.sub,
  }));

  const fetchData = async () => {
    try {
      const [v, s] = await Promise.all([api.getVisitasHoy(), api.getEstadisticas()]);
      setVisitas(v);
      setStats(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <Layout
      activePath="/"
      search={{
        value: busquedaExpediente,
        onChange: (e) => setBusquedaExpediente(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") {
            const q = busquedaExpediente.trim();
            navigate(q ? `/expedientes?q=${encodeURIComponent(q)}` : "/expedientes");
          }
        },
        placeholder: "Buscar expediente...",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-bold text-2xl sm:text-[32px]">Panel de Control</h1>
          <div className="text-sm text-[#424752] mt-1">{roleMessages[rol] || roleMessages.enfermera}</div>
        </div>
        <div className="flex items-center gap-2.5 bg-white border border-[#c2c6d4] rounded-md px-4 py-2 self-start">
          <div>
            <div className="text-[11px] tracking-wide text-[#424752]">FECHA ACTUAL</div>
            <div className="font-bold">{new Date().toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <Calendar size={18} className="text-[#00478d]" />
        </div>
      </div>

      <div className={`grid ${statCards.length > 3 ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-2 lg:grid-cols-3"} gap-3 sm:gap-5 mb-6`}>
        {statCards.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} valueColor={s.valueColor} sub={s.sub} icon={s.icon} iconBg={s.iconBg} borderColor={s.borderColor} />
        ))}
      </div>

      <div className="bg-white border border-[#c2c6d4] rounded-lg p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-lg sm:text-xl">Lista de Visitas del Día</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#424752]">
            <Loader2 size={28} className="animate-spin mr-3" /> Cargando visitas...
          </div>
        ) : visitas.length === 0 ? (
          <div className="text-center py-16 text-[#727783]">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No hay visitas registradas para hoy</p>
            <p className="text-sm mt-1">Las visitas nuevas aparecerán aquí en tiempo real.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[760px]">
              <thead>
                <tr className="text-left">
                  {["NOMBRE DEL PACIENTE", "DPI", "FECHA DE VISITA", "MOTIVO", "ESTADO", "ACCIONES"].map((h) => (
                    <th key={h} className="text-xs tracking-wide text-[#424752] py-2 px-3 border-b border-[#c2c6d4]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visitas.map((v) => (
                  <tr key={v.id_visita} className="border-b border-[#eceef0] hover:bg-[#f7f9fb]">
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#d0e1fb] flex items-center justify-center font-bold text-xs text-[#00478d]">
                          {v.nombre_completo?.split(' ').map(n => n[0]).slice(0,2).join('')}
                        </div>
                        <div>
                          <div className="font-semibold">{v.nombre_completo}</div>
                          <div className="text-xs text-[#424752]">{v.sexo === 'M' ? 'Masculino' : 'Femenino'}, {v.edad} años</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-sm">{v.dpi || '—'}</td>
                    <td className="py-3.5 px-3 text-sm">{new Date(v.fecha_visita).toLocaleString('es-GT')}</td>
                    <td className="py-3.5 px-3 text-sm max-w-[200px] truncate">{v.motivo_consulta || '—'}</td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[v.estado] || "bg-[#eceef0] text-[#424752]"}`}>
                        {statusLabel[v.estado] || v.estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex gap-2">
                        {v.estado === 'pendiente' && ["enfermera", "medico", "administrador", "director"].includes(user.rol) && (
                          <button onClick={() => navigate(`/preconsulta?id_visita=${v.id_visita}`)} className="px-3 py-1.5 bg-[#006a71] hover:bg-[#004d56] text-white text-xs rounded font-semibold transition-colors flex items-center gap-1">
                            <HeartPulse size={12} /> Triaje
                          </button>
                        )}
                        {v.estado === 'en_triaje' && ["medico", "administrador", "director"].includes(user.rol) && (
                          <button onClick={() => navigate(`/consulta?id_visita=${v.id_visita}`)} className="px-3 py-1.5 bg-[#00478d] hover:bg-[#003366] text-white text-xs rounded font-semibold transition-colors flex items-center gap-1">
                            <Stethoscope size={12} /> Consultar
                          </button>
                        )}
                        <button onClick={() => navigate(`/expedientes?id=${v.id_paciente}`)} className="text-[#424752] hover:text-[#005eb8] p-1.5" title="Ver expediente">
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatCard({ label, value, valueColor = "text-[#191c1e]", sub, icon: Icon, iconBg, borderColor }) {
  return (
    <div className={`bg-white border border-[#c2c6d4] border-l-4 ${borderColor} rounded-lg p-5 flex justify-between items-start`}>
      <div>
        <div className="font-semibold text-sm text-[#424752]">{label}</div>
        <div className={`font-bold text-[32px] mt-1.5 ${valueColor}`}>{value ?? '—'}</div>
        <div className="text-xs text-[#424752] mt-1.5">{sub}</div>
      </div>
      <div className={`w-11 h-11 rounded-md ${iconBg} flex items-center justify-center`}>
        <Icon size={20} className="text-[#00478d]" />
      </div>
    </div>
  );
}
