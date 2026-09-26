import React, { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, MapPin } from "lucide-react";
import { api } from "../services/api";
import Layout from "../components/Layout";
import BuscadorDireccion from "../components/BuscadorDireccion";

const initialForm = {
  nombre_completo: "", dpi: "", fecha_nacimiento: "",
  sexo: "M", telefono: "", direccion: "", lat: null, lng: null,
};

export default function RegistroPacientes() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const user = JSON.parse(localStorage.getItem("auth") || "{}");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.crearPaciente({ ...form, id_usuario_registro: user.id });
      setSuccess(`Paciente "${form.nombre_completo}" registrado exitosamente (ID: ${res.id}).`);
      setForm(initialForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout activePath="/registro">
      <div className="mb-6">
        <h1 className="font-bold text-2xl sm:text-3xl">Registro de Paciente</h1>
        <p className="text-sm text-[#424752] mt-1">Ingresa los datos del nuevo paciente al sistema.</p>
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

      <form onSubmit={handleSubmit} className="bg-white border border-[#c2c6d4] rounded-xl p-5 sm:p-8 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-semibold mb-1.5">Nombre Completo <span className="text-[#ba1a1a]">*</span></label>
            <input name="nombre_completo" required value={form.nombre_completo} onChange={handleChange}
              className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
              placeholder="Ej. Juan Pérez López" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">DPI (13 dígitos) <span className="text-[#ba1a1a]">*</span></label>
            <input name="dpi" required value={form.dpi} onChange={handleChange} maxLength={13}
              className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
              placeholder="Ej. 1234567890101" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Fecha de Nacimiento <span className="text-[#ba1a1a]">*</span></label>
            <input name="fecha_nacimiento" type="date" required value={form.fecha_nacimiento} onChange={handleChange}
              className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Sexo <span className="text-[#ba1a1a]">*</span></label>
            <select name="sexo" required value={form.sexo} onChange={handleChange}
              className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all">
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Teléfono</label>
            <input name="telefono" value={form.telefono} onChange={handleChange}
              className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
              placeholder="Ej. 5555-1234" />
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-semibold mb-1.5">Dirección</label>
            <BuscadorDireccion
              value={form.direccion}
              placeholder="Escribe la dirección como quieras y elige el lugar exacto, ej. atras del aeropuerto de huehuetenango"
              onSelect={(v) =>
                setForm((f) => ({ ...f, direccion: v.direccion, lat: v.lat, lng: v.lng }))
              }
            />
            <p className="text-xs text-[#8a8f9a] mt-1.5 flex items-center gap-1">
              <MapPin size={12} className="text-[#006a71]" />
              Sugiere lugares reales de Huehuetenango. Si eliges una opción, se guarda la ubicación exacta (lat/lng).
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
          <button type="button" onClick={() => setForm(initialForm)}
            className="px-6 py-2.5 border border-[#c2c6d4] rounded-lg font-semibold text-[#424752] hover:bg-[#f2f4f6] transition-colors">
            Limpiar
          </button>
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 bg-[#005eb8] hover:bg-[#00478d] text-white rounded-lg font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : "Guardar Registro"}
          </button>
        </div>
      </form>
    </Layout>
  );
}
