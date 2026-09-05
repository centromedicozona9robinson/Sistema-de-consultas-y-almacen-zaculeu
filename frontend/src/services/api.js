// Centraliza todas las llamadas al backend
// Usa la variable de entorno VITE_API_URL (definida en .env.production o en el
// panel de Vercel). Si no existe, usa localhost para desarrollo.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export const api = {
  // AUTH
  login: async (username, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    return data;
  },

  // PACIENTES
  getPacientes: async () => {
    const res = await fetch(`${API_URL}/patients`);
    if (!res.ok) throw new Error('Error obteniendo pacientes');
    return res.json();
  },

  crearPaciente: async (paciente) => {
    const res = await fetch(`${API_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paciente),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear paciente');
    return data;
  },

  eliminarPaciente: async (id, idUsuario) => {
    const res = await fetch(`${API_URL}/patients/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_usuario_editor: idUsuario }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar expediente');
    return data;
  },

  // VISITAS
  crearVisita: async (visita) => {
    const res = await fetch(`${API_URL}/visitas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visita),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear visita');
    return data;
  },

  getVisitasHoy: async () => {
    const res = await fetch(`${API_URL}/visitas/hoy`);
    if (!res.ok) throw new Error('Error obteniendo visitas');
    return res.json();
  },

  getVisita: async (id_visita) => {
    const res = await fetch(`${API_URL}/visitas/${id_visita}`);
    if (!res.ok) throw new Error('Error obteniendo visita');
    return res.json();
  },

  getEstadisticas: async () => {
    const res = await fetch(`${API_URL}/visitas/estadisticas`);
    if (!res.ok) throw new Error('Error obteniendo estadísticas');
    return res.json();
  },

  // PRECONSULTA
  registrarPreconsulta: async (data) => {
    const res = await fetch(`${API_URL}/preconsulta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al registrar preconsulta');
    return result;
  },

  getPreconsulta: async (id_visita) => {
    const res = await fetch(`${API_URL}/preconsulta/${id_visita}`);
    if (!res.ok) throw new Error('Error obteniendo preconsulta');
    return res.json();
  },

  // CONSULTA MÉDICA
  registrarConsulta: async (data) => {
    const res = await fetch(`${API_URL}/consulta_medica`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al registrar consulta');
    return result;
  },

  getConsulta: async (id_visita) => {
    const res = await fetch(`${API_URL}/consulta_medica/${id_visita}`);
    if (!res.ok) throw new Error('Error obteniendo consulta');
    return res.json();
  },

  // USUARIOS (Control de acceso)
  getUsuarios: async () => {
    const res = await fetch(`${API_URL}/usuarios`);
    if (!res.ok) throw new Error('Error obteniendo usuarios');
    return res.json();
  },

  crearUsuario: async (usuario) => {
    const res = await fetch(`${API_URL}/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(usuario),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
    return data;
  },

  eliminarUsuario: async (id) => {
    const res = await fetch(`${API_URL}/usuarios/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar usuario');
    return res.json();
  },

  actualizarUsuario: async (id, usuario) => {
    const res = await fetch(`${API_URL}/usuarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(usuario),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar usuario');
    return data;
  },

  // EXPEDIENTE DE PACIENTE
  getExpediente: async (id_paciente) => {
    const res = await fetch(`${API_URL}/expediente/${id_paciente}`);
    if (!res.ok) throw new Error('Error obteniendo expediente');
    return res.json();
  },
  // ROLES
  getRoles: async () => {
    const res = await fetch(`${API_URL}/roles`);
    if (!res.ok) throw new Error('Error obteniendo roles');
    return res.json();
  },

  // INVENTARIO DE MEDICINA
  getCategorias: async () => {
    const res = await fetch(`${API_URL}/categorias`);
    if (!res.ok) throw new Error('Error obteniendo categorías');
    return res.json();
  },

  crearCategoria: async (categoria) => {
    const res = await fetch(`${API_URL}/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoria),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear categoría');
    return data;
  },

  getMedicamentos: async () => {
    const res = await fetch(`${API_URL}/medicamentos`);
    if (!res.ok) throw new Error('Error obteniendo medicamentos');
    return res.json();
  },

  crearMedicamento: async (medicamento) => {
    const res = await fetch(`${API_URL}/medicamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(medicamento),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar medicamento');
    return data;
  },

  actualizarMedicamento: async (id, medicamento) => {
    const res = await fetch(`${API_URL}/medicamentos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(medicamento),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar medicamento');
    return data;
  },

  eliminarMedicamento: async (id, idUsuario) => {
    const res = await fetch(`${API_URL}/medicamentos/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_usuario_editor: idUsuario }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar medicamento');
    return data;
  },

  getLotes: async (id_medicamento) => {
    const q = id_medicamento ? `?id_medicamento=${id_medicamento}` : '';
    const res = await fetch(`${API_URL}/lotes${q}`);
    if (!res.ok) throw new Error('Error obteniendo lotes');
    return res.json();
  },

  eliminarLote: async (id, idUsuario) => {
    const res = await fetch(`${API_URL}/lotes/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_usuario_editor: idUsuario }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar lote');
    return data;
  },

  ingresarLote: async (lote) => {
    const res = await fetch(`${API_URL}/lotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lote),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al ingresar lote');
    return data;
  },

  getMovimientosInventario: async () => {
    const res = await fetch(`${API_URL}/inventario/movimientos`);
    if (!res.ok) throw new Error('Error obteniendo movimientos de inventario');
    return res.json();
  },

  getResumenInventario: async () => {
    const res = await fetch(`${API_URL}/inventario/resumen`);
    if (!res.ok) throw new Error('Error obteniendo resumen de inventario');
    return res.json();
  },

  // ESTADÍSTICAS Y REPORTES
  getEstadisticasVisitas: async (desde, hasta) => {
    const q = new URLSearchParams({ desde, hasta }).toString();
    const res = await fetch(`${API_URL}/estadisticas/visitas?${q}`);
    if (!res.ok) throw new Error('Error obteniendo estadísticas de visitas');
    return res.json();
  },

  getEstadisticasMedicamentos: async (desde, hasta) => {
    const q = new URLSearchParams({ desde, hasta }).toString();
    const res = await fetch(`${API_URL}/estadisticas/medicamentos?${q}`);
    if (!res.ok) throw new Error('Error obteniendo estadísticas de medicamentos');
    return res.json();
  },

  getEstadisticasDiagnosticos: async (desde, hasta) => {
    const q = new URLSearchParams({ desde, hasta }).toString();
    const res = await fetch(`${API_URL}/estadisticas/diagnosticos?${q}`);
    if (!res.ok) throw new Error('Error obteniendo estadísticas de diagnósticos');
    return res.json();
  },

  getEstadisticasPacientes: async () => {
    const res = await fetch(`${API_URL}/estadisticas/pacientes`);
    if (!res.ok) throw new Error('Error obteniendo estadísticas de pacientes');
    return res.json();
  },
};
