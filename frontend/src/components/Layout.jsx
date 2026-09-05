import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutGrid, UserPlus, FolderOpen, Shield, Package,
  HeartPulse, Search, LogOut, Menu, X,
} from "lucide-react";
import { filtrarNav, roleLabels } from "../services/permisos";
import LogoMspas from "./LogoMspas";

const navItems = [
  { label: "Panel de Control", icon: LayoutGrid, path: "/" },
  { label: "Registro de Pacientes", icon: UserPlus, path: "/registro" },
  { label: "Expedientes Clínicos", icon: FolderOpen, path: "/expedientes" },
  { label: "Preconsultas", icon: HeartPulse, path: "/preconsulta" },
  { label: "Inventario", icon: Package, path: "/inventario" },
  { label: "Control de Acceso", icon: Shield, path: "/admin" },
];

export default function Layout({ activePath, search, mainClassName = "p-6 xl:p-10", children }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem("auth") || "{}");
  const nav = filtrarNav(user.rol, navItems);
  const isActive = (path) => path === activePath;

  const handleLogout = () => {
    localStorage.removeItem("auth");
    navigate("/login");
  };

  const go = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const SidebarNav = ({ onNavigate }) => (
    <nav className="flex flex-col gap-1">
      {nav.map(({ label, icon: Icon, path }) => (
        <div
          key={label}
          onClick={() => onNavigate(path)}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md font-semibold text-sm cursor-pointer ${
            isActive(path) ? "bg-[#d0e1fb] text-[#00478d]" : "text-[#424752] hover:bg-[#f2f4f6]"
          }`}
        >
          <Icon size={18} />
          {label}
        </div>
      ))}
    </nav>
  );

  const SidebarFooter = () => (
    <div className="p-4 border-t border-[#c2c6d4] flex flex-col gap-3 shrink-0">
      <div
        onClick={handleLogout}
        className="flex items-center gap-2 px-3 py-2 text-sm text-[#424752] hover:bg-[#f2f4f6] rounded-md cursor-pointer transition-colors"
      >
        <LogOut size={16} /> Cerrar Sesión
      </div>
    </div>
  );

  const SearchBox = ({ autoFocus }) => {
    if (!search) return null;
    return (
      <div className="flex items-center gap-2 bg-[#f2f4f6] border border-[#c2c6d4] rounded px-3.5 py-2.5 text-sm text-[#424752]">
        <Search size={16} className="shrink-0" />
        <input
          value={search.value}
          onChange={search.onChange}
          onKeyDown={search.onKeyDown}
          placeholder={search.placeholder || "Buscar..."}
          autoFocus={autoFocus}
          className="outline-none bg-transparent w-full"
        />
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#f7f9fb] font-sans text-[#191c1e] overflow-hidden">
      <aside className="hidden lg:flex w-[255px] h-full flex-shrink-0 bg-white border-r border-[#c2c6d4] flex-col justify-between">
        <div className="p-4 overflow-y-auto">
          <div className="pb-6">
            <LogoMspas />
            <div className="text-xs text-[#424752] mt-0.5 capitalize">{roleLabels[user.rol] || user.rol}</div>
          </div>
          <SidebarNav onNavigate={navigate} />
        </div>
        <SidebarFooter />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[255px] bg-white shadow-xl flex flex-col justify-between animate-slide-down">
            <div className="p-4 overflow-y-auto">
              <div className="pb-6 flex items-start justify-between">
                <div>
                  <LogoMspas />
                  <div className="text-xs text-[#424752] mt-0.5 capitalize">{roleLabels[user.rol] || user.rol}</div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-md text-[#424752] hover:bg-[#f2f4f6]">
                  <X size={20} />
                </button>
              </div>
              <SidebarNav onNavigate={go} />
            </div>
            <SidebarFooter />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        <header className="relative shrink-0 bg-white border-b border-[#c2c6d4] sticky top-0 z-20">
          <div className="relative h-16 sm:h-20 flex items-center justify-between px-3 sm:px-6 lg:px-10 gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={() => setMenuOpen(true)}
                className="lg:hidden p-2 -ml-1 rounded-md text-[#424752] hover:bg-[#f2f4f6]"
                aria-label="Abrir menú"
              >
                <Menu size={22} />
              </button>
              {search && (
                <div className="hidden sm:block w-[170px] md:w-[220px] lg:w-[260px]">
                  <SearchBox />
                </div>
              )}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 font-bold text-[#00478d] whitespace-nowrap text-base sm:text-lg lg:text-xl">
              <span className="hidden md:inline">Centro Médico Público de Zaculeu</span>
              <span className="md:hidden">C.M. Zaculeu</span>
            </div>
            <div className="flex items-center justify-end gap-2 sm:gap-5 flex-1">
              <div className="text-right mr-1 hidden sm:block">
                <div className="font-bold text-sm text-[#00478d]">{user.nombre || "Usuario"}</div>
                <div className="text-xs text-[#424752] capitalize">{user.rol || "---"}</div>
              </div>
              <div className="w-[38px] h-[38px] rounded-full bg-[#d0e1fb] border border-[#c2c6d4] flex items-center justify-center font-bold text-[#00478d] text-sm shrink-0">
                {(user.nombre || "U")[0]}
              </div>
            </div>
          </div>
          {search && (
            <div className="sm:hidden px-3 pb-3">
              <SearchBox autoFocus />
            </div>
          )}
        </header>

        <main className={`flex-1 ${mainClassName}`}>{children}</main>
      </div>
    </div>
  );
}