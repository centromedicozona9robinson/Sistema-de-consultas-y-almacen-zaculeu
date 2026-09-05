import React, { useState, useEffect, useCallback } from "react";
import {
  Loader2, CheckCircle2, AlertCircle, Plus, X, Pill, Boxes, Archive,
  AlertTriangle, CalendarDays, Truck, PackagePlus, ClipboardList, Pencil, Trash2,
} from "lucide-react";
import { api } from "../services/api";
import Layout from "../components/Layout";

const inicialMedicamento = {
  nombre_medicamento: "",
  nombre_generico: "",
  id_categoria: "",
  nueva_categoria: "",
  forma_farmaceutica: "",
  concentracion: "",
  unidad_medida: "",
  stock_minimo: 0,
  requiere_receta: true,
};

const inicialLote = {
  numero_lote: "",
  fecha_fabricacion: "",
  fecha_vencimiento: "",
  cantidad: "",
  precio_compra_unitario: "",
  motivo: "compra",
};

const tiposMovimientoLabel = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
  merma: "Merma",
  devolucion: "Devolución",
};

const tiposMovimientoStyle = {
  entrada: "bg-[#dceeee] text-[#006a71]",
  salida: "bg-[#ffdad6] text-[#ba1a1a]",
  ajuste: "bg-[#d0e1fb] text-[#00478d]",
  merma: "bg-[#fff3d6] text-[#8a6d00]",
  devolucion: "bg-[#eceef0] text-[#424752]",
};

