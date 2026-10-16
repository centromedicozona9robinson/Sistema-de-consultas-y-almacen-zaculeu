import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search, Download, AlertTriangle, Activity, Pill, History, Calendar,
  FileText, HeartPulse, Stethoscope, Loader2, Users, Trash2,
  X, CheckCircle2,
} from "lucide-react";
import { api } from "../services/api";
import { roles } from "../services/permisos";
import Layout from "../components/Layout";
import {
  PdfBuilder, preloadLogo, fechaCorta, tipoVisitaLegible, factoresLegibles, nombreArchivo,
} from "../utils/pdf";

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

export default function ExpedientesClinicos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id_paciente = searchParams.get("id");

  const [paciente, setPaciente] = useState(null);
  const [visitas, setVisitas] = useState([]);
  const [cronicas, setCronicas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(true);
  const [expandedVisita, setExpandedVisita] = useState(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [editandoAlergias, setEditandoAlergias] = useState(false);
  const [alergiasInput, setAlergiasInput] = useState("");
  const [guardandoAlergias, setGuardandoAlergias] = useState(false);

  const user = JSON.parse(localStorage.getItem("auth") || "{}");
  const puedeEliminar = ["administrador", "director"].includes(user.rol);

  const fetchData = async () => {
    setPaciente(null);
    setVisitas([]);
    setCronicas([]);
    setExpandedVisita(null);
    if (!id_paciente) {
      try {
        const p = await api.getPacientes();
        setPacientes(p);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      const exp = await api.getExpediente(id_paciente);
      setPaciente(exp.paciente);
      setVisitas(exp.visitas);
      setCronicas(exp.cronicas || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id_paciente]);

  useEffect(() => { setBusqueda(searchParams.get("q") || ""); }, [searchParams]);

  const goToPreconsulta = (id_visita) => navigate(`/preconsulta?id_visita=${id_visita}`);
  const goToConsulta = (id_visita) => navigate(`/consulta?id_visita=${id_visita}`);

  const handleEliminarPaciente = async () => {
    if (!confirmarBorrar) return;
    setBorrando(true);
    try {
      await api.eliminarPaciente(confirmarBorrar.id_paciente, user.id);
      setConfirmarBorrar(null);
      if (id_paciente) {
        navigate("/expedientes");
      } else {
        fetchData();
      }
      setFeedback(`El expediente de ${confirmarBorrar.nombre_completo} fue eliminado correctamente.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error(err);
      setFeedback(`No se pudo eliminar el expediente: ${err.message}`);
      setConfirmarBorrar(null);
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setBorrando(false);
    }
  };

  const abrirEditarAlergias = () => {
    setAlergiasInput(paciente?.alergias || "");
    setEditandoAlergias(true);
  };

  const guardarAlergias = async () => {
    if (!paciente) return;
    setGuardandoAlergias(true);
    try {
      await api.actualizarPaciente(paciente.id_paciente, { alergias: alergiasInput.trim() });
      setPaciente((p) => ({ ...p, alergias: alergiasInput.trim() }));
      setEditandoAlergias(false);
    } catch (err) {
      setFeedback({ type: "err", msg: err.message });
    } finally {
      setGuardandoAlergias(false);
    }
  };

  const handleDescargarHistorial = async () => {
    if (!paciente) return;
    const logo = await preloadLogo();
    const pdf = new PdfBuilder({ format: "a4" }).attachLogo(logo);
    pdf.header("Expediente Clínico", paciente.nombre_completo);

    pdf.sectionTitle("Datos del paciente");
    pdf.infoGrid([
      { label: "Nombre completo", value: paciente.nombre_completo },
      { label: "DPI", value: paciente.dpi || "—" },
      { label: "Edad", value: `${paciente.edad || "—"} años` },
      { label: "Sexo", value: paciente.sexo === "M" ? "Masculino" : "Femenino" },
      { label: "Teléfono", value: paciente.telefono || "—" },
      { label: "Registro", value: fechaCorta(paciente.fecha_registro) },
      { label: "Dirección", value: paciente.direccion || "—" },
    ], 2);

    pdf.sectionTitle("Antecedentes");
    pdf.callout(
      paciente.alergias ? `Alergias: ${paciente.alergias}` : "Alergias: no refiere / sin registro",
      paciente.alergias ? "danger" : "info"
    );
    const cronicasTxt = (cronicas || []).map((c) => (c.localizacion ? `${c.grupo} (${c.localizacion})` : c.grupo));
    pdf.keyValue(
      "Enfermedades crónicas",
      cronicasTxt.length ? cronicasTxt.join(", ") : (paciente.enfermedades_cronicas || "Sin registro")
    );
    pdf.keyValue("Medicamentos actuales", paciente.medicamentos_actuales || "Sin registro");
    if (paciente.esta_embarazada || paciente.embarazo_finalizado || paciente.fur || paciente.fpp || paciente.imc_pregestacional != null) {
      const partes = [
        paciente.esta_embarazada ? "En curso" : "Finalizado",
        paciente.fur ? `FUM ${fechaCorta(paciente.fur)}` : "",
        paciente.fpp ? `FPP ${fechaCorta(paciente.fpp)}` : "",
        paciente.semana_gestacion != null ? `${paciente.semana_gestacion} semanas` : "",
        paciente.imc_pregestacional != null ? `IMC pregestacional ${paciente.imc_pregestacional}` : "",
        paciente.peso_habitual_kg != null ? `Peso habitual ${paciente.peso_habitual_kg} kg` : "",
      ].filter(Boolean);
      pdf.keyValue("Embarazo", partes.join("  ·  "));
    }
    pdf.y += 1;

    pdf.sectionTitle(`Historial de visitas (${visitas.length})`);
    if (!visitas.length) {
      pdf.paragraph("No hay visitas registradas para este paciente.");
    } else {
      visitas.forEach((v, i) => {
        const num = visitas.length - i;
        const estado = (statusLabel[v.estado] || v.estado || "").toUpperCase();
        pdf.subheader(`Visita ${num}  ·  ${new Date(v.fecha_visita).toLocaleString("es-GT")}`, estado);

        const vitales = [
          v.presion_sistolica ? { label: "Presión arterial", value: `${v.presion_sistolica}/${v.presion_diastolica || "—"} mmHg` } : null,
          v.frecuencia_cardiaca ? { label: "Frec. cardiaca", value: `${v.frecuencia_cardiaca} lpm` } : null,
          v.frecuencia_respiratoria ? { label: "Frec. respiratoria", value: `${v.frecuencia_respiratoria} rpm` } : null,
          v.temperatura ? { label: "Temperatura", value: `${v.temperatura} °C` } : null,
          v.saturacion_oxigeno ? { label: "Saturación O₂", value: `${v.saturacion_oxigeno} %` } : null,
          v.peso ? { label: "Peso", value: `${v.peso} lb` } : null,
          v.talla ? { label: "Talla", value: `${v.talla} m` } : null,
          v.imc ? { label: "IMC", value: `${v.imc}` } : null,
        ].filter(Boolean);
        if (vitales.length) pdf.infoGrid(vitales, 4);
        if (v.alerta_signos) pdf.callout(`Alerta de signos vitales${v.detalle_alerta ? `: ${v.detalle_alerta}` : ""}`, "danger");
        pdf.keyValue("Motivo / morbilidad", v.motivo_mapeado || v.motivo_consulta || "Consulta general");
        pdf.keyValue("Tipo de visita", tipoVisitaLegible(v.tipo_visita));
        pdf.keyValue("Diagnóstico", v.diagnostico);
        pdf.keyValue("Indicaciones", v.indicaciones);
        const fdr = factoresLegibles(v);
        if (fdr.length) pdf.keyValue("Factores de riesgo", fdr.join(", "));
        pdf.keyValue("Síntomas", v.sintomas);
        pdf.keyValue("Recetado / manejo", v.recetado);
        if (v.recetas && v.recetas.length) pdf.keyValue("Medicamentos dispensados", v.recetas.map((r) => `${r.nombre} (${r.cantidad})`).join(", "));
        pdf.keyValue("Observaciones", v.observaciones);
        pdf.keyValue("Próxima cita", v.fecha_seguimiento ? fechaCorta(v.fecha_seguimiento) : "");
        pdf.keyValue("Atendido por", v.nombre_medico);
        pdf.separador();
      });
    }

    pdf.save(`expediente_${nombreArchivo(paciente.nombre_completo)}.pdf`);
  };

  const descargarNota = async (v) => {
    if (!paciente) return;
    const logo = await preloadLogo();
    const pdf = new PdfBuilder({ format: [139.7, 215.9] }).attachLogo(logo);
    pdf.header("Nota de Visita", `Atendido el ${new Date(v.fecha_visita).toLocaleString("es-GT")}`);

    pdf.sectionTitle("Paciente");
    pdf.infoGrid([
      { label: "Nombre", value: paciente.nombre_completo },
      { label: "DPI", value: paciente.dpi || "—" },
      { label: "Edad", value: `${paciente.edad || "—"} años` },
      { label: "Sexo", value: paciente.sexo === "M" ? "Masculino" : "Femenino" },
    ], 2);

    const vitales = [
      v.presion_sistolica ? { label: "Presión arterial", value: `${v.presion_sistolica}/${v.presion_diastolica || "—"} mmHg` } : null,
      v.frecuencia_cardiaca ? { label: "Frec. cardiaca", value: `${v.frecuencia_cardiaca} lpm` } : null,
      v.frecuencia_respiratoria ? { label: "Frec. respiratoria", value: `${v.frecuencia_respiratoria} rpm` } : null,
      v.temperatura ? { label: "Temperatura", value: `${v.temperatura} °C` } : null,
      v.saturacion_oxigeno ? { label: "Saturación O₂", value: `${v.saturacion_oxigeno} %` } : null,
      v.peso ? { label: "Peso", value: `${v.peso} lb` } : null,
      v.talla ? { label: "Talla", value: `${v.talla} m` } : null,
      v.imc ? { label: "IMC", value: `${v.imc}` } : null,
    ].filter(Boolean);
    if (vitales.length) { pdf.sectionTitle("Signos vitales"); pdf.infoGrid(vitales, 2); }
    if (v.alerta_signos) pdf.callout(`Alerta de signos vitales${v.detalle_alerta ? `: ${v.detalle_alerta}` : ""}`, "danger");

    pdf.sectionTitle("Consulta");
    pdf.keyValue("Motivo / morbilidad", v.motivo_mapeado || v.motivo_consulta || "Consulta general");
    pdf.keyValue("Tipo de visita", tipoVisitaLegible(v.tipo_visita));
    const fdr = factoresLegibles(v);
    if (fdr.length) pdf.keyValue("Factores de riesgo", fdr.join(", "));
    pdf.keyValue("Síntomas", v.sintomas);
    pdf.keyValue("Diagnóstico", v.diagnostico);
    pdf.keyValue("Indicaciones / tratamiento", v.indicaciones);
    if (v.recetas && v.recetas.length) pdf.keyValue("Medicamentos", v.recetas.map((r) => `${r.nombre} (${r.cantidad})${r.dosis ? ` · ${r.dosis}` : ""}`).join(", "));
    pdf.keyValue("Observaciones", v.observaciones);
    pdf.keyValue("Próxima cita", v.fecha_seguimiento ? fechaCorta(v.fecha_seguimiento) : "");

    pdf.firma(v.nombre_medico, "Médico tratante");
    pdf.save(`nota_${nombreArchivo(paciente.nombre_completo)}_${new Date(v.fecha_visita).toISOString().slice(0, 10)}.pdf`);
  };

  const q = busqueda.trim().toLowerCase();

  const pacientesFiltrados = pacientes.filter((p) => {
    return !q
      || (p.nombre_completo || "").toLowerCase().includes(q)
      || (p.dpi || "").includes(q);
  });

  const descargarListadoPacientes = async () => {
    const logo = await preloadLogo();
    const pdf = new PdfBuilder({ format: "a4" }).attachLogo(logo);
    pdf.header("Listado de Pacientes", `Total: ${pacientesFiltrados.length}`);
    const rows = pacientesFiltrados.map((p, i) => [
      String(i + 1),
      p.nombre_completo || "—",
      p.dpi || "—",
      `${p.edad || "—"}`,
      p.sexo === "M" ? "Masculino" : "Femenino",
      p.alergias || "—",
      fechaCorta(p.fecha_registro),
    ]);
    pdf.table(
      ["No.", "Nombre", "DPI", "Edad", "Sexo", "Alergias", "Registro"],
      rows,
      [8, 46, 22, 10, 20, 44, 18]
    );
    pdf.save(`listado_pacientes_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const visitasFiltradas = visitas.filter((v) => {
    if (!q) return true;
    const campos = [
      v.motivo_consulta,
      v.diagnostico,
      v.indicaciones,
      v.observaciones,
      v.detalle_alerta,
      statusLabel[v.estado] || v.estado,
      new Date(v.fecha_visita).toLocaleDateString("es-GT"),
      new Date(v.fecha_visita).toLocaleString("es-GT"),
    ];
    return campos.some((c) => (c || "").toLowerCase().includes(q));
  });

  return (
    <Layout activePath="/expedientes">
      {feedback && (
            <div className={`flex items-center gap-2 text-sm font-semibold px-4 py-3 rounded-lg border mb-5 ${feedback.startsWith("No se pudo") ? "bg-[#ffdad6] text-[#ba1a1a] border-[#f5a9a0]" : "bg-[#dcfce7] text-[#166534] border-[#86efac]"}`}>
              {feedback.startsWith("No se pudo") ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              {feedback}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center h-full text-[#424752]">
              <Loader2 size={32} className="animate-spin text-[#005eb8]" />
            </div>
          ) : !id_paciente ? (
            <div className="flex flex-col h-full">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                  <h1 className="font-bold text-2xl sm:text-3xl">Expedientes Clínicos</h1>
                  <p className="text-[#424752] mt-1">Selecciona un paciente para ver su historial clínico.</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-2 bg-white border border-[#c2c6d4] rounded-md px-4 py-2.5 text-sm text-[#424752] w-full sm:w-72">
                    <Search size={16} className="shrink-0" />
                    <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre o DPI..."
                      className="outline-none bg-transparent w-full" />
                  </div>
                  <button
                    onClick={descargarListadoPacientes}
                    disabled={pacientesFiltrados.length === 0}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#005eb8] hover:bg-[#00478d] text-white rounded-md text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    <Download size={16} /> Descargar listado
                  </button>
                </div>
              </div>
              <div className="bg-white border border-[#c2c6d4] rounded-xl overflow-hidden shadow-sm">
                {pacientesFiltrados.length === 0 ? (
                  <div className="text-center py-16 text-[#727783]">
                    <Users size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">No se encontraron pacientes</p>
                    <p className="text-sm mt-1">Registra pacientes nuevos desde la opción "Registro de Pacientes".</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[860px]">
                      <thead className="bg-[#f2f4f6] border-b border-[#c2c6d4]">
                        <tr>
                          {["PACIENTE", "DPI", "EDAD", "GÉNERO", "REGISTRADO", ...(puedeEliminar ? ["ACCIÓN"] : [])].map((h) => (
                            <th key={h} className="px-6 py-4 font-semibold text-sm text-[#424752]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eceef0]">
                        {pacientesFiltrados.map((p) => (
                          <tr key={p.id_paciente} onClick={() => navigate(`/expedientes?id=${p.id_paciente}`)} className="cursor-pointer hover:bg-[#f7f9fb] transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#d0e1fb] flex items-center justify-center font-bold text-sm text-[#005eb8]">
                                  {p.nombre_completo.split(" ").map(n => n[0]).slice(0, 2).join("")}
                                </div>
                                <span className="font-semibold">{p.nombre_completo}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm text-[#424752]">{p.dpi || "—"}</td>
                            <td className="px-6 py-4 text-sm">{p.edad || "—"} años</td>
                            <td className="px-6 py-4 text-sm">{p.sexo === "M" ? "Masculino" : "Femenino"}</td>
                            <td className="px-6 py-4 text-sm text-[#424752]">{new Date(p.fecha_registro).toLocaleDateString("es-GT")}</td>
                            {puedeEliminar && (
                              <td className="px-6 py-4">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmarBorrar(p);
                                  }}
                                  title={`Eliminar expediente de ${p.nombre_completo}`}
                                  className="p-2 rounded-md text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors"
                                >
                                  <Trash2 size={17} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : !paciente ? (
            <div className="flex items-center justify-center h-full text-[#ba1a1a]">Paciente no encontrado</div>
          ) : (
          <>
          <div className="bg-white border border-[#c2c6d4] border-l-4 border-l-[#005eb8] rounded-lg p-6 mb-5">
            <div className="flex flex-wrap items-center gap-6">
              <div className="w-16 h-16 rounded-full bg-[#d0e1fb] flex items-center justify-center text-2xl">🧑</div>
              <div className="flex-1 min-w-[260px]">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-bold text-[26px]">{paciente.nombre_completo}</div>
                  <span className="bg-[#d0e1fb] text-[#00478d] text-xs font-semibold px-3 py-1 rounded-full">
                    Paciente Activo
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-2 mt-2">
                  {[
                    ["DPI / ID", paciente.dpi || "—"],
                    ["EDAD", `${paciente.edad || "—"} años`],
                    ["GÉNERO", paciente.sexo === "M" ? "Masculino" : "Femenino"],
                    ["ÚLTIMA VISITA", visitas[0] ? new Date(visitas[0].fecha_visita).toLocaleDateString("es-GT") : "—"],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div className="text-[11px] tracking-wide text-[#424752]">{label}</div>
                      <div className="font-bold mt-0.5">{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-[#eceef0]">
              <button onClick={handleDescargarHistorial} className="flex items-center gap-1.5 border border-[#c2c6d4] bg-white rounded px-4 py-2.5 font-semibold text-sm whitespace-nowrap">
                <Download size={16} /> Descargar Historial
              </button>
              {puedeEliminar && (
                <button
                  onClick={() => setConfirmarBorrar(paciente)}
                  title="Eliminar expediente definitivamente"
                  className="flex items-center gap-1.5 border border-[#ba1a1a] bg-white text-[#ba1a1a] rounded px-4 py-2.5 font-semibold text-sm whitespace-nowrap hover:bg-[#ffdad6] transition-colors"
                >
                  <Trash2 size={16} /> Eliminar Expediente
                </button>
              )}
              <button onClick={() => navigate(`/preconsulta?id_paciente=${paciente.id_paciente}`)} className="bg-[#005eb8] text-white rounded font-semibold text-sm whitespace-nowrap px-5 py-2.5 ml-auto">
                Nueva Consulta
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
            <InfoCard
              bg="bg-[#ffdad6]"
              titleColor="text-[#ba1a1a]"
              icon={AlertTriangle}
              title="ALERGIAS"
              action={<button onClick={abrirEditarAlergias} className="text-xs font-semibold underline">Editar</button>}
              items={paciente.alergias ? paciente.alergias.split(",").map(a => a.trim()).filter(Boolean) : ["Sin registro"]}
            />
            <InfoCard
              bg="bg-[#dceeee]"
              titleColor="text-[#006a71]"
              icon={Activity}
              title="ENFERMEDADES CRÓNICAS"
              items={paciente.enfermedades_cronicas ? paciente.enfermedades_cronicas.split(",").map(a => a.trim()) : ["Sin registro"]}
            />
            <InfoCard
              bg="bg-[#d0e1fb]"
              titleColor="text-[#00478d]"
              icon={Pill}
              title="MEDICAMENTOS ACTUALES"
              items={paciente.medicamentos_actuales ? paciente.medicamentos_actuales.split(",").map(a => a.trim()) : ["Sin registro"]}
            />
          </div>

          {(paciente.esta_embarazada || paciente.embarazo_finalizado || paciente.fur || paciente.fpp || paciente.imc_pregestacional != null) && (
            <div className="bg-white border border-[#c2c6d4] border-l-4 border-l-[#ad1457] rounded-lg p-6 mb-5">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-2xl">🤰</span>
                <div className="font-bold text-lg">Embarazo</div>
                {paciente.esta_embarazada && (
                  <span className="bg-[#fce4ec] text-[#ad1457] text-xs font-semibold px-3 py-1 rounded-full">En curso</span>
                )}
                {!paciente.esta_embarazada && paciente.embarazo_finalizado && (
                  <span className="bg-[#eceef0] text-[#424752] text-xs font-semibold px-3 py-1 rounded-full">Finalizado</span>
                )}
                {paciente.fecha_registro_embarazo && (
                  <span className="text-xs text-[#424752] ml-auto">Registrado: {new Date(paciente.fecha_registro_embarazo).toLocaleDateString("es-GT")}</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  ["FUM (última regla)", paciente.fur ? new Date(paciente.fur).toLocaleDateString("es-GT") : "—"],
                  ["FPP (probable parto)", paciente.fpp ? new Date(paciente.fpp).toLocaleDateString("es-GT") : "—"],
                  ["Semanas de gestación", paciente.semana_gestacion != null ? `${paciente.semana_gestacion} semanas` : "—"],
                  ["IMC pregestacional", paciente.imc_pregestacional != null ? paciente.imc_pregestacional : "—"],
                  ["Peso habitual", paciente.peso_habitual_kg != null ? `${paciente.peso_habitual_kg} kg` : "—"],
                  ["Estado", paciente.esta_embarazada ? "Embarazada" : (paciente.embarazo_finalizado ? "Finalizado" : "—")],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div className="text-[11px] tracking-wide text-[#424752]">{label}</div>
                    <div className="font-bold mt-0.5">{val}</div>
                  </div>
                ))}
              </div>
              {paciente.embarazo_finalizado && paciente.fecha_embarazo_finalizado && (
                <div className="mt-4 pt-3 border-t border-[#eceef0] text-sm text-[#424752]">
                  Finalizado el {new Date(paciente.fecha_embarazo_finalizado).toLocaleDateString("es-GT")}
                  {paciente.motivo_embarazo_finalizado ? ` · ${paciente.motivo_embarazo_finalizado}` : ""}
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-[#c2c6d4] rounded-lg p-7">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
              <div className="flex items-center gap-2.5 font-bold text-xl">
                <History size={20} /> Historial de Visitas
              </div>
              <span className="text-sm text-[#424752]">
                {q ? `${visitasFiltradas.length} de ${visitas.length} registro(s)` : `${visitas.length} registro(s)`}
              </span>
            </div>

            {q && visitasFiltradas.length === 0 && (
              <div className="text-center py-16 text-[#727783]">
                <Search size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No se encontraron visitas con "{busqueda.trim()}"</p>
                <p className="text-sm mt-1">Prueba buscando por motivo, diagnóstico, indicaciones o fecha.</p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {visitasFiltradas.map((v) => {
                const hasPreconsulta = v.presion_sistolica || v.peso || v.talla;
                const hasConsulta = v.diagnostico || v.indicaciones;
                return (
                  <div key={v.id_visita} className="border border-[#eceef0] rounded-lg overflow-hidden">
                    <div
                      onClick={() => setExpandedVisita(expandedVisita === v.id_visita ? null : v.id_visita)}
                      className="w-full px-5 py-4 flex items-center justify-between bg-[#fafbfc] hover:bg-[#f2f4f6] transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${v.estado === "completado" ? "bg-[#d0e1fb]" : v.estado === "en_triaje" ? "bg-[#c7f0f4]" : "bg-[#ffdad6]"}`}>
                          <Calendar size={18} className={v.estado === "completado" ? "text-[#00478d]" : v.estado === "en_triaje" ? "text-[#006a71]" : "text-[#ba1a1a]"} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="font-bold text-[17px]">{v.motivo_consulta || "Consulta general"}</div>
                            <span className={`text-xs font-semibold px-3 py-1 rounded whitespace-nowrap ${statusStyles[v.estado] || "bg-[#eceef0] text-[#424752]"}`}>
                              {statusLabel[v.estado] || v.estado}
                            </span>
                            {v.tipo_visita && (
                              <span className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap bg-[#f0e6ff] text-[#6b21a8]">
                                {v.tipo_visita}
                              </span>
                            )}
                            {hasConsulta && (v.version > 1) && (
                              <span className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap bg-[#d0e1fb] text-[#00478d]">
                                v{v.version}
                              </span>
                            )}
                            {hasConsulta && (
                              <span className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${v.entregado ? "bg-[#dceeee] text-[#006a71]" : "bg-[#fff5e5] text-[#8a5a00]"}`}>
                                {v.entregado ? "Entregado" : "Sin entregar"}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#424752] mt-0.5">
                            {new Date(v.fecha_visita).toLocaleString("es-GT")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {hasPreconsulta && (
                          <span className="flex items-center gap-1 text-xs text-[#006a71] font-medium">
                            <HeartPulse size={12} /> Signos vitales
                          </span>
                        )}
                        {hasConsulta && (
                          <span className="flex items-center gap-1 text-xs text-[#00478d] font-medium">
                            <Stethoscope size={12} /> Diagnóstico
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); descargarNota(v); }}
                          className="flex items-center gap-1 text-xs font-semibold text-[#00478d] border border-[#c2c6d4] rounded px-2.5 py-1.5 hover:bg-[#d0e1fb] transition-colors whitespace-nowrap"
                          title="Descargar la nota de esta consulta"
                        >
                          <Download size={14} /> Nota
                        </button>
                        <span className="text-[#424752]">
                          {expandedVisita === v.id_visita ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>

                    {expandedVisita === v.id_visita && (
                      <div className="px-5 pb-5 border-t border-[#eceef0] bg-white animate-slide-down">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          {hasPreconsulta && (
                            <div className="bg-[#f0fdf4] border border-[#86efac] rounded-lg p-5">
                              <div className="flex items-center gap-2 text-[#166534] font-semibold mb-4">
                                <HeartPulse size={18} /> Signos Vitales (Preconsulta)
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <VitalDisplay label="Presión" value={`${v.presion_sistolica || "—"}/${v.presion_diastolica || "—"}`} unit="mmHg" />
                                <VitalDisplay label="Temperatura" value={v.temperatura || "—"} unit="°C" />
                                <VitalDisplay label="Peso" value={v.peso || "—"} unit="lb" />
                                <VitalDisplay label="Altura" value={v.talla || "—"} unit="m" />
                                <VitalDisplay label="IMC" value={v.imc || "—"} unit="" />
                              </div>
                              {v.alerta_signos && (
                                <div className="mt-3 p-2 bg-[#fef2f2] border border-[#fecaca] rounded text-sm text-[#991b1b]">
                                  <AlertTriangle size={14} className="inline-block mr-1" />
                                  <strong>Alerta:</strong> {v.detalle_alerta}
                                </div>
                              )}
                            </div>
                          )}
                          {hasConsulta && (
                            <div className="bg-[#eff6ff] border border-[#93c5fd] rounded-lg p-5">
                              <div className="flex items-center gap-2 text-[#1e40af] font-semibold mb-4">
                                <Stethoscope size={18} /> Consulta Médica
                              </div>
                              <div className="space-y-3 text-sm">
                                <div>
                                  <div className="text-[11px] tracking-wide text-[#1e40af] mb-1">DIAGNÓSTICO</div>
                                  <p className="font-medium">{v.diagnostico || "—"}</p>
                                </div>
                                <div>
                                  <div className="text-[11px] tracking-wide text-[#1e40af] mb-1">INDICACIONES</div>
                                  <p className="font-medium">{v.indicaciones || "—"}</p>
                                </div>
                                {v.recetas && v.recetas.length > 0 && (
                                  <div>
                                    <div className="text-[11px] tracking-wide text-[#1e40af] mb-1">MEDICAMENTOS DISPENSADOS</div>
                                    <ul className="space-y-1">
                                      {v.recetas.map((r, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm font-medium">
                                          <Pill size={14} className="text-[#00478d]" />
                                          {r.nombre} <span className="text-[#424752]">· Cantidad: {r.cantidad}</span>
                                          {r.dosis ? <span className="text-[#424752]">· {r.dosis}</span> : null}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {v.observaciones && (
                                  <div>
                                    <div className="text-[11px] tracking-wide text-[#1e40af] mb-1">OBSERVACIONES</div>
                                    <p className="font-medium">{v.observaciones}</p>
                                  </div>
                                )}
                                {v.fecha_seguimiento && (
                                  <div className="flex items-center gap-2 text-xs text-[#1e40af]">
                                    <Calendar size={12} /> Seguimiento: {new Date(v.fecha_seguimiento).toLocaleDateString("es-GT")}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 mt-4 pt-4 border-t border-[#eceef0]">
                          {v.estado === "pendiente" && roles.triaje.includes(user.rol) && (
                            <button onClick={() => goToPreconsulta(v.id_visita)} className="flex-1 bg-[#006a71] hover:bg-[#004d56] text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                              <HeartPulse size={16} /> Ir a Triaje
                            </button>
                          )}
                          {v.estado === "en_triaje" && roles.consulta.includes(user.rol) && (
                            <button onClick={() => goToConsulta(v.id_visita)} className="flex-1 bg-[#00478d] hover:bg-[#003366] text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2">
                              <Stethoscope size={16} /> Ir a Consulta
                            </button>
                          )}
                          <button onClick={() => goToPreconsulta(v.id_visita)} className="flex-1 border border-[#c2c6d4] bg-white text-[#424752] py-2.5 rounded-lg font-semibold hover:bg-[#f2f4f6]">
                            Ver Preconsulta
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {visitas.length === 0 && (
              <div className="text-center py-16 text-[#727783]">
                <FileText size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No hay visitas registradas</p>
                <p className="text-sm mt-1">Este paciente aún no tiene historial en el sistema.</p>
              </div>
            )}
          </div>
          </>
          )}

      {confirmarBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !borrando && setConfirmarBorrar(null)}>
          <div className="bg-white rounded-xl p-6 w-[400px] max-w-[90vw] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-[#ffdad6] flex items-center justify-center text-[#ba1a1a] shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg leading-snug">¿Eliminar expediente?</h3>
                <p className="text-sm text-[#424752] mt-2 leading-relaxed">
                  Se eliminará <strong>{confirmarBorrar.nombre_completo}</strong> junto con todo su historial clínico
                  (visitas, preconsultas, consultas, prescripciones y dispensaciones).{" "}
                  <strong>Esta acción es permanente y no se puede deshacer.</strong>
                </p>
              </div>
              <button
                onClick={() => !borrando && setConfirmarBorrar(null)}
                className="text-[#727783] hover:bg-[#f2f4f6] rounded-md p-1.5"
                title="Cancelar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirmarBorrar(null)}
                disabled={borrando}
                className="flex-1 border border-[#c2c6d4] bg-white text-[#424752] py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarPaciente}
                disabled={borrando}
                className="flex-1 bg-[#ba1a1a] hover:bg-[#8f1414] text-white py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {borrando ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {borrando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {editandoAlergias && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !guardandoAlergias && setEditandoAlergias(false)}>
          <div className="bg-white rounded-xl p-6 w-[440px] max-w-[95vw] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg">Editar alergias</h3>
                <p className="text-sm text-[#424752] mt-1">Ingrese alergias separadas por coma (ej. Penicilina, Sulfas).</p>
              </div>
              <button
                onClick={() => !guardandoAlergias && setEditandoAlergias(false)}
                className="text-[#727783] hover:bg-[#f2f4f6] rounded-md p-1.5"
                title="Cancelar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4">
              <textarea
                value={alergiasInput}
                onChange={(e) => setAlergiasInput(e.target.value)}
                rows={4}
                className="w-full border border-[#c2c6d4] rounded-lg p-2.5 text-sm"
                placeholder="Ninguna / Penicilina, Ácido acetilsalicílico"
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditandoAlergias(false)}
                disabled={guardandoAlergias}
                className="flex-1 border border-[#c2c6d4] bg-white text-[#424752] py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardarAlergias}
                disabled={guardandoAlergias}
                className="flex-1 bg-[#005eb8] text-white py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {guardandoAlergias ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {guardandoAlergias ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
      </Layout>
  );
}

function InfoCard({ bg, titleColor, icon: Icon, title, items, action }) {
  return (
    <div className={`${bg} rounded-lg flex gap-3.5 p-5`}>
      <Icon size={20} className={titleColor} />
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className={`font-bold text-xs tracking-wide mb-2 ${titleColor}`}>{title}</div>
          {action}
        </div>
        <ul className="text-sm">
          {items.map((i) => (
            <li key={i} className="font-bold mt-0.5">{i}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function VitalDisplay({ label, value, unit }) {
  return (
    <div className="bg-white border border-[#bbf7d0] rounded-md px-3 py-2">
      <div className="text-[10px] tracking-wide text-[#166534]">{label}</div>
      <div className="font-bold mt-0.5">{value} <span className="text-xs font-normal text-[#166534]">{unit}</span></div>
    </div>
  );
}