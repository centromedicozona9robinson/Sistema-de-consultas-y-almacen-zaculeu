-- ============================================================
--  SISTEMA DIGITAL DE PRECONSULTA
--  Centro Médico Nacional — Centro de Salud Público
--  Zona 9 de Zaculeu, Huehuetenango, Guatemala
--
--  Base de datos: PostgreSQL 15+
--  Autor: Robinson Estuardo González Recinos
--  Universidad Mariano Gálvez de Guatemala
--  Proyecto de Graduación I — 2026
-- ============================================================

-- Ejecutar como superusuario:
-- CREATE DATABASE zaculeu_db ENCODING 'UTF8' LC_COLLATE 'es_GT.UTF-8' TEMPLATE template0;
-- \c zaculeu_db

-- ============================================================
--  TABLA: rol
-- ============================================================
CREATE TABLE IF NOT EXISTS rol (
  id_rol        SERIAL        PRIMARY KEY,
  nombre_rol    VARCHAR(50)   NOT NULL UNIQUE,
  descripcion   VARCHAR(200)
);

INSERT INTO rol (nombre_rol, descripcion) VALUES
  ('administrador', 'Acceso total: gestiona usuarios, bitácora y respaldos'),
  ('director',      'Acceso a reportes, bitácora y supervisión general del sistema'),
  ('medico',        'Consulta historial de pacientes y registra diagnósticos'),
  ('enfermera',     'Registra pacientes, toma de signos vitales y preconsulta')
ON CONFLICT (nombre_rol) DO NOTHING;

-- ============================================================
--  TABLA: usuario
-- ============================================================
CREATE TABLE IF NOT EXISTS usuario (
  id_usuario        SERIAL        PRIMARY KEY,
  nombre_completo   VARCHAR(150)  NOT NULL,
  nombre_usuario    VARCHAR(50)   NOT NULL UNIQUE,
  contrasena_hash   VARCHAR(255)  NOT NULL,
  id_rol            INT           NOT NULL REFERENCES rol(id_rol),
  activo            BOOLEAN       NOT NULL DEFAULT TRUE,
  fecha_creacion    TIMESTAMP     NOT NULL DEFAULT NOW(),
  ultimo_acceso     TIMESTAMP
);

-- Contraseñas iniciales: admin=Admin123!, directora=Directora123!, DOC=Doctor1234, Enfer=Enfer1234
INSERT INTO usuario (nombre_completo, nombre_usuario, contrasena_hash, id_rol) VALUES
  ('Administrador del Sistema', 'admin',    '$2b$10$F8Sk8kjm1cts.LwRnOKm0uSiI8rLMHMfrYlO18DaHgV1GbLFCdbfu', 1),
  ('Dra. Claudia Ramos',        'directora','$2b$10$fSg6BoCmdqZWN4XpManN/.fbcDyqOIQS5m0zNTxTIxH/ZMtHBWfG6', 2),
  ('Dr. Julián Ortega',         'DOC',      '$2b$10$Xx89CAT3IFMhrF2fTtqMTe./9.O4EgU2hmrPLr0/mgSBJHka7wE6u', 3),
  ('Ana López (Enfermería)',    'Enfer',    '$2b$10$Za.BM4XOm3DNDxIitqV55OYbnCmU9JBAsD7.0.3JtTC0BNQwm3/O6', 4)
ON CONFLICT (nombre_usuario) DO NOTHING;

-- ============================================================
--  TABLA: sesion
-- ============================================================
CREATE TABLE IF NOT EXISTS sesion (
  id_sesion         SERIAL        PRIMARY KEY,
  id_usuario        INT           NOT NULL REFERENCES usuario(id_usuario),
  token             VARCHAR(512)  NOT NULL,
  ip_equipo         VARCHAR(45),
  fecha_inicio      TIMESTAMP     NOT NULL DEFAULT NOW(),
  fecha_expiracion  TIMESTAMP     NOT NULL,
  activa            BOOLEAN       NOT NULL DEFAULT TRUE
);

