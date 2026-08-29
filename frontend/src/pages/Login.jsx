import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Stethoscope, HeartPulse, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("doctor");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectRole = (r) => {
    setRole(r);
    setError("");
    const usuarioDefault = r === "doctor" ? "DOC" : "Enfer";
    if (!username || username === "DOC" || username === "Enfer") setUsername(usuarioDefault);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.login(username, password);
      localStorage.setItem("auth", JSON.stringify(data.user));
      navigate(data.user.rol === "enfermera" ? "/preconsulta" : "/");
    } catch (err) {
      setError(err.message || "Credenciales incorrectas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f7f9fb] font-sans">
      <div className="w-1/2 bg-[#005eb8] flex flex-col items-center justify-center text-white p-12 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-white opacity-5 rounded-full blur-3xl"></div>
        <HeartPulse size={90} className="mb-8 opacity-90 drop-shadow-lg" />
        <h1 className="text-4xl font-bold mb-4 text-center tracking-tight">Centro Médico Público<br/>de Zaculeu</h1>
        <p className="text-lg text-blue-100 text-center max-w-md leading-relaxed opacity-90">
          Sistema integral de pre-consultas y expedientes clínicos.
          Brindando atención eficiente y de calidad a nuestros pacientes.
        </p>
        <div className="mt-8 text-blue-200 text-xs text-center opacity-70">
          Proyecto de Graduación I — Universidad Mariano Gálvez · 2026
        </div>
      </div>

      <div className="w-1/2 flex items-center justify-center p-12">
        <div className="w-full max-w-md bg-white border border-[#c2c6d4] rounded-2xl p-10 shadow-lg shadow-blue-900/5">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#d0e1fb] text-[#00478d] rounded-2xl flex items-center justify-center rotate-3 transition-transform hover:rotate-0">
              <Stethoscope size={32} />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-[#00478d] mb-2">Iniciar Sesión</h2>
          <p className="text-center text-[#424752] mb-8 text-sm">Ingresa tus credenciales para acceder al sistema</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="flex gap-4 mb-6 bg-[#f2f4f6] p-1 rounded-lg border border-[#eceef0]">
              <button type="button" onClick={() => selectRole("doctor")}
                className={`flex-1 py-2.5 rounded-md font-semibold text-sm transition-all ${role === "doctor" ? "bg-white text-[#005eb8] ring-1 ring-black/5 shadow-sm" : "text-[#424752] hover:text-[#191c1e]"}`}>
                Médico
              </button>
              <button type="button" onClick={() => selectRole("enfermero")}
                className={`flex-1 py-2.5 rounded-md font-semibold text-sm transition-all ${role === "enfermero" ? "bg-white text-[#005eb8] ring-1 ring-black/5 shadow-sm" : "text-[#424752] hover:text-[#191c1e]"}`}>
                Enfermería
              </button>
            </div>

            {error && (
              <div className="bg-[#ffdad6] text-[#ba1a1a] p-3 rounded-lg flex items-center gap-2 text-sm font-semibold">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#191c1e] mb-1.5">Usuario</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-[#727783] group-focus-within:text-[#005eb8] transition-colors" />
                </div>
                <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-[#c2c6d4] rounded-lg focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 text-[#191c1e] transition-all"
                  placeholder={role === "doctor" ? "DOC" : "Enfer"} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#191c1e] mb-1.5">Contraseña</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-[#727783] group-focus-within:text-[#005eb8] transition-colors" />
                </div>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-[#c2c6d4] rounded-lg focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 text-[#191c1e] transition-all"
                  placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 mt-8 bg-[#005eb8] hover:bg-[#00478d] disabled:opacity-60 text-white rounded-lg font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={18} className="animate-spin" /> Verificando...</> : "Acceder al Sistema"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
