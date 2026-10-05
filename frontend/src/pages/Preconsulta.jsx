import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, HeartPulse, Weight, Ruler, Calculator, Flag, AlertTriangle } from "lucide-react";
import { api } from "../services/api";
import { roles } from "../services/permisos";
import Layout from "../components/Layout";

const VITAL_RANGES = {
  presion_arterial: { label: "PRESIÓN ARTERIAL", unit: "mmHg", icon: HeartPulse, color: "#e53e3e", type: "text", placeholder: "120/80" },
  temperatura: { label: "TEMPERATURA", unit: "°C", icon: HeartPulse, color: "#e53e3e", step: 0.1, min: 34, max: 42 },
  peso: { label: "PESO", unit: "kg", icon: Weight, color: "#805ad5", step: 0.1, min: 2, max: 660 },
  talla: { label: "ALTURA", unit: "m", icon: Ruler, color: "#d69e2e", step: 0.01, min: 0.3, max: 2.5 },
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
  const [catalogoCronicos, setCatalogoCronicos] = useState([]);
  const [cronicosSel, setCronicosSel] = useState([]);
  const [estaEmbarazada, setEstaEmbarazada] = useState(false);
  const [imcPreg, setImcPreg] = useState('');
  const [pesoHabitual, setPesoHabitual] = useState('');
  const [fur, setFur] = useState('');
  const [fpp, setFpp] = useState('');
  const [semanaGest, setSemanaGest] = useState('');
  const [tipoVisita, setTipoVisita] = useState({ consulta:false, reconsulta:false });
  const [factores, setFactores] = useState({ sobrepeso:false, obesidad:false, circ_abdominal:false, riesgo_ecv_elevado:false, circ_abdominal_cm:'', circ_abdominal_fecha:'', riesgo_ecv_observacion:'' });

  const user = JSON.parse(localStorage.getItem("auth") || "{}");

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
          if (pre.tipo_visita) {
            setTipoVisita({ consulta: pre.tipo_visita.includes('CONSULTA'), reconsulta: pre.tipo_visita.includes('RECONSULTA') });
          }
          if (pre.temperatura !== undefined) formInit.temperatura = pre.temperatura;
          if (pre.sintomas !== undefined) formInit.sintomas = pre.sintomas;
          if (pre.hallazgos !== undefined) formInit.hallazgos = pre.hallazgos;
          if (pre.recetado !== undefined) formInit.recetado = pre.recetado;
          setForm(formInit);
          setImc(computeImc(formInit));
          setAlertas(getAlertas(formInit));
          try{const fr=await api.getFactoresRiesgo(id_visita); if(fr){setFactores({sobrepeso:fr.sobrepeso,obesidad:fr.obesidad,circ_abdominal:fr.circ_abdominal,riesgo_ecv_elevado:fr.riesgo_ecv_elevado,circ_abdominal_cm:fr.circ_abdominal_cm||'',circ_abdominal_fecha:fr.circ_abdominal_fecha||'',riesgo_ecv_observacion:fr.riesgo_ecv_observacion||''})}}catch(e){}
        } catch (e) {}
      }
      if (id_paciente) {
        const exp = await api.getExpediente(id_paciente);
        setPaciente(exp.paciente);
        try {
          const edadCalc = exp.paciente.fecha_nacimiento ? new Date().getFullYear() - new Date(exp.paciente.fecha_nacimiento).getFullYear() : null;
          const cat = await api.getCatalogoEnfermedades(edadCalc, exp.paciente.sexo);
          setCatalogoCronicos(cat);
        } catch (e) {}
        try {
          const cr = await api.getEnfermedadesCronicasPaciente(exp.paciente.id_paciente);
          setCronicosSel(cr.map(x=>x.id_enfermedad_cronica));
        } catch (e) {}
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
    return p && t && t > 0 ? ((p * 0.453592) / (t * t)).toFixed(2) : null;
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
      const tipoV = tipoVisita.consulta && tipoVisita.reconsulta ? 'AMBAS' : (tipoVisita.consulta ? 'CONSULTA' : (tipoVisita.reconsulta ? 'RECONSULTA' : null));
      const data = { ...form, id_visita: visitaId, id_usuario_registro: user.id, tipo_visita: tipoV, es_consulta: tipoVisita.consulta, es_reconsulta: tipoVisita.reconsulta, sintomas: form.sintomas||null, hallazgos: form.hallazgos||null, recetado: form.recetado||null };
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

          <div className="bg-white border border-[#c2c6d4] rounded-lg p-4 mb-4">
            <div className="text-sm font-semibold mb-2">Tipo de Visita</div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={tipoVisita.consulta} onChange={(e)=>setTipoVisita(t=>({...t, consulta:e.target.checked}))} />
                <span>CONSULTA</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={tipoVisita.reconsulta} onChange={(e)=>setTipoVisita(t=>({...t, reconsulta:e.target.checked}))} />
                <span>RECONSULTA</span>
              </label>
              {tipoVisita.consulta && tipoVisita.reconsulta && <span className="px-2 py-0.5 bg-[#d0e1fb] text-[#00478d] text-xs rounded">AMBAS</span>}
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
                  <div>
                    <button type="button" onClick={async()=>{
                      try{
                        await api.actualizarPaciente(paciente.id_paciente,{esta_embarazada:true,imc_pregestacional:imcPreg||null,peso_habitual_kg:pesoHabitual||null,fur:fur||null,fpp:fpp||null,semana_gestacion:semanaGest||null,usuario_registro_embarazo:user.id});
                        alert('Datos de embarazo guardados');
                      }catch(e){alert(e.message)}
                    }} className="text-xs bg-[#006a71] text-white px-2 py-1 rounded">Guardar datos embarazo</button>
                    <button type="button" onClick={async()=>{
                      if(!confirm('Marcar parto finalizado?')) return;
                      try{
                        await api.actualizarPaciente(paciente.id_paciente,{embarazo_finalizado:true,esta_embarazada:false,fecha_embarazo_finalizado:new Date().toISOString(),usuario_embarazo_finalizado:user.id,motivo_embarazo_finalizado:'Parto finalizado'});
                        alert('Parto finalizado');
                      }catch(e){alert(e.message)}
                    }} className="text-xs ml-2 bg-[#ba1a1a] text-white px-2 py-1 rounded">Parto finalizado</button>
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
            <div>
              <label className="block text-sm font-semibold mb-1.5">Hallazgos (lo realmente encontrado)</label>
              <textarea name="hallazgos" value={form.hallazgos||''} onChange={handleChange} rows={2} className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20" placeholder="Hallazgos del examen..." />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Recetado / Manejo</label>
              <textarea name="recetado" value={form.recetado||''} onChange={handleChange} rows={2} className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20" placeholder="Lo que se le recetó/manejo..." />
            </div>


            <div className="bg-white border border-[#c2c6d4] rounded-lg p-4 space-y-2">
              <div className="text-sm font-semibold">Factores de riesgo y tamizajes (guardar como dato)</div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={factores.sobrepeso} onChange={(e)=>setFactores(f=>({...f,sobrepeso:e.target.checked}))}/>Sobrepeso (25–29.9)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={factores.obesidad} onChange={(e)=>setFactores(f=>({...f,obesidad:e.target.checked}))}/>Obesidad (&gt;=30)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={factores.circ_abdominal} onChange={(e)=>setFactores(f=>({...f,circ_abdominal:e.target.checked}))}/>Circunferencia abdominal</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={factores.riesgo_ecv_elevado} onChange={(e)=>setFactores(f=>({...f,riesgo_ecv_elevado:e.target.checked}))}/>Riesgo ECV elevado</label>
              </div>
              {factores.circ_abdominal && (
                <div className="flex gap-2">
                  <input type="number" step="0.1" placeholder="cm" value={factores.circ_abdominal_cm} onChange={(e)=>setFactores(f=>({...f,circ_abdominal_cm:e.target.value}))} className="border border-[#c2c6d4] rounded px-2 py-1" />
                  <input type="date" value={factores.circ_abdominal_fecha} onChange={(e)=>setFactores(f=>({...f,circ_abdominal_fecha:e.target.value}))} className="border border-[#c2c6d4] rounded px-2 py-1" />
                </div>
              )}
              {factores.riesgo_ecv_elevado && (
                <input type="text" placeholder="Observación" value={factores.riesgo_ecv_observacion} onChange={(e)=>setFactores(f=>({...f,riesgo_ecv_observacion:e.target.value}))} className="border border-[#c2c6d4] rounded px-2 py-1 w-full" />
              )}
              <button type="button" onClick={async()=>{
                try{await api.guardarFactoresRiesgo({...factores, id_visita: parseInt(id_visita), id_usuario_registro: user.id}); alert('Guardado');}catch(e){alert(e.message)}
              }} className="text-xs bg-[#005eb8] text-white px-2 py-1 rounded">Guardar factores de riesgo</button>
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