-- ============================================================
--  TABLA: paciente
-- ============================================================
CREATE TABLE IF NOT EXISTS paciente (
  id_paciente           SERIAL        PRIMARY KEY,
  nombre_completo       VARCHAR(150)  NOT NULL,
  dpi                   VARCHAR(20)   UNIQUE,
  fecha_nacimiento      DATE          NOT NULL,
  sexo                  CHAR(1)       NOT NULL CHECK (sexo IN ('M','F')),
  direccion             VARCHAR(250),
  lat                   DOUBLE PRECISION,
  lng                   DOUBLE PRECISION,
  telefono              VARCHAR(15),
  es_cronico            BOOLEAN       NOT NULL DEFAULT FALSE,
  alergias              TEXT,
  enfermedades_cronicas TEXT,
  medicamentos_actuales TEXT,
  activo                BOOLEAN       NOT NULL DEFAULT TRUE,
  fecha_registro        TIMESTAMP     NOT NULL DEFAULT NOW(),
  id_usuario_registro   INT           NOT NULL REFERENCES usuario(id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_paciente_nombre   ON paciente(nombre_completo);
CREATE INDEX IF NOT EXISTS idx_paciente_dpi      ON paciente(dpi);
CREATE INDEX IF NOT EXISTS idx_paciente_cronico  ON paciente(es_cronico);

INSERT INTO paciente (nombre_completo, dpi, fecha_nacimiento, sexo, direccion, es_cronico, enfermedades_cronicas, alergias, medicamentos_actuales, id_usuario_registro) VALUES
  ('Ricardo Morales',    '2987123450101', '1990-03-15', 'M', 'Zona 9, Zaculeu, Huehuetenango', TRUE,  'Hipertensión Arterial, Rinitis Alérgica', 'Penicilina (Grave), Polen', 'Enalapril 10mg/12h, Cetirizina 10mg/noche', 4),
  ('Ana Lucía González', '3050987650901', '1996-07-22', 'F', 'Zona 3, Zaculeu, Huehuetenango', FALSE, NULL, NULL, NULL, 4),
  ('Jorge Pérez',        '1890223340101', '1962-11-08', 'M', 'Zona 10, Zaculeu, Huehuetenango', TRUE,  'Diabetes Tipo 2', NULL, 'Metformina 850mg/día', 4),
  ('María Velásquez',    '3122556671301', '2005-04-30', 'F', 'Zona 5, Zaculeu, Huehuetenango', FALSE, NULL, NULL, NULL, 4)
ON CONFLICT (dpi) DO NOTHING;

-- ============================================================
--  TABLA: visita
-- ============================================================
CREATE TABLE IF NOT EXISTS visita (
  id_visita             SERIAL        PRIMARY KEY,
  id_paciente           INT           NOT NULL REFERENCES paciente(id_paciente),
  motivo_consulta       TEXT,
  estado                VARCHAR(20)   NOT NULL DEFAULT 'pendiente'
                          CHECK (estado IN ('pendiente','en_triaje','completado')),
  fecha_visita          TIMESTAMP     NOT NULL DEFAULT NOW(),
  id_usuario_registro   INT           NOT NULL REFERENCES usuario(id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_visita_fecha_estado ON visita(fecha_visita, estado);
CREATE INDEX IF NOT EXISTS idx_visita_paciente     ON visita(id_paciente);

-- ============================================================
--  TABLA: preconsulta
-- ============================================================
CREATE TABLE IF NOT EXISTS preconsulta (
  id_preconsulta          SERIAL        PRIMARY KEY,
  id_visita               INT           NOT NULL UNIQUE REFERENCES visita(id_visita),
  presion_sistolica       SMALLINT,
  presion_diastolica      SMALLINT,
  frecuencia_cardiaca     SMALLINT,
  temperatura             NUMERIC(4,1),
  frecuencia_respiratoria SMALLINT,
  saturacion_oxigeno      NUMERIC(4,1),
  peso                    NUMERIC(5,2),
  talla                   NUMERIC(5,2),
  imc                     NUMERIC(4,2),
  alerta_signos           BOOLEAN       NOT NULL DEFAULT FALSE,
  detalle_alerta          TEXT,
  fecha_hora_registro     TIMESTAMP     NOT NULL DEFAULT NOW(),
  id_usuario_registro     INT           NOT NULL REFERENCES usuario(id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_preconsulta_alerta ON preconsulta(alerta_signos);

-- ============================================================
--  TABLA: consulta_medica
-- ============================================================
CREATE TABLE IF NOT EXISTS consulta_medica (
  id_consulta           SERIAL        PRIMARY KEY,
  id_visita             INT           NOT NULL UNIQUE REFERENCES visita(id_visita),
  diagnostico           TEXT,
  indicaciones          TEXT,
  observaciones         TEXT,
  fecha_seguimiento     DATE,
  fecha_hora_consulta   TIMESTAMP     NOT NULL DEFAULT NOW(),
  id_medico             INT           NOT NULL REFERENCES usuario(id_usuario)
);

-- ============================================================
--  TABLA: bitacora
-- ============================================================
CREATE TABLE IF NOT EXISTS bitacora (
  id_bitacora           SERIAL        PRIMARY KEY,
  id_usuario            INT           REFERENCES usuario(id_usuario),
  accion                VARCHAR(100)  NOT NULL,
  tabla_afectada        VARCHAR(50),
  id_registro_afectado  INT,
  descripcion           TEXT,
  ip_equipo             VARCHAR(45),
  fecha_hora            TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bitacora_usuario ON bitacora(id_usuario);
CREATE INDEX IF NOT EXISTS idx_bitacora_fecha   ON bitacora(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_bitacora_tabla   ON bitacora(tabla_afectada, id_registro_afectado);

-- ============================================================
--  TABLA: aviso_sistema
-- ============================================================
CREATE TABLE IF NOT EXISTS aviso_sistema (
  id_aviso      SERIAL        PRIMARY KEY,
  tipo          VARCHAR(20)   NOT NULL DEFAULT 'info'
                  CHECK (tipo IN ('info','advertencia','urgente')),
  titulo        VARCHAR(200)  NOT NULL,
  descripcion   TEXT,
  activo        BOOLEAN       NOT NULL DEFAULT TRUE,
  fecha_inicio  TIMESTAMP     NOT NULL DEFAULT NOW(),
  fecha_fin     TIMESTAMP,
  id_usuario    INT           NOT NULL REFERENCES usuario(id_usuario)
);

-- ============================================================
--  VISTAS
-- ============================================================
CREATE OR REPLACE VIEW v_visitas_hoy AS
SELECT
  v.id_visita,
  p.id_paciente,
  p.nombre_completo,
  p.dpi,
  DATE_PART('year', AGE(p.fecha_nacimiento))::INT AS edad,
  p.sexo,
  p.es_cronico,
  v.motivo_consulta,
  v.estado,
  v.fecha_visita,
  pr.presion_sistolica,
  pr.presion_diastolica,
  pr.frecuencia_cardiaca,
  pr.temperatura,
  pr.peso,
  pr.talla,
  pr.imc,
  pr.alerta_signos,
  cm.diagnostico,
  cm.fecha_seguimiento
FROM visita v
  INNER JOIN paciente p      ON v.id_paciente = p.id_paciente
  LEFT  JOIN preconsulta pr  ON v.id_visita   = pr.id_visita
  LEFT  JOIN consulta_medica cm ON v.id_visita = cm.id_visita
WHERE v.fecha_visita::DATE = CURRENT_DATE
ORDER BY v.fecha_visita DESC;

CREATE OR REPLACE VIEW v_estadisticas_dia AS
SELECT
  COUNT(DISTINCT v.id_visita)                                                           AS total_visitas_hoy,
  COUNT(DISTINCT v.id_visita) FILTER (WHERE v.estado = 'pendiente')                    AS pendientes,
  COUNT(DISTINCT v.id_visita) FILTER (WHERE v.estado = 'en_triaje')                    AS en_triaje,
  COUNT(DISTINCT v.id_visita) FILTER (WHERE v.estado = 'completado')                   AS completados,
  COUNT(DISTINCT v.id_visita) FILTER (WHERE pr.alerta_signos = TRUE)                   AS con_alertas,
  COUNT(DISTINCT v.id_visita) FILTER (WHERE v.fecha_visita >= NOW() - INTERVAL '1 hour') AS registros_ultima_hora
FROM visita v
  LEFT JOIN preconsulta pr ON v.id_visita = pr.id_visita
WHERE v.fecha_visita::DATE = CURRENT_DATE;

-- ============================================================
--  MÓDULO: INVENTARIO DE MEDICINA (NUEVO)
-- ============================================================

-- Categorías/clasificación de medicamentos (analgésicos, antibióticos, etc.)
CREATE TABLE IF NOT EXISTS categoria_medicamento (
  id_categoria     SERIAL        PRIMARY KEY,
  nombre_categoria VARCHAR(100)  NOT NULL UNIQUE,
  descripcion      VARCHAR(250)
);

-- Catálogo maestro de medicamentos (NO guarda existencias, eso va en lote)
CREATE TABLE IF NOT EXISTS medicamento (
  id_medicamento     SERIAL        PRIMARY KEY,
  nombre_medicamento VARCHAR(150)  NOT NULL,
  nombre_generico    VARCHAR(150),
  id_categoria       INT           REFERENCES categoria_medicamento(id_categoria),
  forma_farmaceutica VARCHAR(50),
  concentracion      VARCHAR(50),
  unidad_medida      VARCHAR(20)   NOT NULL,
  stock_minimo       INT           NOT NULL DEFAULT 0,
  requiere_receta    BOOLEAN       NOT NULL DEFAULT TRUE,
  activo             BOOLEAN       NOT NULL DEFAULT TRUE,
  fecha_creacion     TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicamento_nombre ON medicamento(nombre_medicamento);

-- Lotes: cada compra/ingreso genera un lote con su vencimiento (control FEFO)
CREATE TABLE IF NOT EXISTS lote_medicamento (
  id_lote                 SERIAL        PRIMARY KEY,
  id_medicamento          INT           NOT NULL REFERENCES medicamento(id_medicamento),
  numero_lote             VARCHAR(50)   NOT NULL,
  fecha_fabricacion       DATE,
  fecha_vencimiento       DATE          NOT NULL,
  cantidad_inicial        INT           NOT NULL,
  cantidad_actual         INT           NOT NULL,
  precio_compra_unitario  NUMERIC(10,2),
  fecha_ingreso           TIMESTAMP     NOT NULL DEFAULT NOW(),
  id_usuario_registro     INT           REFERENCES usuario(id_usuario),
  UNIQUE (id_medicamento, numero_lote)
);

CREATE INDEX IF NOT EXISTS idx_lote_medicamento ON lote_medicamento(id_medicamento);
CREATE INDEX IF NOT EXISTS idx_lote_vencimiento ON lote_medicamento(fecha_vencimiento);

-- Kardex: registra cada entrada, salida o ajuste del almacén de farmacia
CREATE TABLE IF NOT EXISTS movimiento_inventario (
  id_movimiento     SERIAL        PRIMARY KEY,
  id_lote           INT           NOT NULL REFERENCES lote_medicamento(id_lote),
  tipo_movimiento   VARCHAR(20)   NOT NULL
                      CHECK (tipo_movimiento IN ('entrada','salida','ajuste','merma','devolucion')),
  cantidad          INT           NOT NULL,
  motivo            VARCHAR(200),
  id_usuario        INT           REFERENCES usuario(id_usuario),
  fecha_hora        TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimiento_lote  ON movimiento_inventario(id_lote);
CREATE INDEX IF NOT EXISTS idx_movimiento_fecha ON movimiento_inventario(fecha_hora);

-- Prescripción médica generada dentro de una consulta
CREATE TABLE IF NOT EXISTS prescripcion (
  id_prescripcion           SERIAL        PRIMARY KEY,
  id_consulta               INT           NOT NULL REFERENCES consulta_medica(id_consulta),
  id_medicamento            INT           NOT NULL REFERENCES medicamento(id_medicamento),
  dosis                     VARCHAR(100),
  frecuencia                VARCHAR(100),
  duracion_dias             SMALLINT,
  cantidad_recetada         INT           NOT NULL,
  indicaciones_adicionales  TEXT,
  fecha_hora                TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- Dispensación: entrega física del medicamento, descontando de un lote (trazabilidad)
CREATE TABLE IF NOT EXISTS dispensacion (
  id_dispensacion     SERIAL        PRIMARY KEY,
  id_prescripcion     INT           NOT NULL REFERENCES prescripcion(id_prescripcion),
  id_lote             INT           REFERENCES lote_medicamento(id_lote),
  cantidad_dispensada INT           NOT NULL,
  id_usuario_dispensa INT           REFERENCES usuario(id_usuario),
  fecha_hora          TIMESTAMP     NOT NULL DEFAULT NOW(),
  observaciones       VARCHAR(250)
);

-- Caché de geocodificación: coordena resultados de Nominatim por dirección para
-- no repetir llamadas externas en cada carga de la pestaña de estadísticas
-- (el servidor la crea automáticamente en el arranque si no existe).
CREATE TABLE IF NOT EXISTS geocodigo_cache (
  direccion TEXT             PRIMARY KEY,
  lat       DOUBLE PRECISION,
  lng       DOUBLE PRECISION,
  lugar     TEXT,
  fecha     TIMESTAMP         NOT NULL DEFAULT NOW()
);

INSERT INTO categoria_medicamento (nombre_categoria, descripcion) VALUES
  ('Analgésicos',         'Alivio del dolor'),
  ('Antibióticos',        'Tratamiento de infecciones bacterianas'),
  ('Antiinflamatorios',   'Reducción de inflamación'),
  ('Antihistamínicos',    'Tratamiento de alergias'),
  ('Antihipertensivos',   'Control de presión arterial'),
  ('Antipiréticos',       'Control de fiebre'),
  ('Antigripales',        'Tratamiento de resfriados y gripe')
ON CONFLICT (nombre_categoria) DO NOTHING;
