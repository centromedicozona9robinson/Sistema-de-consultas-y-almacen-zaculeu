import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LayoutGrid, UserPlus, FolderOpen, Shield, Package, Plus, Search, LogOut, Loader2, CheckCircle2, AlertCircle, FileText, Pill, Calendar, HeartPulse, ArrowLeft } from "lucide-react";
import { api } from "../services/api";
import { filtrarNav, roleLabels } from "../services/permisos";
import LogoMspas from "../components/LogoMspas";

const navItems = [
  { label: "Panel de Control", icon: LayoutGrid, path: "/" },
  { label: "Registro de Pacientes", icon: UserPlus, path: "/registro" },
  { label: "Expedientes Clínicos", icon: FolderOpen, path: "/expedientes" },
  { label: "Preconsultas", icon: HeartPulse, path: "/preconsulta" },
  { label: "Inventario", icon: Package, path: "/inventario" },
  { label: "Control de Acceso", icon: Shield, path: "/admin" },
];

export default function ConsultaMedica() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id_visita = searchParams.get("id_visita");

  const [paciente, setPaciente] = useState(null);
  const [visita, setVisita] = useState(null);
  const [preconsulta, setPreconsulta] = useState(null);
  const [consultaExistente, setConsultaExistente] = useState(null);
  const [form, setForm] = useState({ diagnostico: "", indicaciones: "", observaciones: "", fecha_seguimiento: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", msg: "" });

  const user = JSON.parse(localStorage.getItem("auth") || "{}");
  const nav = filtrarNav(user.rol, navItems);

  const handleLogout = () => {
    localStorage.removeItem("auth");
    navigate("/login");
  };

  const fetchData = async () => {
    if (!id_visita) {
      setLoading(false);
      return;
    }
    try {
      const [v, pre, con] = await Promise.all([
        api.getVisita(id_visita).catch(() => null),
        api.getPreconsulta(id_visita).catch(() => null),
        api.getConsulta(id_visita).catch(() => null),
      ]);
      if (v) {
        setVisita(v);
        setPaciente({
          id_paciente: v.id_paciente,
          nombre_completo: v.nombre_completo,
          dpi: v.dpi,
          edad: v.edad,
          sexo: v.sexo,
        });
      }
      setPreconsulta(pre);
      if (con) {
        setConsultaExistente(con);
        setForm({
          diagnostico: con.diagnostico || "",
          indicaciones: con.indicaciones || "",
          observaciones: con.observaciones || "",
          fecha_seguimiento: con.fecha_seguimiento || "",
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id_visita]);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!id_visita || !user.id) {
      setFeedback({ type: "err", msg: "Falta visita o médico" });
      return;
    }
    setSaving(true);
    setFeedback({ type: "", msg: "" });
    try {
      const data = { ...form, id_visita: parseInt(id_visita), id_medico: user.id };
      await api.registrarConsulta(data);
      setFeedback({ type: "ok", msg: "Consulta médica guardada. Estado: COMPLETADO" });
      setConsultaExistente(data);
      setTimeout(() => {
        if (paciente?.id_paciente) navigate(`/expedientes?id=${paciente.id_paciente}`);
        else navigate("/expedientes");
      }, 900);
    } catch (err) {
      setFeedback({ type: "err", msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 size={32} className="animate-spin text-[#005eb8]" /></div>;
  if (!paciente) return <div className="flex h-screen items-center justify-center text-[#ba1a1a]">Cargando datos de la visita...</div>;

  const VitalCard = ({ label, value, unit, icon: Icon, color, alert }) => (
    <div className={`bg-white border rounded-lg p-4 ${alert ? "border-[#ba1a1a] bg-[#fff5f5]" : "border-[#c2c6d4]"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={alert ? "text-[#ba1a1a]" : color} />
        <span className="text-xs font-semibold text-[#424752]">{label}</span>
        {alert && <span className="text-xs px-1.5 py-0.5 bg-[#ba1a1a] text-white rounded">!</span>}
      </div>
      <div className="font-bold text-lg">{value} <span className="text-sm font-normal text-[#424752]">{unit}</span></div>
    </div>
  );

  const isAlert = (key, val) => {
    if (!val) return false;
    const ranges = {
      presion_sistolica: { min: 90, max: 140 },
      presion_diastolica: { min: 60, max: 90 },
    };
    const r = ranges[key];
    return r && (val < r.min || val > r.max);
  };

  return (
    <div className="flex h-screen bg-[#f7f9fb] font-sans text-[#191c1e] overflow-hidden">
      <aside className="w-[255px] h-full flex-shrink-0 bg-white border-r border-[#c2c6d4] flex flex-col justify-between">
        <div className="p-4 overflow-y-auto">
          <div className="pb-6">
            <LogoMspas />
            <div className="text-xs text-[#424752] mt-0.5 capitalize">{roleLabels[user.rol] || user.rol}</div>
          </div>
          <nav className="flex flex-col gap-1">
            {nav.map(({ label, icon: Icon, path }) => (
              <div key={label} onClick={() => navigate(path)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-md font-semibold text-sm cursor-pointer text-[#424752] hover:bg-[#f2f4f6]">
                <Icon size={18} />
                {label}
              </div>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-[#c2c6d4] flex flex-col gap-3 shrink-0">
          <div onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm text-[#424752] hover:bg-[#f2f4f6] rounded-md cursor-pointer transition-colors">
            <LogOut size={16} /> Cerrar Sesión
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        <header className="relative h-20 shrink-0 bg-white border-b border-[#c2c6d4] flex items-center justify-between px-8 sticky top-0 z-10">
          <div />
          <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#00478d] whitespace-nowrap">
            Centro Médico Público de Zaculeu
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-bold text-sm text-[#00478d]">{user.nombre || "Médico"}</div>
              <div className="text-xs text-[#424752] capitalize">{user.rol || "medico"}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#d0e1fb] border border-[#c2c6d4] flex items-center justify-center font-bold text-[#00478d] text-sm">
              {(user.nombre || "M")[0]}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
          <div className="bg-white border border-[#c2c6d4] border-l-4 border-l-[#005eb8] rounded-lg p-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#d0e1fb] flex items-center justify-center text-xl">🧑</div>
              <div>
                <div className="flex items-center gap-3">
                  <div className="font-bold text-xl">{paciente?.nombre_completo}</div>
                  <span className="bg-[#d0e1fb] text-[#00478d] text-xs font-semibold px-3 py-1 rounded-full">Paciente Activo</span>
                </div>
                <div className="flex gap-6 mt-1 text-sm text-[#424752]">
                  <span>DPI: {paciente?.dpi || "—"}</span>
                  <span>Edad: {paciente?.edad || "—"} años</span>
                  <span>Sexo: {paciente?.sexo === "M" ? "Masculino" : "Femenino"}</span>
                  {visita && <span className={`px-2 py-0.5 rounded text-xs font-semibold ${visita.estado === "completado" ? "bg-[#d0e1fb] text-[#00478d]" : "bg-[#c7f0f4] text-[#006a71]"}`}>{visita.estado.replace("_", " ").toUpperCase()}</span>}
                </div>
              </div>
            </div>
          </div>

          {feedback.msg && (
            <div className={`flex items-center gap-3 p-4 rounded-lg mb-6 font-semibold border-l-4 ${feedback.type === "ok" ? "bg-[#dceeee] text-[#006a71] border-[#006a71]" : "bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]"}`}>
              {feedback.type === "ok" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {feedback.msg}
            </div>
          )}

          {preconsulta && (
            <div className="bg-white border border-[#c2c6d4] rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 font-bold text-lg text-[#00478d]">
                  <HeartPulse size={20} /> Signos Vitales (Preconsulta)
                </div>
                <span className="text-xs text-[#424752]">Registrado: {new Date(preconsulta.fecha_hora_registro).toLocaleString("es-GT")}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <VitalCard label="Presión" value={`${preconsulta.presion_sistolica || "—"}/${preconsulta.presion_diastolica || "—"}`} unit="mmHg" icon={HeartPulse} color="text-[#e53e3e]" alert={isAlert("presion_sistolica", preconsulta.presion_sistolica) || isAlert("presion_diastolica", preconsulta.presion_diastolica)} />
                <VitalCard label="Peso" value={preconsulta.peso || "—"} unit="lb" icon={HeartPulse} color="text-[#805ad5]" />
                <VitalCard label="Altura" value={preconsulta.talla || "—"} unit="m" icon={HeartPulse} color="text-[#d69e2e]" />
                <VitalCard label="IMC" value={preconsulta.imc || "—"} unit="" icon={HeartPulse} color="text-[#276749]" />
              </div>
              {preconsulta.alerta_signos && (
                <div className="mt-4 p-3 bg-[#fff5f5] border-l-4 border-[#ba1a1a] rounded-r">
                  <div className="flex items-center gap-2 text-[#ba1a1a] font-semibold mb-1">
                    <AlertCircle size={16} /> ALERTA: {preconsulta.detalle_alerta}
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white border border-[#c2c6d4] rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Diagnóstico <span className="text-[#ba1a1a]">*</span></label>
              <textarea name="diagnostico" required value={form.diagnostico} onChange={handleChange} rows={4}
                className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                placeholder="Descripción del diagnóstico médico..." />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Indicaciones / Tratamiento</label>
              <textarea name="indicaciones" value={form.indicaciones} onChange={handleChange} rows={3}
                className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                placeholder="Medicamentos, dosis, frecuencia, duración..." />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Observaciones</label>
              <textarea name="observaciones" value={form.observaciones} onChange={handleChange} rows={2}
                className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                placeholder="Notas adicionales..." />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Fecha de Seguimiento</label>
              <input type="date" name="fecha_seguimiento" value={form.fecha_seguimiento} onChange={handleChange}
                className="w-full max-w-xs border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all" />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#eceef0]">
              <button type="button" onClick={() => navigate(`/preconsulta?id_visita=${id_visita}`)} className="flex items-center gap-2 px-5 py-2.5 border border-[#c2c6d4] rounded-lg font-semibold text-[#424752] hover:bg-[#f2f4f6] transition-colors">
                <ArrowLeft size={16} /> Volver a Preconsulta
              </button>
              <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 border border-[#c2c6d4] rounded-lg font-semibold text-[#424752] hover:bg-[#f2f4f6] transition-colors">
                Panel Control
              </button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-[#00478d] hover:bg-[#003366] text-white rounded-lg font-bold transition-all disabled:opacity-60 flex items-center gap-2">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><FileText size={16} /> Finalizar Consulta</>}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}