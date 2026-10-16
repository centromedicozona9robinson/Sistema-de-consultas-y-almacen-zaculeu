import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, HeartPulse, Weight, Ruler, Calculator, Flag, AlertTriangle } from "lucide-react";
import { api } from "../services/api";
import { roles } from "../services/permisos";
import Layout from "../components/Layout";

const VITAL_RANGES = {
  presion_arterial: { label: "PRESIÓN ARTERIAL", unit: "mmHg", icon: HeartPulse, color: "#e53e3e", type: "text", placeholder: "120/80" },
  temperatura: { label: "TEMPERATURA", unit: "°C", icon: HeartPulse, color: "#e53e3e", step: 0.1, min: 34, max: 42 },
  peso: { label: "PESO", unit: "lb", icon: Weight, color: "#805ad5", step: 0.1, min: 2, max: 660 },
  talla: { label: "ALTURA", unit: "m", icon: Ruler, color: "#d69e2e", step: 0.01, min: 0.3, max: 2.5 },
};

// Grupos del catálogo que se muestran por su nombre base (sin el rango de edad;
// el rango lo resuelve el sistema según la edad del paciente y se usa en
// estadísticas). "Cáncer" pide además la localización.
const GRUPOS_PRINCIPALES = [
  "Diabetes Mellitus",
  "Hipertensión Arterial",
  "Insuficiencia Renal Crónica",
  "Enfermedades Cardiovasculares",
  "Cáncer",
];
const GRUPO_CANCER = "Cáncer";
const GRUPO_CANCER_LOC = "Cáncer - Localización";

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
  const [catalogoCronicos, setCatalogoCronicos] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarSug, setMostrarSug] = useState(false);
  const [estaEmbarazada, setEstaEmbarazada] = useState(false);
  const [imcPreg, setImcPreg] = useState('');
  const [pesoHabitual, setPesoHabitual] = useState('');
  const [fur, setFur] = useState('');
  const [fpp, setFpp] = useState('');
  const [semanaGest, setSemanaGest] = useState('');
  const [tipoVisita, setTipoVisita] = useState({ consulta:false, reconsulta:false });
  const [motivosPrevios, setMotivosPrevios] = useState([]);
  const [cronicasPaciente, setCronicasPaciente] = useState([]);
  const [factores, setFactores] = useState({ sobrepeso:false, obesidad:false, circ_abdominal:false, riesgo_ecv_elevado:false, circ_abdominal_cm:'', circ_abdominal_fecha:'', riesgo_ecv_observacion:'' });

  const user = JSON.parse(localStorage.getItem("auth") || "{}");

  const cargarMotivosPrevios = async (idp) => {
    try {
      const r = await api.getMotivosPrevios(idp, id_visita || undefined);
      setMotivosPrevios([...(r.motivos || []), ...(r.cronicas || [])]);
    } catch (e) { setMotivosPrevios([]); }
  };

  const cargarDatosCronicos = async (pac) => {
    if (!pac?.id_paciente) return;
    try {
      const edadCalc = pac.fecha_nacimiento ? new Date().getFullYear() - new Date(pac.fecha_nacimiento).getFullYear() : null;
      const cat = await api.getCatalogoEnfermedades(edadCalc, pac.sexo);
      setCatalogoCronicos(cat);
    } catch (e) {}
    try {
      const cr = await api.getEnfermedadesCronicasPaciente(pac.id_paciente);
      setCronicasPaciente(cr);
      setSeleccion(cr.map((x) => ({
        id: x.id_enfermedad_cronica,
        label: GRUPOS_PRINCIPALES.includes(x.grupo) ? x.grupo : x.nombre,
        grupo: x.grupo,
        requiere_localizacion: !!x.requiere_localizacion,
        localizacion: x.localizacion || '',
        guardadoId: x.id_paciente_enfermedad_cronica,
      })));
    } catch (e) {}
    cargarMotivosPrevios(pac.id_paciente);
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
            fecha_nacimiento: v.fecha_nacimiento,
          });
          cargarDatosCronicos(v);
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
          if (pre.tipo_visita) {
            setTipoVisita({ consulta: pre.tipo_visita.includes('CONSULTA'), reconsulta: pre.tipo_visita.includes('RECONSULTA') });
          }
          if (pre.temperatura !== undefined) formInit.temperatura = pre.temperatura;
          if (pre.sintomas !== undefined) formInit.sintomas = pre.sintomas;
          if (pre.hallazgos !== undefined) formInit.hallazgos = pre.hallazgos;
          if (pre.recetado !== undefined) formInit.recetado = pre.recetado;
          formInit.alergias = pre.alergias || '';
          setForm(formInit);
          setImc(computeImc(formInit));
          setAlertas(getAlertas(formInit));
          try{const fr=await api.getFactoresRiesgo(id_visita); if(fr){setFactores({sobrepeso:fr.sobrepeso,obesidad:fr.obesidad,circ_abdominal:fr.circ_abdominal,riesgo_ecv_elevado:fr.riesgo_ecv_elevado,circ_abdominal_cm:fr.circ_abdominal_cm||'',circ_abdominal_fecha:fr.circ_abdominal_fecha||'',riesgo_ecv_observacion:fr.riesgo_ecv_observacion||''})}}catch(e){}
        } catch (e) {}
      }
      if (id_paciente) {
        const exp = await api.getExpediente(id_paciente);
        setPaciente(exp.paciente);
        cargarDatosCronicos(exp.paciente);
        setForm(f => ({ ...f, alergias: f.alergias || exp.paciente.alergias || '' }));
        if (exp.paciente.esta_embarazada) setEstaEmbarazada(true);
        if (exp.paciente.imc_pregestacional) setImcPreg(exp.paciente.imc_pregestacional);
        if (exp.paciente.peso_habitual_kg) setPesoHabitual(exp.paciente.peso_habitual_kg);
        if (exp.paciente.fur) setFur(exp.paciente.fur);
        if (exp.paciente.fpp) setFpp(exp.paciente.fpp);
        if (exp.paciente.semana_gestacion) setSemanaGest(exp.paciente.semana_gestacion);
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
    if (!p || !t || t <= 0) return null;
    // Peso en libras → kg (÷2.2); IMC = kg / m²
    return ((p / 2.2) / (t * t)).toFixed(2);
  };


