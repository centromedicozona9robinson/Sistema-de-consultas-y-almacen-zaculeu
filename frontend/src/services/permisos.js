// Matriz de permisos por rol del sistema
// administrador: todo | director: todo | medico: Panel + Expedientes | enfermera: Registro + Preconsultas
export const roles = {
  admin: ["administrador", "director"],
  registro: ["administrador", "director", "enfermera"],
  expedientes: ["administrador", "director", "medico"],
  triaje: ["administrador", "director", "enfermera"],
  consulta: ["administrador", "director", "medico"],
  crearVisita: ["administrador", "medico", "enfermera"],
  inventario: ["administrador", "director"],
  estadisticas: ["administrador", "director"],
};

export const roleLabels = {
  enfermera: "Personal de Enfermería",
  medico: "Personal Médico",
  administrador: "Panel Administrativo",
  director: "Dirección Médica",
};

// Filtra los ítems del menú lateral según el rol del usuario
export const filtrarNav = (rol, items) =>
  items.filter((item) => {
    if (item.path === "/admin") return roles.admin.includes(rol);
    if (item.path === "/registro") return roles.registro.includes(rol);
    if (item.path === "/inventario") return roles.inventario.includes(rol);
    if (item.path === "/estadisticas") return roles.estadisticas.includes(rol);
    if (item.path === "/expedientes") return roles.expedientes.includes(rol);
    if (item.path === "/preconsulta") return rol === "enfermera";
    if (item.path === "/") return rol !== "enfermera";
    return true;
  });
