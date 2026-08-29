import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LayoutGrid, UserPlus, FolderOpen, Shield, Package, Search,
  LogOut, Download, AlertTriangle, Activity, Pill, History, Calendar,
  FileText, Eye, HeartPulse, Stethoscope, Loader2, Users, Trash2,
  X, CheckCircle2,
} from "lucide-react";
import { api } from "../services/api";
import { filtrarNav, roles, roleLabels } from "../services/permisos";
import LogoMspas from "../components/LogoMspas";
import { jsPDF } from "jspdf";

const navItems = [
  { label: "Panel de Control", icon: LayoutGrid, path: "/" },
  { label: "Registro de Pacientes", icon: UserPlus, path: "/registro" },
  { label: "Expedientes Clínicos", icon: FolderOpen, path: "/expedientes" },
  { label: "Preconsultas", icon: HeartPulse, path: "/preconsulta" },
  { label: "Inventario", icon: Package, path: "/inventario" },
  { label: "Control de Acceso", icon: Shield, path: "/admin" },
];

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
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(true);
  const [expandedVisita, setExpandedVisita] = useState(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const user = JSON.parse(localStorage.getItem("auth") || "{}");
  const nav = filtrarNav(user.rol, navItems);
  const puedeEliminar = ["administrador", "director"].includes(user.rol);

  const handleLogout = () => {
    localStorage.removeItem("auth");
    navigate("/login");
  };

  const fetchData = async () => {
    setPaciente(null);
    setVisitas([]);
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

  const handleDescargarHistorial = () => {
    if (!paciente) return;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;
    const M = 15;
    const innerW = pageW - M * 2;
    let y = M;

    const azul = [0, 94, 184];
    const gris = [66, 71, 82];
    const negro = [25, 28, 30];

    const asegurarEspacio = (alto) => {
      if (y + alto > pageH - M) {
        doc.addPage();
        y = M;
      }
    };

    const separador = (color = azul, ancho = 0.4) => {
      doc.setDrawColor(...color);
      doc.setLineWidth(ancho);
      doc.line(M, y, pageW - M, y);
      y += 4;
    };

    const linea = (titulo, cuerpo) => {
      if (!cuerpo) return;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...negro);
      const label = `${titulo}: `;
      doc.text(label, M, y);
      const labelW = doc.getTextWidth(label);
      doc.setFont("helvetica", "normal");
      const rest = doc.splitTextToSize(cuerpo, innerW - labelW);
      doc.text(rest[0], M + labelW, y);
      for (let k = 1; k < rest.length; k++) {
        doc.text(rest[k], M, y + k * 4.4);
      }
      y += Math.max(rest.length, 1) * 4.4 + 0.5;
    };

    // Encabezado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...azul);
    doc.text("Centro Médico Público de Zaculeu", pageW / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(12);
    doc.setTextColor(...negro);
    doc.text("EXPEDIENTE CLÍNICO", pageW / 2, y, { align: "center" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...gris);
    doc.text(`Generado: ${new Date().toLocaleString("es-GT")}`, pageW / 2, y, { align: "center" });
    y += 2;
    separador();
    y += 2;

    // Datos del paciente
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...negro);
    doc.text(paciente.nombre_completo, M, y);
    y += 6;

    const fila2 = (l1, v1, l2, v2) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...negro);
      doc.text(l1, M, y);
      doc.setFont("helvetica", "normal");
      doc.text(v1, M + 34, y);
      doc.setFont("helvetica", "bold");
      doc.text(l2, pageW / 2 + 5, y);
      doc.setFont("helvetica", "normal");
      doc.text(v2, pageW / 2 + 39, y);
      y += 5;
    };

    fila2("DPI / ID:", paciente.dpi || "—", "Edad:", `${paciente.edad || "—"} años`);
    fila2("Sexo:", paciente.sexo === "M" ? "Masculino" : "Femenino", "Registro:", new Date(paciente.fecha_registro).toLocaleDateString("es-GT"));
    if (paciente.alergias) linea("Alergias", paciente.alergias);
    if (paciente.enfermedades_cronicas) linea("Enfermedades crónicas", paciente.enfermedades_cronicas);
    if (paciente.medicamentos_actuales) linea("Medicamentos actuales", paciente.medicamentos_actuales);
    y += 2;
    separador();

    // Historial
    asegurarEspacio(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...azul);
    doc.text("HISTORIAL DE VISITAS", M, y);
    y += 6;

    if (visitas.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...gris);
      doc.text("No hay visitas registradas.", M, y);
    } else {
      visitas.forEach((v, i) => {
        asegurarEspacio(22);
        const titulo = `Visita ${visitas.length - i} — ${new Date(v.fecha_visita).toLocaleString("es-GT")}`;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...azul);
        doc.text(titulo, M, y);
        const estado = (statusLabel[v.estado] || v.estado).toUpperCase();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...gris);
        doc.text(`[${estado}]`, pageW - M, y, { align: "right" });
        y += 5;

        linea("Motivo", v.motivo_consulta || "Consulta general");
        const vitales = [
          v.presion_sistolica ? `Presión ${v.presion_sistolica}/${v.presion_diastolica || "—"} mmHg` : "",
          v.peso ? `Peso ${v.peso} lb` : "",
          v.talla ? `Altura ${v.talla} m` : "",
          v.imc ? `IMC ${v.imc}` : "",
        ].filter(Boolean).join("  ·  ");
        linea("Signos vitales", vitales);
        linea("Diagnóstico", v.diagnostico);
        linea("Indicaciones", v.indicaciones);
        linea("Observaciones", v.observaciones);
        linea("Seguimiento", v.fecha_seguimiento ? new Date(v.fecha_seguimiento).toLocaleDateString("es-GT") : "");
        linea("Médico", v.nombre_medico);
        separador(gris, 0.2);
        y += 2;
      });
    }

    doc.save(`historial_${paciente.nombre_completo.replace(/\s+/g, "_")}.pdf`);
  };

  const descargarNota = (v) => {
    if (!paciente) return;

    // Tamaño receta médica (media carta en vertical: 139.7 x 215.9 mm)
    const doc = new jsPDF({ unit: "mm", format: [139.7, 215.9] });
    const pageW = 139.7;
    const pageH = 215.9;
    const M = 10;
    const innerW = pageW - M * 2;
    let y = M;

    const azul = [0, 94, 184];
    const gris = [66, 71, 82];
    const negro = [25, 28, 30];

    const separador = () => {
      y += 2;
      doc.setDrawColor(...azul);
      doc.setLineWidth(0.5);
      doc.line(M, y, pageW - M, y);
      y += 4;
    };

    const seccion = (titulo, parrafos) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...azul);
      doc.text(titulo.toUpperCase(), M, y);
      y += 3.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...negro);
      const lines = doc.splitTextToSize(parrafos.join("\n"), innerW);
      doc.text(lines, M, y);
      y += lines.length * 3.4 + 2.5;
    };

    // Marco tipo receta
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(3, 3, pageW - 6, pageH - 6);

    // Encabezado
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...azul);
    doc.text("Centro Médico Público de Zaculeu", pageW / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(11);
    doc.setTextColor(...negro);
    doc.text("NOTA DE CONSULTA GENERAL", pageW / 2, y, { align: "center" });
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...gris);
    doc.text(
      `Atendido el ${new Date(v.fecha_visita).toLocaleString("es-GT")}  ·  Nota emitida el ${new Date().toLocaleDateString("es-GT")}`,
      pageW / 2, y, { align: "center" }
    );
    separador();

    // Datos del paciente
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...negro);
    const colL = M;
    const colR = pageW / 2 + 2;
    doc.setFont("helvetica", "bold");
    doc.text("Paciente:", colL, y);
    doc.text("DPI:", colR, y);
    doc.setFont("helvetica", "normal");
    doc.text(` ${paciente.nombre_completo}`, colL + 14, y);
    doc.text(` ${paciente.dpi || "—"}`, colR + 10, y);
    y += 4.2;
    doc.setFont("helvetica", "bold");
    doc.text("Edad:", colL, y);
    doc.text("Sexo:", colR, y);
    doc.setFont("helvetica", "normal");
    doc.text(` ${paciente.edad || "—"} años`, colL + 14, y);
    doc.text(` ${paciente.sexo === "M" ? "Masculino" : "Femenino"}`, colR + 10, y);
    y += 3;
    separador();

    // Contenido
    seccion("Motivo de Consulta", [v.motivo_consulta || "Consulta general"]);
    const vitales = [
      v.presion_sistolica ? `Presión arterial: ${v.presion_sistolica}/${v.presion_diastolica || "—"} mmHg` : "",
      v.peso ? `Peso: ${v.peso} lb` : "",
      v.talla ? `Altura: ${v.talla} m` : "",
      v.imc ? `IMC: ${v.imc}` : "",
    ].filter(Boolean);
    if (vitales.length) seccion("Signos Vitales", [vitales.join("  ·  ")]);
    if (v.diagnostico) seccion("Diagnóstico", [v.diagnostico]);
    if (v.indicaciones) seccion("Indicaciones / Tratamiento", [v.indicaciones]);
    if (v.observaciones) seccion("Observaciones", [v.observaciones]);
    if (v.fecha_seguimiento) seccion("Próxima Cita", [`${new Date(v.fecha_seguimiento).toLocaleDateString("es-GT")}`]);

    // Firma
    const fy = pageH - 20;
    doc.setDrawColor(...gris);
    doc.setLineWidth(0.3);
    doc.line(M, fy, M + 55, fy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...gris);
    doc.text(v.nombre_medico || "Médico tratante", M, fy + 3.5);
    doc.text("Firma y sello del médico", M, fy + 7);

    doc.save(`nota_${paciente.nombre_completo.replace(/\s+/g, "_")}_${new Date(v.fecha_visita).toISOString().slice(0, 10)}.pdf`);
  };

  const q = busqueda.trim().toLowerCase();

  const pacientesFiltrados = pacientes.filter((p) => {
    return !q
      || (p.nombre_completo || "").toLowerCase().includes(q)
      || (p.dpi || "").includes(q);
  });

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
    <div className="flex h-screen bg-[#f7f9fb] font-sans text-[#191c1e] overflow-hidden">
      <aside className="w-[255px] h-full flex-shrink-0 bg-white border-r border-[#c2c6d4] flex flex-col justify-between">
        <div className="p-4 overflow-y-auto">
          <div className="pb-6">
            <LogoMspas />
            <div className="text-xs text-[#424752] mt-0.5 capitalize">{roleLabels[user.rol] || user.rol}</div>
          </div>
          <nav className="flex flex-col gap-1">
            {nav.map(({ label, icon: Icon, path }) => (
              <div
                key={label}
                onClick={() => navigate(path)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md font-semibold text-sm cursor-pointer ${
                  path === "/expedientes" ? "bg-[#d0e1fb] text-[#00478d]" : "text-[#424752] hover:bg-[#f2f4f6]"
                }`}
              >
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
        <header className="relative h-[74px] shrink-0 bg-white border-b border-[#c2c6d4] flex items-center justify-between px-8 sticky top-0 z-10">
          <div />
          <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#00478d] whitespace-nowrap">
            Centro Médico Público de Zaculeu
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="font-bold text-sm text-[#00478d]">{user.nombre || "Usuario"}</div>
              <div className="text-xs text-[#424752] capitalize">{user.rol || "---"}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#d0e1fb] border border-[#c2c6d4]" />
          </div>
        </header>

        <main className="flex-1 p-10 max-w-[1160px] overflow-auto h-full">
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
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="font-bold text-[26px]">Expedientes Clínicos</h1>
                  <p className="text-sm text-[#424752] mt-1">Selecciona un paciente para ver su historial clínico.</p>
                </div>
                <div className="flex items-center gap-2 bg-white border border-[#c2c6d4] rounded-md px-4 py-2.5 text-sm text-[#424752]">
                  <Search size={16} />
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre o DPI..."
                    className="outline-none bg-transparent w-64"
                  />
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
                  <div className="max-h-[calc(100vh-300px)] overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[#005eb8] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-[#f2f4f6]">
                    <table className="w-full text-left">
                      <thead className="bg-[#f2f4f6] border-b border-[#c2c6d4] sticky top-0 z-10">
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

          <div className="grid grid-cols-3 gap-5 mb-5">
            <InfoCard
              bg="bg-[#ffdad6]"
              titleColor="text-[#ba1a1a]"
              icon={AlertTriangle}
              title="ALERGIAS"
              items={paciente.alergias ? paciente.alergias.split(",").map(a => a.trim()) : ["Sin registro"]}
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

          <div className="bg-white border border-[#c2c6d4] rounded-lg p-7">
            <div className="flex items-center justify-between mb-5">
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
                        <div className="flex gap-3 mt-4 pt-4 border-t border-[#eceef0]">
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
        </main>
      </div>

      {confirmarBorrar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => !borrando && setConfirmarBorrar(null)}>
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
    </div>
  );
}

function InfoCard({ bg, titleColor, icon: Icon, title, items }) {
  return (
    <div className={`${bg} rounded-lg flex gap-3.5 p-5`}>
      <Icon size={20} className={titleColor} />
      <div>
        <div className={`font-bold text-xs tracking-wide mb-2 ${titleColor}`}>{title}</div>
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