function clasificarEdad(fechaNac, fechaRef) {
  if (!fechaNac) return '';
  const ref = fechaRef ? new Date(fechaRef) : new Date();
  const nac = new Date(fechaNac);
  let anos = ref.getFullYear() - nac.getFullYear();
  let mes = ref.getMonth() - nac.getMonth();
  let dia = ref.getDate() - nac.getDate();
  if (dia < 0) mes--;
  if (mes < 0) anos--;
  if (anos < 0) anos = 0;
  // calcular días totales aprox para neonatos
  const diffDias = Math.floor((ref - nac) / (1000*60*60*24));
  if (diffDias <= 28) return 'Neonato';
  if (anos < 10) return 'Niñez';
  if (anos < 20) return 'Adolescente';
  if (anos < 30) return 'Juventud';
  if (anos < 60) return 'Persona adulta';
  return 'Adulto mayor';
}

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

  const normaliza = (s) => (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

  const edadPaciente = useMemo(() => {
    if (!paciente?.fecha_nacimiento) return null;
    const ref = visita?.fecha_visita ? new Date(visita.fecha_visita) : new Date();
    const nac = new Date(paciente.fecha_nacimiento);
    let anos = ref.getFullYear() - nac.getFullYear();
    const m = ref.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < nac.getDate())) anos--;
    return anos >= 0 ? anos : null;
  }, [paciente?.fecha_nacimiento, visita?.fecha_visita]);

  // Opciones del buscador: enfermedades por grupo (sin rango de edad, ese lo
  // resuelve el sistema y se usa en estadísticas) + localizaciones de cáncer.
  const opciones = useMemo(() => {
    const lista = [];
    const porGrupo = {};
    (catalogoCronicos || []).forEach((c) => { (porGrupo[c.grupo] ||= []).push(c); });
    GRUPOS_PRINCIPALES.forEach((g) => {
      const rows = porGrupo[g];
      if (!rows || !rows.length) return;
      const pick = rows.find((r) => edadPaciente === null || (r.edad_min <= edadPaciente && r.edad_max >= edadPaciente)) || rows[0];
      lista.push({
        key: `${g}-${pick.id_enfermedad_cronica}`,
        id: pick.id_enfermedad_cronica,
        label: g,
        grupo: g,
        requiere_localizacion: !!pick.requiere_localizacion,
      });
    });
    (porGrupo[GRUPO_CANCER_LOC] || []).forEach((r) => {
      lista.push({
        key: `${r.grupo}-${r.id_enfermedad_cronica}`,
        id: r.id_enfermedad_cronica,
        label: r.nombre,
        grupo: r.grupo,
        requiere_localizacion: false,
      });
    });
    return lista;
  }, [catalogoCronicos, edadPaciente]);

  const localizacionesCancer = useMemo(
    () => (catalogoCronicos || []).filter((c) => c.grupo === GRUPO_CANCER_LOC),
    [catalogoCronicos]
  );

  const sugerencias = useMemo(() => {
    const q = normaliza(busqueda);
    const yaSel = new Set(seleccion.map((s) => s.id));
    return opciones
      .filter((o) => !yaSel.has(o.id) && (!q || normaliza(o.label).includes(q)))
      .slice(0, 8);
  }, [opciones, busqueda, seleccion]);

  const agregarSeleccion = (op) => {
    setSeleccion((s) => (s.some((x) => x.id === op.id) ? s : [...s, { ...op, localizacion: "", guardadoId: null }]));
    setBusqueda("");
    setMostrarSug(false);
  };
  const quitarSeleccion = (id) => setSeleccion((s) => s.filter((x) => x.id !== id));
  const setLocalizacion = (id, val) => setSeleccion((s) => s.map((x) => (x.id === id ? { ...x, localizacion: val } : x)));

  // Tipo de visita automático por morbilidad: si la enfermedad ya se registró
  // antes → Reconsulta; si es nueva → Primera Consulta; si hay de ambos → AMBAS.
  useEffect(() => {
    const actuales = seleccion.map((s) => normaliza(s.label)).filter(Boolean);
    if (actuales.length === 0) return;
    const previos = (motivosPrevios || []).map(normaliza).filter(Boolean);
    const esPrevio = (m) => previos.some((p) => p === m || p.includes(m) || m.includes(p));
    const nuevas = actuales.filter((m) => !esPrevio(m));
    const viejas = actuales.filter(esPrevio);
    setTipoVisita({ consulta: nuevas.length > 0, reconsulta: viejas.length > 0 });
  }, [seleccion, motivosPrevios]);

  // Factores de riesgo automáticos según IMC (peso en libras)
  useEffect(() => {
    const p = parseFloat(form.peso);
    const t = parseFloat(form.talla);
    const imcCalc = p && t && t > 0 ? ((p / 2.2) / (t * t)) : null;
    setFactores((f) => ({
      ...f,
      sobrepeso: imcCalc >= 25 && imcCalc < 30,
      obesidad: imcCalc >= 30,
      sobrepeso_imc: imcCalc >= 25 && imcCalc < 30 ? imcCalc.toFixed(2) : null,
      obesidad_imc: imcCalc >= 30 ? imcCalc.toFixed(2) : null,
    }));
  }, [form.peso, form.talla]);

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
      const motivoMapeado = seleccion
        .map((s) => (s.grupo === GRUPO_CANCER && s.localizacion ? `${s.label} (${s.localizacion})` : s.label))
        .join(', ') || null;
      const tipoV = tipoVisita.consulta && tipoVisita.reconsulta ? 'AMBAS' : (tipoVisita.consulta ? 'CONSULTA' : (tipoVisita.reconsulta ? 'RECONSULTA' : null));
      const data = { ...form, id_visita: visitaId, id_usuario_registro: user.id, tipo_visita: tipoV, es_consulta: tipoVisita.consulta, es_reconsulta: tipoVisita.reconsulta, motivo_mapeado: motivoMapeado, sintomas: form.sintomas||null, recetado: form.recetado||null };
      delete data.imc;
      await api.registrarPreconsulta(data);

      // Guardar/actualizar enfermedades crónicas del paciente (altas y bajas).
      // Se registra una sola vez y en la siguiente consulta ya viene precargado.
      if (paciente?.id_paciente) {
        try {
          const origPorId = new Map(cronicasPaciente.map((x) => [x.id_enfermedad_cronica, x]));
          for (const s of seleccion) {
            const orig = origPorId.get(s.id);
            const localCambio = orig && (orig.localizacion || '') !== (s.localizacion || '');
            if (!s.guardadoId || localCambio) {
              if (localCambio) await api.eliminarEnfermedadCronicaPaciente(orig.id_paciente_enfermedad_cronica);
              await api.agregarEnfermedadCronicaPaciente(paciente.id_paciente, {
                id_enfermedad_cronica: s.id,
                localizacion: s.localizacion || null,
                id_usuario_registro: user.id,
              });
            }
          }
          const idsSel = new Set(seleccion.map((s) => s.id));
          for (const ex of cronicasPaciente) {
            if (!idsSel.has(ex.id_enfermedad_cronica)) {
              await api.eliminarEnfermedadCronicaPaciente(ex.id_paciente_enfermedad_cronica);
            }
          }
        } catch (e) { console.error(e); }
      }

      // Alergias del paciente (se guardan en el expediente).
      if (paciente?.id_paciente) {
        try {
          await api.actualizarPaciente(paciente.id_paciente, { alergias: (form.alergias || '').trim() });
        } catch (e) { console.error(e); }
      }

      // Registro de embarazo en el expediente clínico (se guarda con la preconsulta).
      if (paciente?.id_paciente && estaEmbarazada) {
        try {
          await api.actualizarPaciente(paciente.id_paciente, {
            esta_embarazada: true,
            imc_pregestacional: imcPreg || null,
            peso_habitual_kg: pesoHabitual || null,
            fur: fur || null,
            fpp: fpp || null,
            semana_gestacion: semanaGest || null,
            usuario_registro_embarazo: user.id,
          });
        } catch (e) { console.error(e); }
      }

      // Factores de riesgo y tamizajes: se calculan/guardan automáticamente.
      try {
        const p = parseFloat(form.peso);
        const t = parseFloat(form.talla);
        const imcCalc = p && t && t > 0 ? ((p / 2.2) / (t * t)) : null;
        const cm = parseFloat(factores.circ_abdominal_cm);
        const circTomada = (edadPaciente === null || edadPaciente >= 20) && !isNaN(cm) && cm > 0;
        await api.guardarFactoresRiesgo({
          id_visita: visitaId,
          id_usuario_registro: user.id,
          sobrepeso: imcCalc >= 25 && imcCalc < 30,
          sobrepeso_imc: (imcCalc >= 25 && imcCalc < 30) ? imcCalc.toFixed(2) : null,
          obesidad: imcCalc >= 30,
          obesidad_imc: imcCalc >= 30 ? imcCalc.toFixed(2) : null,
          circ_abdominal: circTomada,
          circ_abdominal_cm: circTomada ? cm : null,
          circ_abdominal_fecha: circTomada ? (factores.circ_abdominal_fecha || new Date().toISOString().slice(0, 10)) : null,
          riesgo_ecv_elevado: !!(factores.riesgo_ecv_observacion || '').trim(),
          riesgo_ecv_observacion: factores.riesgo_ecv_observacion || null,
        });
      } catch (e) { console.error(e); }
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

  const imcNum = imc != null && imc !== '' ? parseFloat(imc) : NaN;
  const esSobrepeso = !isNaN(imcNum) && imcNum >= 25 && imcNum < 30;
  const esObesidad = !isNaN(imcNum) && imcNum >= 30;
  const aplicaCircunferencia = edadPaciente === null || edadPaciente >= 20;

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 size={32} className="animate-spin text-[#005eb8]" /></div>;

  if (!paciente && !visita) {
    if (id_visita || id_paciente) {
      return <div className="flex h-screen items-center justify-center text-[#ba1a1a]">Visita o paciente no encontrado</div>;
    }
    return (
      <Layout activePath="/preconsulta" mainClassName="p-6 sm:p-8 max-w-4xl mx-auto w-full">
        <h1 className="font-bold text-2xl sm:text-3xl">Preconsultas del Día</h1>
        <p className="text-sm text-[#424752] mt-1 mb-6">Selecciona un paciente en espera para tomar sus signos vitales.</p>
        {cola === null ? null : cola.length === 0 ? (
          <div className="bg-white border border-[#c2c6d4] rounded-xl text-center py-16 px-4">
            <HeartPulse size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No hay pacientes en espera</p>
            <p className="text-sm mt-1">Los pacientes que se registren hoy aparecerán aquí.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cola.map((v) => (
              <div key={v.id_visita} className="bg-white border border-[#c2c6d4] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-[#006a71] transition-colors">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${v.estado === "pendiente" ? "bg-[#ffdad6] text-[#ba1a1a]" : "bg-[#c7f0f4] text-[#006a71]"}`}>
                  {(v.nombre_completo || "?").split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="font-bold truncate">{v.nombre_completo}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${v.estado === "pendiente" ? "bg-[#ffdad6] text-[#ba1a1a]" : "bg-[#c7f0f4] text-[#006a71]"}`}>
                      {v.estado === "pendiente" ? "PENDIENTE" : "EN TRIAJE"}
                    </span>
                  </div>
                  <div className="text-xs text-[#424752] mt-0.5">
                    DPI: {v.dpi || "—"} · Edad: {v.edad ?? "—"} años · {new Date(v.fecha_visita).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {(v.motivo_mapeado || v.motivo_consulta || v.sintomas) && (
                    <div className="text-xs mt-1.5 bg-[#e6f2f3] border border-[#9ed0d3] text-[#004d56] rounded px-2 py-1">
                      {(v.motivo_mapeado || v.motivo_consulta) && (
                        <span><strong className="font-semibold">Motivo:</strong> {v.motivo_mapeado || v.motivo_consulta}</span>
                      )}
                      {(v.motivo_mapeado || v.motivo_consulta) && v.sintomas && <span className="mx-1">·</span>}
                      {v.sintomas && <span><strong className="font-semibold">Refiere:</strong> {v.sintomas}</span>}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/preconsulta?id_visita=${v.id_visita}`)}
                  className="bg-[#006a71] hover:bg-[#004d56] text-white px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-colors w-full sm:w-auto"
                >
                  Tomar Signos Vitales
                </button>
              </div>
            ))}
          </div>
        )}
      </Layout>
    );
  }

  return (
    <Layout activePath="/preconsulta" mainClassName="p-6 sm:p-8 max-w-4xl mx-auto w-full">
      <div className="bg-white border border-[#c2c6d4] border-l-4 border-l-[#006a71] rounded-lg p-5 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-12 h-12 rounded-full bg-[#dceeee] flex items-center justify-center text-xl">🧑</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg sm:text-xl">{paciente?.nombre_completo || "Paciente no cargado"}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-[#424752]">
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

                    <div className="bg-white border border-[#c2c6d4] rounded-lg p-4 mb-4">
            <div className="text-sm font-semibold text-[#424752]">Clasificación de Edad</div>
            <div className="text-base font-bold">{clasificarEdad(paciente?.fecha_nacimiento, visita?.fecha_visita)}</div>
          </div>

          <div className="bg-white border border-[#c2c6d4] rounded-lg p-4 mb-4 space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Motivo de consulta / Morbilidad</label>
              <div className="relative">
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e)=>{ setBusqueda(e.target.value); setMostrarSug(true); }}
                  onFocus={()=>setMostrarSug(true)}
                  onBlur={()=>setTimeout(()=>setMostrarSug(false), 150)}
                  placeholder="Escribe una enfermedad (ej. Diabetes, Hipertensión, Cáncer...)"
                  className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20"
                />
                {mostrarSug && sugerencias.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-[#c2c6d4] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {sugerencias.map((op) => (
                      <button type="button" key={op.key} onMouseDown={(e)=>e.preventDefault()} onClick={()=>agregarSeleccion(op)} className="block w-full text-left px-3 py-2 text-sm hover:bg-[#f2f4f6]">
                        {op.label}
                        {op.grupo === GRUPO_CANCER_LOC && <span className="text-xs text-[#424752]"> · localización</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-[#424752] mt-1">Escribe y selecciona de la lista. Se guarda una sola vez y en la próxima consulta ya aparece cargado.</p>
            </div>

            {seleccion.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {seleccion.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 bg-[#e6f2f3] border border-[#9ed0d3] text-[#004d56] rounded-full pl-3 pr-1.5 py-1 text-sm">
                    <span className="font-medium">{s.label}</span>
                    {s.grupo === GRUPO_CANCER && (
                      <select
                        value={s.localizacion || ''}
                        onChange={(e)=>setLocalizacion(s.id, e.target.value)}
                        className="text-xs border border-[#9ed0d3] rounded bg-white px-1 py-0.5"
                      >
                        <option value="">Localización…</option>
                        {localizacionesCancer.map((l) => (
                          <option key={l.id_enfermedad_cronica} value={l.nombre}>{l.nombre.replace(/^Cáncer\s+/i, '')}</option>
                        ))}
                      </select>
                    )}
                    <button type="button" onClick={()=>quitarSeleccion(s.id)} className="w-5 h-5 rounded-full hover:bg-[#c7e4e6] text-[#004d56] font-bold leading-none" title="Quitar">×</button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <div className="text-sm font-semibold mb-2">Tipo de Visita (automático)</div>
              <div className="flex gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tipoVisita.consulta ? 'bg-[#d0e1fb] text-[#00478d]' : 'bg-[#eceef0] text-[#8a8f99]'}`}>PRIMERA CONSULTA</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tipoVisita.reconsulta ? 'bg-[#d0e1fb] text-[#00478d]' : 'bg-[#eceef0] text-[#8a8f99]'}`}>RECONSULTA</span>
                {tipoVisita.consulta && tipoVisita.reconsulta && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#00478d] text-white">AMBAS</span>}
              </div>
            </div>
          </div>

          {paciente && paciente.sexo === "F" && paciente.fecha_nacimiento && (() => { let a = new Date().getFullYear() - new Date(paciente.fecha_nacimiento).getFullYear(); let m = new Date().getMonth() - new Date(paciente.fecha_nacimiento).getMonth(); if (m < 0) a--; return a >= 10; })() && (
            <div className="bg-white border border-[#c2c6d4] rounded-lg p-4 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Embarazada</div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={estaEmbarazada} onChange={(e)=>setEstaEmbarazada(e.target.checked)} />
                  <span>Sí</span>
                </label>
              </div>
              {estaEmbarazada && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs">IMC Pregestacional (obligatorio)</label>
                      <input type="number" step="0.1" value={imcPreg} onChange={(e)=>setImcPreg(e.target.value)} className="w-full border border-[#c2c6d4] rounded px-2 py-1" />
                    </div>
                    <div>
                      <label className="text-xs">Peso habitual (kg)</label>
                      <input type="number" step="0.1" value={pesoHabitual} onChange={(e)=>setPesoHabitual(e.target.value)} className="w-full border border-[#c2c6d4] rounded px-2 py-1" />
                    </div>
                    <div>
                      <label className="text-xs">FUR</label>
                      <input type="date" value={fur} onChange={(e)=>setFur(e.target.value)} className="w-full border border-[#c2c6d4] rounded px-2 py-1" />
                    </div>
                    <div>
                      <label className="text-xs">FPP</label>
                      <input type="date" value={fpp} onChange={(e)=>setFpp(e.target.value)} className="w-full border border-[#c2c6d4] rounded px-2 py-1" />
                    </div>
                    <div>
                      <label className="text-xs">Semanas de gestación</label>
                      <input type="number" value={semanaGest} onChange={(e)=>setSemanaGest(e.target.value)} className="w-full border border-[#c2c6d4] rounded px-2 py-1" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={async()=>{
                      try{
                        await api.actualizarPaciente(paciente.id_paciente,{esta_embarazada:true,imc_pregestacional:imcPreg||null,peso_habitual_kg:pesoHabitual||null,fur:fur||null,fpp:fpp||null,semana_gestacion:semanaGest||null,usuario_registro_embarazo:user.id});
                        setPaciente((p)=>({...p,esta_embarazada:true,imc_pregestacional:imcPreg||null,peso_habitual_kg:pesoHabitual||null,fur:fur||null,fpp:fpp||null,semana_gestacion:semanaGest||null}));
                        setFeedback({type:'ok',msg:'Datos de embarazo guardados'});
                      }catch(e){setFeedback({type:'err',msg:e.message})}
                    }} className="text-xs bg-[#006a71] text-white px-2 py-1 rounded">Guardar datos embarazo</button>
                    <button type="button" onClick={async()=>{
                      if(!confirm('Marcar parto finalizado?')) return;
                      try{
                        await api.actualizarPaciente(paciente.id_paciente,{esta_embarazada:false,embarazo_finalizado:true,fecha_embarazo_finalizado:new Date().toISOString(),usuario_embarazo_finalizado:user.id,motivo_embarazo_finalizado:'Parto'});
                        setEstaEmbarazada(false);
                        setPaciente((p)=>({...p,esta_embarazada:false,embarazo_finalizado:true}));
                        setFeedback({type:'ok',msg:'Embarazo marcado como finalizado'});
                      }catch(e){setFeedback({type:'err',msg:e.message})}
                    }} className="text-xs bg-[#ad1457] text-white px-2 py-1 rounded">Parto finalizado</button>
                    <span className="text-xs text-[#424752]">También se guarda automáticamente al guardar la preconsulta.</span>
                  </div>
                </>
              )}
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
              <div className="bg-[#f0fff4] border border-[#9ae6b4] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Calculator size={24} className="text-[#276749]" />
                  <div>
                    <div className="text-xs text-[#276749] font-semibold">IMC CALCULADO</div>
                    <div className="font-bold text-2xl text-[#276749]">{imc}</div>
                  </div>
                </div>
                <div className="text-left sm:text-right text-sm text-[#276749]">
                  {imc < 18.5 && "Bajo peso"}
                  {imc >= 18.5 && imc < 25 && "Normal"}
                  {imc >= 25 && imc < 30 && "Sobrepeso"}
                  {imc >= 30 && "Obesidad"}
                </div>
              </div>
            )}


            <div>
              <label className="block text-sm font-semibold mb-1.5">Síntomas (refiere paciente)</label>
              <textarea name="sintomas" value={form.sintomas||''} onChange={handleChange} rows={2} className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20" placeholder="Síntomas que refiere el paciente..." />
            </div>

            <div className="bg-white border border-[#c2c6d4] rounded-lg p-4 mb-4">
              <label className="block text-sm font-semibold mb-1.5">Alergias</label>
              <textarea
                value={form.alergias || ""}
                onChange={(e) => setForm((f) => ({ ...f, alergias: e.target.value }))}
                rows={2}
                className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20"
                placeholder="Especificar alergias separadas por coma (ej. Penicilina, Sulfas)"
              />
            </div>


            <div className="bg-white border border-[#c2c6d4] rounded-lg p-4 space-y-3">
              <div className="text-sm font-semibold">Factores de riesgo y tamizajes (automático)</div>
              <div className="flex flex-wrap gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${esSobrepeso ? 'bg-[#ffe9c7] text-[#8a5a00]' : 'bg-[#eceef0] text-[#8a8f99]'}`}>Sobrepeso (25–29.9){esSobrepeso ? ' · Sí' : ''}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${esObesidad ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#eceef0] text-[#8a8f99]'}`}>Obesidad (≥30){esObesidad ? ' · Sí' : ''}</span>
              </div>
              <p className="text-xs text-[#424752]">Sobrepeso y obesidad se calculan solos con el peso y la talla (IMC). No hay que marcarlos.</p>

              {aplicaCircunferencia && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm">Circunferencia abdominal:</label>
                  <input type="number" step="0.1" min="0" placeholder="cm" value={factores.circ_abdominal_cm} onChange={(e)=>setFactores(f=>({...f,circ_abdominal_cm:e.target.value}))} className="w-28 border border-[#c2c6d4] rounded px-2 py-1" />
                  <input type="date" value={factores.circ_abdominal_fecha} onChange={(e)=>setFactores(f=>({...f,circ_abdominal_fecha:e.target.value}))} className="border border-[#c2c6d4] rounded px-2 py-1" />
                  {parseFloat(factores.circ_abdominal_cm) > 0 && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#c7f0f4] text-[#006a71]">Tamizada</span>}
                </div>
              )}

              <div>
                <label className="text-sm block mb-1">Riesgo elevado de enfermedades del corazón (observación)</label>
                <input type="text" placeholder="Escribe una observación si aplica..." value={factores.riesgo_ecv_observacion} onChange={(e)=>setFactores(f=>({...f,riesgo_ecv_observacion:e.target.value}))} className="w-full border border-[#c2c6d4] rounded px-2 py-1" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-[#eceef0]">
              <button type="button" onClick={() => navigate(-1)} className="px-6 py-2.5 border border-[#c2c6d4] rounded-lg font-semibold text-[#424752] hover:bg-[#f2f4f6] transition-colors sm:order-1">
                Volver
              </button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 bg-[#006a71] hover:bg-[#004d56] text-white rounded-lg font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : "Guardar Preconsulta"}
              </button>
              {preconsultaExistente && roles.consulta.includes(user.rol) && (
                <button type="button" onClick={goToConsulta} className="px-6 py-2.5 bg-[#005eb8] hover:bg-[#00478d] text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2">
                  <HeartPulse size={16} /> Ir a Consulta Médica
                </button>
              )}
            </div>
          </form>
    </Layout>
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

