import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LayoutGrid, UserPlus, FolderOpen, Shield, Package, Plus, Search, LogOut, Loader2, CheckCircle2, AlertCircle, HeartPulse, Weight, Ruler, Calculator, Flag, AlertTriangle } from "lucide-react";
import { api } from "../services/api";
import { filtrarNav, roles, roleLabels } from "../services/permisos";
import LogoMspas from "../components/LogoMspas";

const navItems = [
  { label: "Panel de Control", icon: LayoutGrid, path: "/" },
  { label: "Registro de Pacientes", icon: UserPlus, path: "/registro" },
  { label: "Expedientes Clínicos", icon: FolderOpen, path: "/expedientes" },
  { label: "Preconsultas", icon: HeartPulse, path: "/preconsulta" },
  { label: "Inventario", icon: Package, path: "/inventario" },
  { label: "Control de Acceso", icon: Shield, path: "/admin" },
];

const VITAL_RANGES = {
  presion_arterial: { label: "PRESIÓN ARTERIAL", unit: "mmHg", icon: HeartPulse, color: "#e53e3e", type: "text", placeholder: "120/80" },
  peso: { label: "PESO", unit: "lb", icon: Weight, color: "#805ad5", step: 0.1, min: 2, max: 660 },
  talla: { label: "TALLA", unit: "m", icon: Ruler, color: "#d69e2e", step: 0.01, min: 0.3, max: 2.5 },
};

