import React, { useState } from "react";
import { LayoutGrid, UserPlus, FolderOpen, Shield, Package, LogOut, Loader2, CheckCircle2, AlertCircle, HeartPulse } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

const initialForm = {
  nombre_completo: "", dpi: "", fecha_nacimiento: "",
  sexo: "M", telefono: "", direccion: "",
};

export default function RegistroPacientes() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const user = JSON.parse(localStorage.getItem("auth") || "{}");
  const nav = filtrarNav(user.rol, navItems);

  const handleLogout = () => {
    localStorage.removeItem("auth");
    navigate("/login");
  };

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
    <div className="flex h-screen bg-[#f7f9fb] font-sans text-[#191c1e] overflow-hidden">
      <aside className="w-[255px] h-full flex-shrink-0 bg-white border-r border-[#c2c6d4] flex flex-col justify-between">
        <div className="p-4 overflow-y-auto">
          <div className="pb-6">
            <LogoMspas />
            <div className="text-xs text-[#424752] mt-0.5 capitalize">{roleLabels[user.rol] || user.rol}</div>
          </div>
          <nav className="flex flex-col gap-1">
            {nav.map(({ label, icon: Icon, path }) => (
              <div key={label} onClick={() => navigate(path)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md font-semibold text-sm cursor-pointer ${path === "/registro" ? "bg-[#d0e1fb] text-[#00478d]" : "text-[#424752] hover:bg-[#f2f4f6]"}`}>
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
        <header className="relative h-[73px] shrink-0 bg-white border-b border-[#c2c6d4] flex items-center justify-between px-8 sticky top-0 z-10">
          <div />
          <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#00478d] whitespace-nowrap">
            Centro Médico Público de Zaculeu
          </div>
          <div className="flex items-center gap-5">
            <div className="w-9 h-9 rounded-full bg-[#d0e1fb] border border-[#c2c6d4] flex items-center justify-center font-bold text-[#00478d] text-sm">
              {(user.nombre || "U")[0]}
            </div>
          </div>
        </header>

        <main className="flex-1 p-10">
          <div className="mb-6">
            <h1 className="font-bold text-3xl">Registro de Paciente</h1>
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

          <form onSubmit={handleSubmit} className="bg-white border border-[#c2c6d4] rounded-xl p-8 shadow-sm">
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="block text-sm font-semibold mb-1.5">Nombre Completo <span className="text-[#ba1a1a]">*</span></label>
                <input name="nombre_completo" required value={form.nombre_completo} onChange={handleChange}
                  className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                  placeholder="Ej. Juan Pérez López" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">DPI (13 dígitos)</label>
                <input name="dpi" value={form.dpi} onChange={handleChange} maxLength={13}
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

              <div className="col-span-2">
                <label className="block text-sm font-semibold mb-1.5">Dirección</label>
                <input name="direccion" value={form.direccion} onChange={handleChange}
                  className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
                  placeholder="Ej. Zaculeu, Huehuetenango, Guatemala" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button type="button" onClick={() => setForm(initialForm)}
                className="px-6 py-2.5 border border-[#c2c6d4] rounded-lg font-semibold text-[#424752] hover:bg-[#f2f4f6] transition-colors">
                Limpiar
              </button>
              <button type="submit" disabled={loading}
                className="px-6 py-2.5 bg-[#005eb8] hover:bg-[#00478d] text-white rounded-lg font-bold transition-all disabled:opacity-60 flex items-center gap-2">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : "Guardar Registro"}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
