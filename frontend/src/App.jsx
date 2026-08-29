import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import PanelControl from "./pages/PanelControl";
import ExpedientesClinicos from "./pages/ExpedientesClinicos";
import RegistroPacientes from "./pages/RegistroPacientes";
import Login from "./pages/Login";
import ControlAcceso from "./pages/ControlAcceso";
import Preconsulta from "./pages/Preconsulta";
import ConsultaMedica from "./pages/ConsultaMedica";
import Inventario from "./pages/Inventario";

const ProtectedRoute = ({ children }) => {
  const isAuth = localStorage.getItem("auth");
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const RoleRoute = ({ roles, children }) => {
  const auth = JSON.parse(localStorage.getItem("auth") || "null");
  if (!auth) {
    return <Navigate to="/login" replace />;
  }
  if (!roles.includes(auth.rol)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// El panel principal redirige a enfermería a su módulo de preconsultas
const HomeRoute = ({ children }) => {
  const auth = JSON.parse(localStorage.getItem("auth") || "null");
  if (!auth) {
    return <Navigate to="/login" replace />;
  }
  if (auth.rol === "enfermera") {
    return <Navigate to="/preconsulta" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><HomeRoute><PanelControl /></HomeRoute></ProtectedRoute>} />
        <Route path="/expedientes" element={<RoleRoute roles={["administrador", "director", "medico"]}><ExpedientesClinicos /></RoleRoute>} />
        <Route path="/registro" element={<RoleRoute roles={["administrador", "director", "enfermera"]}><RegistroPacientes /></RoleRoute>} />
        <Route path="/admin" element={<RoleRoute roles={["administrador", "director"]}><ControlAcceso /></RoleRoute>} />
        <Route path="/preconsulta" element={<ProtectedRoute><Preconsulta /></ProtectedRoute>} />
        <Route path="/consulta" element={<RoleRoute roles={["administrador", "director", "medico"]}><ConsultaMedica /></RoleRoute>} />
        <Route path="/inventario" element={<RoleRoute roles={["administrador", "director"]}><Inventario /></RoleRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
