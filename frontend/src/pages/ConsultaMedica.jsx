import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, FileText, Pill, HeartPulse, ArrowLeft, X, Plus, Search } from "lucide-react";
import { api } from "../services/api";
import Layout from "../components/Layout";

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
  const [showMedModal, setShowMedModal] = useState(false);
  const [medicamentos, setMedicamentos] = useState([]);
  const [medBusqueda, setMedBusqueda] = useState("");
  const [recetas, setRecetas] = useState([]);
  const [cantidadModal, setCantidadModal] = useState(null);
  const [cantidad, setCantidad] = useState("");

  const user = JSON.parse(localStorage.getItem("auth") || "{}");

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
        if (Array.isArray(con.recetas) && con.recetas.length > 0) {
          setRecetas(con.recetas);
        }
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

  const openMedModal = async () => {
    setShowMedModal(true);
    setMedBusqueda("");
    if (medicamentos.length === 0) {
      try {
        const res = await api.getMedicamentos();
        setMedicamentos(Array.isArray(res) ? res : res.data || []);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const addMedicamento = (m) => {
    const stock = m.stock_total || 0;
    if (stock <= 0) {
      // Sin stock: se agrega como texto de indicación, sin descontar
      const nombre = m.nombre_medicamento || "";
      const detalle = [m.concentracion, m.forma_farmaceutica].filter(Boolean).join(" ") || "";
      const linea = `${nombre}${detalle ? " (" + detalle + ")" : ""} — SIN STOCK: no se dispensa`;
      setForm(f => ({ ...f, indicaciones: (f.indicaciones.trim() ? f.indicaciones + "\n" : "") + linea }));
      setShowMedModal(false);
      return;
    }
    setCantidadModal(m);
  };

  const confirmarCantidad = () => {
    const m = cantidadModal;
    const qty = parseInt(cantidad, 10);
    if (!m || !qty || qty <= 0) return;
    const stock = m.stock_total || 0;
    const cantidadFinal = qty > stock ? stock : qty;
    setRecetas(r => [...r, { id_medicamento: m.id_medicamento, nombre: m.nombre_medicamento, cantidad: cantidadFinal, dosis: "" }]);
    setCantidadModal(null);
    setCantidad("");
    setShowMedModal(false);
  };

  const eliminarReceta = (index) => {
    setRecetas(r => r.filter((_, i) => i !== index));
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
      const data = { ...form, id_visita: parseInt(id_visita), id_medico: user.id, recetas };
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

  const medicamentosFiltrados = medicamentos.filter(m => {
    const q = medBusqueda.trim().toLowerCase();
    if (!q) return true;
    return [m.nombre_medicamento, m.nombre_generico, m.concentracion, m.forma_farmaceutica]
      .filter(Boolean)
      .some(v => v.toLowerCase().includes(q));
  });

  return (
    <Layout activePath="/consulta" mainClassName="p-6 sm:p-8 max-w-4xl mx-auto w-full">
      <div className="bg-white border border-[#c2c6d4] border-l-4 border-l-[#005eb8] rounded-lg p-5 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-12 h-12 rounded-full bg-[#d0e1fb] flex items-center justify-center text-xl">🧑</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="font-bold text-lg sm:text-xl">{paciente?.nombre_completo}</div>
              <span className="bg-[#d0e1fb] text-[#00478d] text-xs font-semibold px-3 py-1 rounded-full">Paciente Activo</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-[#424752]">
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold">Indicaciones / Tratamiento</label>
                <button
                  type="button"
                  onClick={openMedModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#005eb8] hover:bg-[#00478d] text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <Plus size={14} /> Agregar medicamento
                </button>
              </div>
              <textarea name="indicaciones" value={form.indicaciones} onChange={handleChange} rows={3}
                className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                placeholder="Medicamentos, dosis, frecuencia, duración..." />
              {recetas.length > 0 && (
                <div className="mt-3 border border-[#c2c6d4] rounded-lg">
                  <div className="px-3 py-2 bg-[#f2f7ff] border-b border-[#c2c6d4] text-xs font-bold text-[#00478d] uppercase">
                    Medicamentos a dispensar (se restan del inventario)
                  </div>
                  <ul className="divide-y divide-[#eceef0]">
                    {recetas.map((r, i) => (
                      <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                        <Pill size={16} className="text-[#00478d] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{r.nombre}</div>
                          <div className="text-xs text-[#00478d]">Cantidad a dispensar: {r.cantidad}</div>
                        </div>
                        <button type="button" onClick={() => eliminarReceta(i)} className="p-1.5 rounded-md hover:bg-[#ffdad6] text-[#ba1a1a]" title="Quitar">
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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

            <div className="flex flex-col sm:flex-row flex-wrap justify-end gap-3 pt-4 border-t border-[#eceef0]">
              <button type="button" onClick={() => navigate(`/preconsulta?id_visita=${id_visita}`)} className="flex items-center justify-center gap-2 px-5 py-2.5 border border-[#c2c6d4] rounded-lg font-semibold text-[#424752] hover:bg-[#f2f4f6] transition-colors">
                <ArrowLeft size={16} /> Volver a Preconsulta
              </button>
              <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 border border-[#c2c6d4] rounded-lg font-semibold text-[#424752] hover:bg-[#f2f4f6] transition-colors">
                Panel Control
              </button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-[#00478d] hover:bg-[#003366] text-white rounded-lg font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><FileText size={16} /> Finalizar Consulta</>}
              </button>
            </div>
          </form>

      {showMedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowMedModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#eceef0]">
              <h2 className="font-bold text-lg text-[#00478d] flex items-center gap-2"><Pill size={20} /> Agregar medicamento</h2>
              <button onClick={() => setShowMedModal(false)} className="p-1.5 rounded-md hover:bg-[#f2f4f6] text-[#424752]">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-[#eceef0]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#424752]" />
                <input
                  value={medBusqueda}
                  onChange={(e) => setMedBusqueda(e.target.value)}
                  autoFocus
                  placeholder="Buscar por nombre, genérico o presentación..."
                  className="w-full pl-9 pr-3 py-2.5 border border-[#c2c6d4] rounded-lg focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {medicamentos.length === 0 ? (
                <div className="p-6 text-center text-[#424752]">Cargando medicamentos del inventario...</div>
              ) : medicamentosFiltrados.length === 0 ? (
                <div className="p-6 text-center text-[#424752]">No se encontraron medicamentos.</div>
              ) : (
                medicamentosFiltrados.map((m) => (
                  <button
                    key={m.id_medicamento}
                    onClick={() => addMedicamento(m)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f2f4f6] text-left transition-colors"
                  >
                    <div className="w-9 h-9 rounded-md bg-[#d0e1fb] flex items-center justify-center text-[#00478d] shrink-0">
                      <Pill size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{m.nombre_medicamento}</div>
                      <div className="text-xs text-[#424752] truncate">
                        {m.nombre_generico || "—"}
                        {m.concentracion ? ` · ${m.concentracion}` : ""}
                        {m.forma_farmaceutica ? ` · ${m.forma_farmaceutica}` : ""}
                      </div>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${(m.stock_total || 0) > 0 ? "text-[#006a71]" : "text-[#ba1a1a]"}`}>
                      {m.unidad_medida || "unidad"}: {m.stock_total || 0}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {cantidadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => { setCantidadModal(null); setCantidad(""); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#eceef0]">
              <h3 className="font-bold text-lg text-[#00478d]">Cantidad</h3>
              <button onClick={() => { setCantidadModal(null); setCantidad(""); }} className="p-1.5 rounded-md hover:bg-[#f2f4f6] text-[#424752]">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="text-sm font-semibold mb-2">{cantidadModal.nombre_medicamento}</div>
              <div className="text-xs text-[#424752] mb-3">
                Stock disponible: {cantidadModal.stock_total || 0} {cantidadModal.unidad_medida || "unidades"}
              </div>
              <label className="block text-sm font-semibold mb-1.5">Cantidad a dispensar</label>
              <input
                type="number"
                min="1"
                max={cantidadModal.stock_total || 1}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                autoFocus
                className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20"
              />
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-[#eceef0]">
              <button type="button" onClick={() => { setCantidadModal(null); setCantidad(""); }} className="px-4 py-2 border border-[#c2c6d4] rounded-lg font-semibold text-[#424752] hover:bg-[#f2f4f6]">
                Cancelar
              </button>
              <button type="button" onClick={confirmarCantidad} className="px-5 py-2 bg-[#005eb8] hover:bg-[#00478d] text-white rounded-lg font-bold">
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
      </Layout>
  );
}