export default function Inventario() {
  const [categorias, setCategorias] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [resumen, setResumen] = useState({ total_medicamentos: 0, stock_total_unidades: 0, medicamentos_por_vencer: 0, medicamentos_stock_bajo: 0 });
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [formMed, setFormMed] = useState(inicialMedicamento);
  const [guardando, setGuardando] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [loteModal, setLoteModal] = useState(null);
  const [formLote, setFormLote] = useState(inicialLote);
  const [guardandoLote, setGuardandoLote] = useState(false);

  const [lotesModal, setLotesModal] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [cargandoLotes, setCargandoLotes] = useState(false);
  const [errorLotes, setErrorLotes] = useState("");
  const [confirmarEliminarLote, setConfirmarEliminarLote] = useState(null);

  const [editModal, setEditModal] = useState(null);
  const [formEdit, setFormEdit] = useState(inicialMedicamento);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [borrando, setBorrando] = useState(false);

  const user = JSON.parse(localStorage.getItem("auth") || "{}");

  const cargarDatos = useCallback(async () => {
    try {
      const [c, m, mo, r] = await Promise.all([
        api.getCategorias(),
        api.getMedicamentos(),
        api.getMovimientosInventario(),
        api.getResumenInventario(),
      ]);
      setCategorias(c);
      setMedicamentos(m);
      setMovimientos(mo);
      setResumen(r);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const handleChange = (e) => {
    setFormMed({ ...formMed, [e.target.name]: e.target.value });
  };

  const handleSubmitMedicamento = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError("");
    setSuccess("");
    try {
      let id_categoria = formMed.id_categoria || null;
      if (formMed.id_categoria === "nueva") {
        if (!formMed.nueva_categoria.trim()) {
          throw new Error("Escribe el nombre de la nueva categoría");
        }
        const nueva = await api.crearCategoria({ nombre_categoria: formMed.nueva_categoria.trim() });
        id_categoria = nueva.id_categoria;
      }
      const res = await api.crearMedicamento({
        nombre_medicamento: formMed.nombre_medicamento,
        nombre_generico: formMed.nombre_generico,
        id_categoria,
        forma_farmaceutica: formMed.forma_farmaceutica,
        concentracion: formMed.concentracion,
        unidad_medida: formMed.unidad_medida,
        stock_minimo: Number(formMed.stock_minimo) || 0,
        requiere_receta: formMed.requiere_receta === true || formMed.requiere_receta === "true",
        id_usuario_registro: user.id,
      });
      setSuccess(`Medicamento "${formMed.nombre_medicamento}" registrado (ID: ${res.id}).`);
      setFormMed(inicialMedicamento);
      await cargarDatos();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleAbrirEdicion = (m) => {
    setEditModal(m);
    setFormEdit({
      nombre_medicamento: m.nombre_medicamento || "",
      nombre_generico: m.nombre_generico || "",
      id_categoria: m.id_categoria ? String(m.id_categoria) : "",
      nueva_categoria: "",
      forma_farmaceutica: m.forma_farmaceutica || "",
      concentracion: m.concentracion || "",
      unidad_medida: m.unidad_medida || "",
      stock_minimo: m.stock_minimo ?? 0,
      requiere_receta: m.requiere_receta === true || m.requiere_receta === "true",
    });
    setError("");
    setSuccess("");
  };

  const handleChangeEdit = (e) => {
    setFormEdit({ ...formEdit, [e.target.name]: e.target.value });
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    setGuardandoEdit(true);
    setError("");
    setSuccess("");
    try {
      let id_categoria = formEdit.id_categoria || null;
      if (formEdit.id_categoria === "nueva") {
        if (!formEdit.nueva_categoria.trim()) {
          throw new Error("Escribe el nombre de la nueva categoría");
        }
        const nueva = await api.crearCategoria({ nombre_categoria: formEdit.nueva_categoria.trim() });
        id_categoria = nueva.id_categoria;
      }
      await api.actualizarMedicamento(editModal.id_medicamento, {
        nombre_medicamento: formEdit.nombre_medicamento,
        nombre_generico: formEdit.nombre_generico,
        id_categoria,
        forma_farmaceutica: formEdit.forma_farmaceutica,
        concentracion: formEdit.concentracion,
        unidad_medida: formEdit.unidad_medida,
        stock_minimo: Number(formEdit.stock_minimo) || 0,
        requiere_receta: formEdit.requiere_receta === true || formEdit.requiere_receta === "true",
        id_usuario_editor: user.id,
      });
      setSuccess(`Medicamento "${formEdit.nombre_medicamento}" actualizado correctamente.`);
      setEditModal(null);
      await cargarDatos();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoEdit(false);
    }
  };

  const handleEliminarMedicamento = async () => {
    if (!confirmarEliminar) return;
    setBorrando(true);
    setError("");
    setSuccess("");
    try {
      await api.eliminarMedicamento(confirmarEliminar.id_medicamento, user.id);
      setSuccess(`Medicamento "${confirmarEliminar.nombre_medicamento}" eliminado correctamente.`);
      setConfirmarEliminar(null);
      await cargarDatos();
    } catch (err) {
      setError(err.message);
      setConfirmarEliminar(null);
    } finally {
      setBorrando(false);
    }
  };

  const abrirModalLote = (med) => {
    setLoteModal(med);
    setFormLote({ ...inicialLote, fecha_vencimiento: "", cantidad: "" });
    setError("");
  };

  const abrirModalLotes = async (med) => {
    setLotesModal(med);
    setLotes([]);
    setCargandoLotes(true);
    setError("");
    setErrorLotes("");
    try {
      const lotes = await api.getLotes(med.id_medicamento);
      setLotes(lotes);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoLotes(false);
    }
  };

  const handleEliminarLote = async () => {
    if (!confirmarEliminarLote) return;
    setBorrando(true);
    setErrorLotes("");
    try {
      await api.eliminarLote(confirmarEliminarLote.id_lote, user.id);
      setSuccess(`Lote ${confirmarEliminarLote.numero_lote} eliminado correctamente.`);
      setConfirmarEliminarLote(null);
      await cargarDatos();
      const lotes = await api.getLotes(lotesModal.id_medicamento);
      setLotes(lotes);
    } catch (err) {
      setErrorLotes(err.message);
      setConfirmarEliminarLote(null);
    } finally {
      setBorrando(false);
    }
  };

  const estadoLote = (l) => {
    const hoy = new Date();
    const venc = new Date(l.fecha_vencimiento);
    const dias = Math.ceil((venc - hoy) / 86400000);
    if (venc < hoy) return { label: "Vencido", style: "bg-[#ffdad6] text-[#ba1a1a]" };
    if (dias <= 90) return { label: `Vence en ${dias} días`, style: "bg-[#fff3d6] text-[#8a6d00]" };
    return { label: "Vigente", style: "bg-[#dceeee] text-[#006a71]" };
  };

  const handleChangeLote = (e) => {
    setFormLote({ ...formLote, [e.target.name]: e.target.value });
  };

  const handleSubmitLote = async (e) => {
    e.preventDefault();
    setGuardandoLote(true);
    setError("");
    try {
      await api.ingresarLote({
        id_medicamento: loteModal.id_medicamento,
        numero_lote: formLote.numero_lote,
        fecha_fabricacion: formLote.fecha_fabricacion || null,
        fecha_vencimiento: formLote.fecha_vencimiento,
        cantidad: Number(formLote.cantidad),
        precio_compra_unitario: formLote.precio_compra_unitario
          ? Number(formLote.precio_compra_unitario)
          : null,
        motivo: formLote.motivo,
        id_usuario_registro: user.id,
      });
      setLoteModal(null);
      setSuccess(`Lote ${formLote.numero_lote} ingresado correctamente.`);
      await cargarDatos();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoLote(false);
    }
  };

  const estadoStock = (m) => {
    if (m.stock_total === 0) return { label: "Sin stock", style: "bg-[#ffdad6] text-[#ba1a1a]" };
    if (m.stock_total <= m.stock_minimo) return { label: "Stock bajo", style: "bg-[#fff3d6] text-[#8a6d00]" };
    if (m.stock_por_vencer > 0) return { label: "Por vencer", style: "bg-[#fff3d6] text-[#8a6d00]" };
    return { label: "Disponible", style: "bg-[#dceeee] text-[#006a71]" };
  };

  const filtrarVencidos = (m) =>
    m.stock_por_vencer > 0 || (m.proximo_vencimiento && new Date(m.proximo_vencimiento) <= new Date(Date.now() + 90 * 86400000));

  const medicamentosFiltrados = medicamentos.filter((m) =>
    m.nombre_medicamento.toLowerCase().includes(busqueda.toLowerCase()) ||
    (m.nombre_generico || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const stats = [
    { label: "Medicamentos", value: resumen.total_medicamentos, icon: Pill, iconBg: "bg-[#d0e1fb]", borderColor: "border-l-[#005eb8]" },
    { label: "Stock Total (unidades)", value: resumen.stock_total_unidades, icon: Boxes, iconBg: "bg-[#dceeee]", borderColor: "border-l-[#006a71]" },
    { label: "Próximos a Vencer", value: resumen.medicamentos_por_vencer, valueColor: "text-[#8a6d00]", icon: CalendarDays, iconBg: "bg-[#fff3d6]", borderColor: "border-l-[#8a6d00]" },
    { label: "Stock Bajo", value: resumen.medicamentos_stock_bajo, valueColor: "text-[#ba1a1a]", icon: AlertTriangle, iconBg: "bg-[#ffdad6]", borderColor: "border-l-[#ba1a1a]" },
  ];

  return (
    <Layout
      activePath="/inventario"
      search={{ value: busqueda, onChange: (e) => setBusqueda(e.target.value), placeholder: "Buscar medicamento..." }}
      mainClassName="p-6 xl:p-10"
    >
      <div className="mb-6">
            <h1 className="font-bold text-2xl sm:text-3xl">Inventario de Medicamentos</h1>
            <p className="text-sm text-[#424752] mt-1">Catálogo de medicamentos, existencias por lote y movimientos de farmacia.</p>
          </div>

          {success && (
            <div className="bg-[#dceeee] border-l-4 border-[#006a71] text-[#006a71] p-4 rounded-lg flex items-center gap-3 mb-6 font-semibold">
              <CheckCircle2 size={20} /> {success}
            </div>
          )}
          {error && (
            <div className="bg-[#ffdad6] border-l-4 border-[#ba1a1a] text-[#ba1a1a] p-4 rounded-lg flex items-center gap-3 mb-6 font-semibold">
              <AlertCircle size={20} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6">
            {stats.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} valueColor={s.valueColor} icon={s.icon} iconBg={s.iconBg} borderColor={s.borderColor} />
            ))}
          </div>

          <div className="bg-white border border-[#c2c6d4] rounded-xl p-8 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-6">
              <PackagePlus size={22} className="text-[#005eb8]" />
              <h2 className="font-bold text-xl">Registrar Nuevo Medicamento</h2>
            </div>
            <form onSubmit={handleSubmitMedicamento}>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Nombre del Medicamento <span className="text-[#ba1a1a]">*</span></label>
                  <input name="nombre_medicamento" required value={formMed.nombre_medicamento} onChange={handleChange}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                    placeholder="Ej. Amoxicilina" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Nombre Genérico</label>
                  <input name="nombre_generico" value={formMed.nombre_generico} onChange={handleChange}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                    placeholder="Ej. Amoxicilina trihidratada" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Categoría</label>
                  <select name="id_categoria" value={formMed.id_categoria} onChange={handleChange}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all bg-white">
                    <option value="">-- Seleccionar --</option>
                    {categorias.map((c) => (
                      <option key={c.id_categoria} value={c.id_categoria}>{c.nombre_categoria}</option>
                    ))}
                    <option value="nueva">+ Nueva categoría...</option>
                  </select>
                </div>
                {formMed.id_categoria === "nueva" && (
                  <div className="col-span-full">
                    <label className="block text-sm font-semibold mb-1.5">Nombre de la Nueva Categoría <span className="text-[#ba1a1a]">*</span></label>
                    <input name="nueva_categoria" value={formMed.nueva_categoria} onChange={handleChange}
                      className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                      placeholder="Ej. Antiparasitarios" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Forma Farmacéutica</label>
                  <select name="forma_farmaceutica" value={formMed.forma_farmaceutica} onChange={handleChange}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all bg-white">
                    <option value="">-- Seleccionar --</option>
                    {["Tableta", "Cápsula", "Jarabe", "Ampolla", "Suspensión", "Crema", "Ungüento", "Gotas", "Sobres", "Óvulos", "Supositorio"].map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Concentración</label>
                  <input name="concentracion" value={formMed.concentracion} onChange={handleChange}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                    placeholder="Ej. 500mg / 250mg-5ml" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Unidad de Medida <span className="text-[#ba1a1a]">*</span></label>
                  <select name="unidad_medida" required value={formMed.unidad_medida} onChange={handleChange}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all bg-white">
                    <option value="">-- Seleccionar --</option>
                    {["Tableta", "Cápsula", "Ampolla", "Frasco", "Caja", "Tubo", "Sobre", "Frasquito", "Unidad"].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Stock Mínimo (alerta)</label>
                  <input name="stock_minimo" type="number" min="0" value={formMed.stock_minimo} onChange={handleChange}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                    placeholder="Ej. 30" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Requiere Receta</label>
                  <select name="requiere_receta" value={formMed.requiere_receta} onChange={handleChange}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all bg-white">
                    <option value={true}>Sí</option>
                    <option value={false}>No</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                <button type="button" onClick={() => setFormMed(inicialMedicamento)}
                  className="px-6 py-2.5 border border-[#c2c6d4] rounded-lg font-semibold text-[#424752] hover:bg-[#f2f4f6] transition-colors">
                  Limpiar
                </button>
                <button type="submit" disabled={guardando}
                  className="px-6 py-2.5 bg-[#005eb8] hover:bg-[#00478d] text-white rounded-lg font-bold transition-all disabled:opacity-60 flex items-center gap-2">
                  {guardando ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><Plus size={16} /> Agregar Medicamento</>}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white border border-[#c2c6d4] rounded-xl shadow-sm mb-6">
            <div className="flex items-center gap-2 p-6 pb-4">
              <div className="flex items-center gap-2">
                <Archive size={22} className="text-[#005eb8]" />
                <h2 className="font-bold text-xl">Existencias Actuales</h2>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-[#424752]">
                <Loader2 size={28} className="animate-spin mr-3" /> Cargando inventario...
              </div>
            ) : medicamentosFiltrados.length === 0 ? (
              <div className="text-center py-16 text-[#727783]">
                <Pill size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No hay medicamentos registrados</p>
                <p className="text-sm mt-1">Usa el formulario de arriba para agregar el primer medicamento.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[880px]">
                  <thead>
                    <tr className="text-left">
                      {["MEDICAMENTO", "CATEGORÍA", "CONCENTRACIÓN", "STOCK TOTAL", "PRÓX. VENCIMIENTO", "ESTADO", "ACCIONES"].map((h) => (
                        <th key={h} className="text-xs tracking-wide text-[#424752] py-2 px-3 border-b border-[#c2c6d4]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {medicamentosFiltrados.map((m) => {
                      const estado = estadoStock(m);
                      const vencido = filtrarVencidos(m);
                      return (
                        <tr key={m.id_medicamento} className="border-b border-[#eceef0] hover:bg-[#f7f9fb]">
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-md bg-[#d0e1fb] flex items-center justify-center text-[#00478d]">
                                <Pill size={18} />
                              </div>
                              <div>
                                <div className="font-semibold">{m.nombre_medicamento}</div>
                                <div className="text-xs text-[#424752]">
                                  {m.nombre_generico || "—"}
                                  {m.requiere_receta ? " · Requiere receta" : " · Venta libre"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-sm">{m.nombre_categoria || "—"}</td>
                          <td className="py-3.5 px-3 text-sm">{m.concentracion || "—"} {m.forma_farmaceutica ? `· ${m.forma_farmaceutica}` : ""}</td>
                          <td className="py-3.5 px-3">
                            <span className="font-bold text-[#00478d]">{m.stock_total}</span>
                            <span className="text-xs text-[#424752]"> {m.unidad_medida}</span>
                            <div className="text-[11px] text-[#424752]">mínimo {m.stock_minimo}</div>
                          </td>
                          <td className="py-3.5 px-3 text-sm">
                            {m.proximo_vencimiento ? (
                              <span className={vencido ? "font-semibold text-[#8a6d00]" : ""}>
                                {new Date(m.proximo_vencimiento).toLocaleDateString('es-GT')}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${estado.style}`}>{estado.label}</span>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleAbrirEdicion(m)} className="text-[#005eb8] p-2 hover:bg-[#d0e1fb] rounded-md transition-colors" title="Editar medicamento">
                                <Pencil size={17} />
                              </button>
                              <button onClick={() => setConfirmarEliminar(m)} className="text-[#ba1a1a] p-2 hover:bg-[#ffdad6] rounded-md transition-colors" title="Eliminar medicamento">
                                <Trash2 size={17} />
                              </button>
                              <button onClick={() => abrirModalLotes(m)}
                                className="px-3 py-1.5 bg-[#00478d] hover:bg-[#003366] text-white text-xs rounded font-semibold transition-colors flex items-center gap-1">
                                <Boxes size={12} /> Ver Lotes
                              </button>
                              <button onClick={() => abrirModalLote(m)}
                                className="px-3 py-1.5 bg-[#006a71] hover:bg-[#004d56] text-white text-xs rounded font-semibold transition-colors flex items-center gap-1">
                                <Truck size={12} /> Agregar Lote
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-[#c2c6d4] rounded-xl shadow-sm">
            <div className="flex items-center gap-2 p-6 pb-4">
              <ClipboardList size={22} className="text-[#005eb8]" />
              <h2 className="font-bold text-xl">Últimos Movimientos (Kardex)</h2>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-[#424752]">
                <Loader2 size={28} className="animate-spin mr-3" /> Cargando movimientos...
              </div>
            ) : movimientos.length === 0 ? (
              <div className="text-center py-12 text-[#727783]">
                <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">Aún no hay movimientos de inventario</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[760px]">
                  <thead>
                    <tr className="text-left">
                      {["FECHA", "MEDICAMENTO", "LOTE", "TIPO", "CANTIDAD", "MOTIVO", "USUARIO"].map((h) => (
                        <th key={h} className="text-xs tracking-wide text-[#424752] py-2 px-3 border-b border-[#c2c6d4]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((mv) => (
                      <tr key={mv.id_movimiento} className="border-b border-[#eceef0] hover:bg-[#f7f9fb]">
                        <td className="py-3 px-3 text-sm">{new Date(mv.fecha_hora).toLocaleString('es-GT')}</td>
                        <td className="py-3 px-3 text-sm font-semibold">{mv.nombre_medicamento}</td>
                        <td className="py-3 px-3 text-sm">{mv.numero_lote}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${tiposMovimientoStyle[mv.tipo_movimiento] || "bg-[#eceef0] text-[#424752]"}`}>
                            {tiposMovimientoLabel[mv.tipo_movimiento] || mv.tipo_movimiento}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-sm font-semibold">{mv.cantidad}</td>
                        <td className="py-3 px-3 text-sm">{mv.motivo || "—"}</td>
                        <td className="py-3 px-3 text-sm">{mv.nombre_usuario || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

      {loteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLoteModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#c2c6d4]">
              <div>
                <h2 className="font-bold text-xl">Ingresar Lote</h2>
                <p className="text-sm text-[#424752] mt-0.5">{loteModal.nombre_medicamento} · {loteModal.concentracion || ""}</p>
              </div>
              <button onClick={() => setLoteModal(null)} className="text-[#424752] hover:text-[#191c1e] p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmitLote} className="p-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1.5">Número de Lote <span className="text-[#ba1a1a]">*</span></label>
                  <input name="numero_lote" required value={formLote.numero_lote} onChange={handleChangeLote}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                    placeholder="Ej. AMX-2026-01" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Fecha de Fabricación</label>
                  <input name="fecha_fabricacion" type="date" value={formLote.fecha_fabricacion} onChange={handleChangeLote}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Fecha de Vencimiento <span className="text-[#ba1a1a]">*</span></label>
                  <input name="fecha_vencimiento" type="date" required value={formLote.fecha_vencimiento} onChange={handleChangeLote}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Cantidad ({loteModal.unidad_medida}) <span className="text-[#ba1a1a]">*</span></label>
                  <input name="cantidad" type="number" min="1" required value={formLote.cantidad} onChange={handleChangeLote}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                    placeholder="Ej. 100" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Precio de Compra Unitario (Q)</label>
                  <input name="precio_compra_unitario" type="number" step="0.01" min="0" value={formLote.precio_compra_unitario} onChange={handleChangeLote}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                    placeholder="Ej. 2.50" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1.5">Motivo de Ingreso</label>
                  <select name="motivo" value={formLote.motivo} onChange={handleChangeLote}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all bg-white">
                    {["compra", "donación", "devolución", "ajuste de inventario"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                <button type="button" onClick={() => setLoteModal(null)}
                  className="px-6 py-2.5 border border-[#c2c6d4] rounded-lg font-semibold text-[#424752] hover:bg-[#f2f4f6] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoLote}
                  className="px-6 py-2.5 bg-[#006a71] hover:bg-[#004d56] text-white rounded-lg font-bold transition-all disabled:opacity-60 flex items-center gap-2">
                  {guardandoLote ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><Truck size={16} /> Ingresar Lote</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !guardandoEdit && setEditModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-[720px] max-h-[92vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#c2c6d4]">
              <div>
                <h2 className="font-bold text-xl">Editar Medicamento</h2>
                <p className="text-sm text-[#424752] mt-0.5">{editModal.nombre_medicamento}</p>
              </div>
              <button onClick={() => !guardandoEdit && setEditModal(null)} className="text-[#424752] hover:text-[#191c1e] p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleGuardarEdicion} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Nombre del Medicamento <span className="text-[#ba1a1a]">*</span></label>
                  <input name="nombre_medicamento" required value={formEdit.nombre_medicamento} onChange={handleChangeEdit}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Nombre Genérico</label>
                  <input name="nombre_generico" value={formEdit.nombre_generico} onChange={handleChangeEdit}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Categoría</label>
                  <select name="id_categoria" value={formEdit.id_categoria} onChange={handleChangeEdit}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all bg-white">
                    <option value="">-- Seleccionar --</option>
                    {categorias.map((c) => (
                      <option key={c.id_categoria} value={c.id_categoria}>{c.nombre_categoria}</option>
                    ))}
                    <option value="nueva">+ Nueva categoría...</option>
                  </select>
                </div>
                {formEdit.id_categoria === "nueva" && (
                  <div className="col-span-full">
                    <label className="block text-sm font-semibold mb-1.5">Nombre de la Nueva Categoría <span className="text-[#ba1a1a]">*</span></label>
                    <input name="nueva_categoria" value={formEdit.nueva_categoria} onChange={handleChangeEdit}
                      className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Forma Farmacéutica</label>
                  <select name="forma_farmaceutica" value={formEdit.forma_farmaceutica} onChange={handleChangeEdit}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all bg-white">
                    <option value="">-- Seleccionar --</option>
                    {["Tableta", "Cápsula", "Jarabe", "Ampolla", "Suspensión", "Crema", "Ungüento", "Gotas", "Sobres", "Óvulos", "Supositorio"].map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Concentración</label>
                  <input name="concentracion" value={formEdit.concentracion} onChange={handleChangeEdit}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Unidad de Medida <span className="text-[#ba1a1a]">*</span></label>
                  <select name="unidad_medida" required value={formEdit.unidad_medida} onChange={handleChangeEdit}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all bg-white">
                    <option value="">-- Seleccionar --</option>
                    {["Tableta", "Cápsula", "Ampolla", "Frasco", "Caja", "Tubo", "Sobre", "Frasquito", "Unidad"].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Stock Mínimo (alerta)</label>
                  <input name="stock_minimo" type="number" min="0" value={formEdit.stock_minimo} onChange={handleChangeEdit}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Requiere Receta</label>
                  <select name="requiere_receta" value={formEdit.requiere_receta} onChange={handleChangeEdit}
                    className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all bg-white">
                    <option value={true}>Sí</option>
                    <option value={false}>No</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                <button type="button" onClick={() => setEditModal(null)} disabled={guardandoEdit}
                  className="px-6 py-2.5 border border-[#c2c6d4] rounded-lg font-semibold text-[#424752] hover:bg-[#f2f4f6] transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoEdit}
                  className="px-6 py-2.5 bg-[#005eb8] hover:bg-[#00478d] text-white rounded-lg font-bold transition-all disabled:opacity-60 flex items-center gap-2">
                  {guardandoEdit ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><Pencil size={16} /> Guardar Cambios</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLotesModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-[760px] max-h-[92vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#c2c6d4]">
              <div>
                <h2 className="font-bold text-xl">Lotes de {lotesModal.nombre_medicamento}</h2>
                <p className="text-sm text-[#424752] mt-0.5">
                  {lotesModal.concentracion ? `${lotesModal.concentracion} · ` : ""}{lotesModal.forma_farmaceutica || ""} · Unidad: {lotesModal.unidad_medida}
                </p>
              </div>
              <button onClick={() => setLotesModal(null)} className="text-[#424752] hover:text-[#191c1e] p-1"><X size={20} /></button>
            </div>
            {cargandoLotes ? (
              <div className="flex items-center justify-center py-16 text-[#424752]">
                <Loader2 size={28} className="animate-spin mr-3" /> Cargando lotes...
              </div>
            ) : lotes.length === 0 ? (
              <div className="text-center py-16 text-[#727783]">
                <Boxes size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">Este medicamento aún no tiene lotes registrados</p>
              </div>
            ) : (
              <div className="p-6">
                {errorLotes && (
                  <div className="bg-[#ffdad6] border-l-4 border-[#ba1a1a] text-[#ba1a1a] p-3 rounded-lg flex items-center gap-2 mb-4 text-sm font-semibold">
                    <AlertCircle size={16} /> {errorLotes}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-left">
                        {["LOTE", "CANTIDAD", "INGRESADO", "VENCE", "ESTADO", "ACCIÓN"].map((h) => (
                          <th key={h} className="text-xs tracking-wide text-[#424752] py-2 px-3 border-b border-[#c2c6d4]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lotes.map((l) => {
                        const est = estadoLote(l);
                        return (
                          <tr key={l.id_lote} className="border-b border-[#eceef0]">
                            <td className="py-3 px-3">
                              <div className="font-mono font-semibold text-sm">{l.numero_lote}</div>
                              {l.precio_compra_unitario ? (
                                <div className="text-xs text-[#424752]">Q {Number(l.precio_compra_unitario).toFixed(2)} / {lotesModal.unidad_medida}</div>
                              ) : null}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-[#00478d]">{l.cantidad_actual}</span>
                              <span className="text-xs text-[#424752]"> de {l.cantidad_inicial} {lotesModal.unidad_medida}</span>
                            </td>
                            <td className="py-3 px-3 text-sm">{new Date(l.fecha_ingreso).toLocaleDateString("es-GT")}</td>
                            <td className="py-3 px-3 text-sm">{new Date(l.fecha_vencimiento).toLocaleDateString("es-GT")}</td>
                            <td className="py-3 px-3">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${est.style}`}>{est.label}</span>
                            </td>
                            <td className="py-3 px-3">
                              <button onClick={() => setConfirmarEliminarLote(l)} className="text-[#ba1a1a] p-2 hover:bg-[#ffdad6] rounded-md transition-colors" title="Eliminar lote">
                                <Trash2 size={17} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmarEliminarLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !borrando && setConfirmarEliminarLote(null)}>
          <div className="bg-white rounded-xl p-6 w-[400px] max-w-[90vw] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-[#ffdad6] flex items-center justify-center text-[#ba1a1a] shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg leading-snug">¿Eliminar lote?</h3>
                <p className="text-sm text-[#424752] mt-2 leading-relaxed">
                  Se eliminará el lote <strong>{confirmarEliminarLote.numero_lote}</strong> de {lotesModal?.nombre_medicamento} y
                  sus movimientos de inventario. Si ya tuvo dispensaciones a pacientes, no se podrá eliminar.
                </p>
              </div>
              <button onClick={() => !borrando && setConfirmarEliminarLote(null)} className="text-[#727783] hover:bg-[#f2f4f6] rounded-md p-1.5" title="Cancelar">
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmarEliminarLote(null)} disabled={borrando}
                className="flex-1 border border-[#c2c6d4] bg-white text-[#424752] py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleEliminarLote} disabled={borrando}
                className="flex-1 bg-[#ba1a1a] hover:bg-[#8f1414] text-white py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {borrando ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {borrando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !borrando && setConfirmarEliminar(null)}>
          <div className="bg-white rounded-xl p-6 w-[400px] max-w-[90vw] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-[#ffdad6] flex items-center justify-center text-[#ba1a1a] shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg leading-snug">¿Eliminar medicamento?</h3>
                <p className="text-sm text-[#424752] mt-2 leading-relaxed">
                  Se eliminará <strong>{confirmarEliminar.nombre_medicamento}</strong> del catálogo de inventario.
                  Sus lotes e historial de movimientos se conservarán.
                </p>
              </div>
              <button onClick={() => !borrando && setConfirmarEliminar(null)} className="text-[#727783] hover:bg-[#f2f4f6] rounded-md p-1.5" title="Cancelar">
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmarEliminar(null)} disabled={borrando}
                className="flex-1 border border-[#c2c6d4] bg-white text-[#424752] py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleEliminarMedicamento} disabled={borrando}
                className="flex-1 bg-[#ba1a1a] hover:bg-[#8f1414] text-white py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {borrando ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {borrando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
      </Layout>
  );
}

function StatCard({ label, value, valueColor = "text-[#191c1e]", icon: Icon, iconBg, borderColor }) {
  return (
    <div className={`bg-white border border-[#c2c6d4] border-l-4 ${borderColor} rounded-lg p-5 flex justify-between items-start`}>
      <div>
        <div className="font-semibold text-sm text-[#424752]">{label}</div>
        <div className={`font-bold text-[32px] mt-1.5 ${valueColor}`}>{value ?? '—'}</div>
      </div>
      <div className={`w-11 h-11 rounded-md ${iconBg} flex items-center justify-center`}>
        <Icon size={20} className="text-[#00478d]" />
      </div>
    </div>
  );
}