export default function Preconsulta() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id_visita = searchParams.get("id_visita");
  const id_paciente = searchParams.get("id_paciente");

  const [paciente, setPaciente] = useState(null);
  const [visita, setVisita] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imc, setImc] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [feedback, setFeedback] = useState({ type: "", msg: "" });
  const [preconsultaExistente, setPreconsultaExistente] = useState(null);
  const [cola, setCola] = useState(null);

  const user = JSON.parse(localStorage.getItem("auth") || "{}");
  const nav = filtrarNav(user.rol, navItems);

  const handleLogout = () => {
    localStorage.removeItem("auth");
    navigate("/login");
  };

  const fetchData = async () => {
    if (!id_visita && !id_paciente) {
      try {
        const v = await api.getVisitasHoy();
        setCola(v.filter((x) => x.estado === "pendiente" || x.estado === "en_triaje"));
      } catch (err) {
        console.error(err);
        setCola([]);
      }
      setLoading(false);
      return;
    }
    setCola(null);
    try {
      if (id_visita) {
        try {
          const v = await api.getVisita(id_visita);
          setVisita(v);
          setPaciente({
            id_paciente: v.id_paciente,
            nombre_completo: v.nombre_completo,
            dpi: v.dpi,
            edad: v.edad,
            sexo: v.sexo,
          });
        } catch (e) {
          console.error(e);
        }
        try {
          const pre = await api.getPreconsulta(id_visita);
          setPreconsultaExistente(pre);
          const formInit = {};
          if (pre.presion_sistolica || pre.presion_diastolica) {
            formInit.presion_arterial = [pre.presion_sistolica, pre.presion_diastolica]
              .filter(v => v !== null && v !== undefined && v !== "")
              .join("/");
          }
          if (pre.peso !== null && pre.peso !== undefined) formInit.peso = pre.peso;
          if (pre.talla !== null && pre.talla !== undefined) formInit.talla = pre.talla;
          setForm(formInit);
          setImc(computeImc(formInit));
          setAlertas(getAlertas(formInit));
        } catch (e) {}
      }
      if (id_paciente) {
        const exp = await api.getExpediente(id_paciente);
        setPaciente(exp.paciente);
        const visitaHoy = exp.visitas.find(v => v.id_visita == id_visita) || exp.visitas[0];
        if (visitaHoy) setVisita(visitaHoy);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id_visita, id_paciente]);

  const computeImc = (f) => {
    const p = parseFloat(f.peso);
    const t = parseFloat(f.talla);
    return p && t && t > 0 ? ((p * 0.453592) / (t * t)).toFixed(2) : null;
  };

  const getAlertas = (f) => {
    const nuevas = [];
    const pa = (f.presion_arterial || "").trim();
    if (pa) {
      const partes = pa.split("/").map(p => parseFloat(p));
      const sis = partes[0];
      const dia = partes[1];
      if (!isNaN(sis) && (sis > 140 || sis < 90)) {
        nuevas.push({ key: "presion_sistolica", campo: "presion_arterial", label: "Presión sistólica", unit: "mmHg", value: sis, type: sis > 140 ? "alto" : "bajo", min: 90, max: 140 });
      }
      if (!isNaN(dia) && (dia > 90 || dia < 60)) {
        nuevas.push({ key: "presion_diastolica", campo: "presion_arterial", label: "Presión diastólica", unit: "mmHg", value: dia, type: dia > 90 ? "alto" : "bajo", min: 60, max: 90 });
      }
    }
    return nuevas;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...form, [name]: value };
    setForm(next);
    if (name === "peso" || name === "talla") setImc(computeImc(next));
    setAlertas(getAlertas(next));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user.id) {
      setFeedback({ type: "err", msg: "Falta usuario" });
      return;
    }
    setSaving(true);
    setFeedback({ type: "", msg: "" });
    try {
      let visitaId = id_visita ? parseInt(id_visita) : null;
      if (!visitaId) {
        if (!paciente?.id_paciente) {
          setFeedback({ type: "err", msg: "No se encontró el paciente de la visita" });
          setSaving(false);
          return;
        }
        const visita = await api.crearVisita({
          id_paciente: paciente.id_paciente,
          motivo_consulta: null,
          id_usuario_registro: user.id,
        });
        visitaId = visita.id_visita;
      }
      const data = { ...form, id_visita: visitaId, id_usuario_registro: user.id };
      delete data.imc;
      await api.registrarPreconsulta(data);
      setFeedback({ type: "ok", msg: "Preconsulta guardada. Estado: EN TRIAJE" });
      setPreconsultaExistente(data);
      setTimeout(() => navigate(-1), 900);
    } catch (err) {
      setFeedback({ type: "err", msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  const goToConsulta = () => {
    if (id_visita) navigate(`/consulta?id_visita=${id_visita}`);
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 size={32} className="animate-spin text-[#005eb8]" /></div>;

  if (!paciente && !visita) {
    if (id_visita || id_paciente) {
      return <div className="flex h-screen items-center justify-center text-[#ba1a1a]">Visita o paciente no encontrado</div>;
    }
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
                <div key={label} onClick={() => navigate(path)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md font-semibold text-sm cursor-pointer ${path === "/preconsulta" ? "bg-[#dceeee] text-[#006a71]" : "text-[#424752] hover:bg-[#f2f4f6]"}`}>
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
                <div className="font-bold text-sm text-[#00478d]">{user.nombre || "Enfermería"}</div>
                <div className="text-xs text-[#424752] capitalize">{user.rol || "enfermera"}</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#d0e1fb] border border-[#c2c6d4] flex items-center justify-center font-bold text-[#00478d] text-sm">
                {(user.nombre || "E")[0]}
              </div>
            </div>
          </header>

          <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
            <h1 className="font-bold text-3xl">Preconsultas del Día</h1>
            <p className="text-sm text-[#424752] mt-1 mb-6">Selecciona un paciente en espera para tomar sus signos vitales.</p>
            {cola === null ? null : cola.length === 0 ? (
              <div className="bg-white border border-[#c2c6d4] rounded-xl text-center py-16">
                <HeartPulse size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No hay pacientes en espera</p>
                <p className="text-sm mt-1">Los pacientes que se registren hoy aparecerán aquí.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {cola.map((v) => (
                  <div key={v.id_visita} className="bg-white border border-[#c2c6d4] rounded-lg p-4 flex items-center gap-4 hover:border-[#006a71] transition-colors">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${v.estado === "pendiente" ? "bg-[#ffdad6] text-[#ba1a1a]" : "bg-[#c7f0f4] text-[#006a71]"}`}>
                      {(v.nombre_completo || "?").split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-bold truncate">{v.nombre_completo}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${v.estado === "pendiente" ? "bg-[#ffdad6] text-[#ba1a1a]" : "bg-[#c7f0f4] text-[#006a71]"}`}>
                          {v.estado === "pendiente" ? "PENDIENTE" : "EN TRIAJE"}
                        </span>
                      </div>
                      <div className="text-xs text-[#424752] mt-0.5">
                        DPI: {v.dpi || "—"} · Edad: {v.edad ?? "—"} años · {new Date(v.fecha_visita).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/preconsulta?id_visita=${v.id_visita}`)}
                      className="bg-[#006a71] hover:bg-[#004d56] text-white px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-colors"
                    >
                      Tomar Signos Vitales
                    </button>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

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
              <div className="font-bold text-sm text-[#00478d]">{user.nombre || "Enfermería"}</div>
              <div className="text-xs text-[#424752] capitalize">{user.rol || "enfermera"}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#d0e1fb] border border-[#c2c6d4] flex items-center justify-center font-bold text-[#00478d] text-sm">
              {(user.nombre || "E")[0]}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
          <div className="bg-white border border-[#c2c6d4] border-l-4 border-l-[#006a71] rounded-lg p-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#dceeee] flex items-center justify-center text-xl">🧑</div>
              <div>
                <div className="font-bold text-xl">{paciente?.nombre_completo || "Paciente no cargado"}</div>
                <div className="flex gap-4 mt-1 text-sm text-[#424752]">
                  <span>DPI: {paciente?.dpi || "—"}</span>
                  <span>Edad: {paciente?.edad || "—"} años</span>
                  <span>Sexo: {paciente?.sexo === "M" ? "Masculino" : "Femenino"}</span>
                  {visita && <span className={`px-2 py-0.5 rounded text-xs font-semibold ${visita.estado === "pendiente" ? "bg-[#ffdad6] text-[#ba1a1a]" : visita.estado === "en_triaje" ? "bg-[#c7f0f4] text-[#006a71]" : "bg-[#d0e1fb] text-[#00478d]"}`}>{visita.estado.replace("_", " ").toUpperCase()}</span>}
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

          {alertas.length > 0 && (
            <div className="bg-[#fff5f5] border-l-4 border-[#ba1a1a] p-4 rounded-r-lg mb-6">
              <div className="flex items-center gap-2 text-[#ba1a1a] font-semibold mb-2">
                <AlertTriangle size={18} /> ALERTAS DE SIGNOS VITALES
              </div>
              <ul className="space-y-1">
                {alertas.map(a => (
                  <li key={a.key} className="text-sm flex items-center gap-2">
                    <Flag size={14} className="text-[#ba1a1a]" />
                    <span>{a.label}: <strong>{a.value} {a.unit}</strong> ({a.type === "bajo" ? `mín ${a.min}` : `máx ${a.max}`})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white border border-[#c2c6d4] rounded-xl p-6 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Object.entries(VITAL_RANGES).map(([key, range]) => (
                <VitalInput
                  key={key}
                  name={key}
                  range={range}
                  value={form[key]}
                  isOut={alertas.some(a => a.key === key || a.campo === key)}
                  onChange={handleChange}
                />
              ))}
            </div>

            {imc && (
              <div className="bg-[#f0fff4] border border-[#9ae6b4] rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calculator size={24} className="text-[#276749]" />
                  <div>
                    <div className="text-xs text-[#276749] font-semibold">IMC CALCULADO</div>
                    <div className="font-bold text-2xl text-[#276749]">{imc}</div>
                  </div>
                </div>
                <div className="text-right text-sm text-[#276749]">
                  {imc < 18.5 && "Bajo peso"}
                  {imc >= 18.5 && imc < 25 && "Normal"}
                  {imc >= 25 && imc < 30 && "Sobrepeso"}
                  {imc >= 30 && "Obesidad"}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-[#eceef0]">
              <button type="button" onClick={() => navigate(-1)} className="px-6 py-2.5 border border-[#c2c6d4] rounded-lg font-semibold text-[#424752] hover:bg-[#f2f4f6] transition-colors">
                Volver
              </button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-[#006a71] hover:bg-[#004d56] text-white rounded-lg font-bold transition-all disabled:opacity-60 flex items-center gap-2">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : "Guardar Preconsulta"}
              </button>
              {preconsultaExistente && roles.consulta.includes(user.rol) && (
                <button type="button" onClick={goToConsulta} className="px-6 py-2.5 bg-[#005eb8] hover:bg-[#00478d] text-white rounded-lg font-bold transition-all flex items-center gap-2">
                  <HeartPulse size={16} /> Ir a Consulta Médica
                </button>
              )}
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

function VitalInput({ name, range, value, isOut, onChange }) {
  return (
    <div className={`relative ${isOut ? "ring-2 ring-[#ba1a1a]" : ""}`}>
      <label className="block text-sm font-semibold mb-1 flex items-center gap-1.5">
        <range.icon size={14} className={isOut ? "text-[#ba1a1a]" : "text-[#005eb8]"} />
        {range.label}
        {isOut && <Flag size={12} className="text-[#ba1a1a]" title="Fuera de rango" />}
      </label>
      <input
        name={name}
        type={range.type || "number"}
        step={range.step || 1}
        value={value || ""}
        onChange={onChange}
        placeholder={range.placeholder || (range.min > 0 ? `${range.min}-${range.max}` : "")}
        className={`w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all ${isOut ? "border-[#ba1a1a] bg-[#fff5f5]" : "border-[#c2c6d4]"}`}
      />
      <span className="absolute right-3 top-8 text-xs text-[#424752]">{range.unit}</span>
    </div>
  );
}