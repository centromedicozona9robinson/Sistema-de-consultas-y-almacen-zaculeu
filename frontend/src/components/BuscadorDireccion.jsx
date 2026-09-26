import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Search } from "lucide-react";
import { api } from "../services/api";

// Buscador de direcciones con autocompletado (Nominatim/OpenStreetMap).
// El usuario escribe como quiera ("atras del aeropuerto") y acá se detecta el
// lugar exacto; al elegir una sugerencia se devuelve su nombre limpio y lat/lng.
const DEBOUNCE_MS = 600;

export default function BuscadorDireccion({ value, onSelect, placeholder }) {
  const [texto, setTexto] = useState(value || "");
  const [sugerencias, setSugerencias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const seleccionando = useRef(false);

  useEffect(() => {
    setTexto(value || "");
  }, [value]);

  useEffect(() => {
    if (seleccionando.current) {
      seleccionando.current = false;
      setSugerencias([]);
      setAbierto(false);
      return;
    }
    if (!texto.trim()) {
      setSugerencias([]);
      setAbierto(false);
      return;
    }
    setCargando(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.sugerirDireccion(texto);
        setSugerencias(res || []);
        setAbierto((res || []).length > 0);
      } catch {
        setSugerencias([]);
        setAbierto(false);
      } finally {
        setCargando(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [texto]);

  const elegir = (s) => {
    seleccionando.current = true;
    setTexto(s.nombre);
    setAbierto(false);
    setSugerencias([]);
    onSelect({ direccion: s.nombre, lat: s.lat, lng: s.lng });
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            onSelect({ direccion: e.target.value, lat: null, lng: null });
          }}
          onFocus={() => {
            if (sugerencias.length) setAbierto(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setAbierto(false);
          }}
          autoComplete="off"
          placeholder={placeholder}
          className="w-full border border-[#c2c6d4] rounded-lg px-3 py-2.5 pl-9 focus:outline-none focus:border-[#005eb8] focus:ring-2 focus:ring-[#005eb8]/20 transition-all"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2">
          {cargando ? (
            <Loader2 size={16} className="animate-spin text-[#8a8f9a]" />
          ) : (
            <Search size={16} className="text-[#8a8f9a]" />
          )}
        </span>
      </div>

      {abierto && sugerencias.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-[#c2c6d4] rounded-lg shadow-lg max-h-64 overflow-auto">
          {sugerencias.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => elegir(s)}
                className="w-full text-left px-3 py-2 hover:bg-[#f2f3f7] text-sm flex items-start gap-2"
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-[#006a71]" />
                <span className="text-[#191c1e]">{s.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}