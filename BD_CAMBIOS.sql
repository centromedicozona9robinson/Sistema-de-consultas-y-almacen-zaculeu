-- ============================================================
-- CAMBIOS A BASE DE DATOS - SISTEMA DE CONSULTAS
-- Generado: Mon Oct 05 2026
-- ============================================================

-- 1. PRECONSULTA - Campos adicionales
ALTER TABLE preconsulta ADD COLUMN IF NOT EXISTS sintomas TEXT;
ALTER TABLE preconsulta ADD COLUMN IF NOT EXISTS hallazgos TEXT;
ALTER TABLE preconsulta ADD COLUMN IF NOT EXISTS recetado TEXT;
ALTER TABLE preconsulta ADD COLUMN IF NOT EXISTS tipo_visita TEXT CHECK (tipo_visita IN ('CONSULTA','RECONSULTA','AMBAS'));
ALTER TABLE preconsulta ADD COLUMN IF NOT EXISTS es_consulta BOOLEAN DEFAULT FALSE;
ALTER TABLE preconsulta ADD COLUMN IF NOT EXISTS es_reconsulta BOOLEAN DEFAULT FALSE;
ALTER TABLE preconsulta ADD COLUMN IF NOT EXISTS motivo_mapeado TEXT;
ALTER TABLE preconsulta ADD COLUMN IF NOT EXISTS corregido_por INT REFERENCES usuario(id_usuario);
ALTER TABLE preconsulta ADD COLUMN IF NOT EXISTS fecha_corregido TIMESTAMP;
ALTER TABLE preconsulta ADD COLUMN IF NOT EXISTS motivo_correcion TEXT;

-- 2. PACIENTE - Datos de embarazo y crónicos
ALTER TABLE paciente ADD COLUMN IF NOT EXISTS esta_embarazada BOOLEAN DEFAULT FALSE;
ALTER TABLE paciente ADD COLUMN IF NOT EXISTS embarazo_finalizado BOOLEAN DEFAULT FALSE;
ALTER TABLE paciente ADD COLUMN IF NOT EXISTS fecha_embarazo_finalizado TIMESTAMP;
ALTER TABLE paciente ADD COLUMN IF NOT EXISTS usuario_embarazo_finalizado INT REFERENCES usuario(id_usuario);
ALTER TABLE paciente ADD COLUMN IF NOT EXISTS motivo_embarazo_finalizado TEXT;
ALTER TABLE paciente ADD COLUMN IF NOT EXISTS imc_pregestacional NUMERIC(4,2);
ALTER TABLE paciente ADD COLUMN IF NOT EXISTS peso_habitual_kg NUMERIC(6,2);
ALTER TABLE paciente ADD COLUMN IF NOT EXISTS fur DATE;
ALTER TABLE paciente ADD COLUMN IF NOT EXISTS fpp DATE;
ALTER TABLE paciente ADD COLUMN IF NOT EXISTS semana_gestacion SMALLINT;
ALTER TABLE paciente ADD COLUMN IF NOT EXISTS fecha_registro_embarazo TIMESTAMP;
ALTER TABLE paciente ADD COLUMN IF NOT EXISTS usuario_registro_embarazo INT REFERENCES usuario(id_usuario);

-- 3. CONSULTA MÉDICA - Versionado y correcciones
ALTER TABLE consulta_medica ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE consulta_medica ADD COLUMN IF NOT EXISTS tipo_version VARCHAR(20) DEFAULT 'original' CHECK (tipo_version IN ('original','corregido'));
ALTER TABLE consulta_medica ADD COLUMN IF NOT EXISTS padre_version INT REFERENCES consulta_medica(id_consulta);
ALTER TABLE consulta_medica ADD COLUMN IF NOT EXISTS corregido_por INT REFERENCES usuario(id_usuario);
ALTER TABLE consulta_medica ADD COLUMN IF NOT EXISTS fecha_corregido TIMESTAMP;
ALTER TABLE consulta_medica ADD COLUMN IF NOT EXISTS motivo_correcion TEXT;
ALTER TABLE consulta_medica ADD COLUMN IF NOT EXISTS entregado BOOLEAN DEFAULT FALSE;
ALTER TABLE consulta_medica ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMP;

-- 4. CATÁLOGO: ENFERMEDADES CRÓNICAS
CREATE TABLE IF NOT EXISTS enfermedad_cronica (
  id_enfermedad_cronica SERIAL PRIMARY KEY,
  grupo VARCHAR(80) NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  edad_min SMALLINT,
  edad_max SMALLINT,
  sexo_aplica CHAR(1) NOT NULL CHECK (sexo_aplica IN ('M','F','A')),
  requiere_localizacion BOOLEAN DEFAULT FALSE,
  activa BOOLEAN DEFAULT TRUE,
  orden SMALLINT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ec_grupo ON enfermedad_cronica(grupo);
CREATE INDEX IF NOT EXISTS idx_ec_activa ON enfermedad_cronica(activa);

-- 5. PACIENTE - ENFERMEDADES CRÓNICAS (RELACIÓN)
CREATE TABLE IF NOT EXISTS paciente_enfermedad_cronica (
  id_paciente_enfermedad_cronica SERIAL PRIMARY KEY,
  id_paciente INT NOT NULL REFERENCES paciente(id_paciente) ON DELETE CASCADE,
  id_enfermedad_cronica INT NOT NULL REFERENCES enfermedad_cronica(id_enfermedad_cronica),
  localizacion VARCHAR(80),
  fecha_diagnostico DATE,
  activa BOOLEAN DEFAULT TRUE,
  observacion TEXT,
  fecha_registro TIMESTAMP DEFAULT NOW(),
  id_usuario_registro INT REFERENCES usuario(id_usuario)
);
CREATE INDEX IF NOT EXISTS idx_pxc_paciente ON paciente_enfermedad_cronica(id_paciente);
CREATE INDEX IF NOT EXISTS idx_pxc_ec ON paciente_enfermedad_cronica(id_enfermedad_cronica);

-- 6. FACTORES DE RIESGO Y TAMIZAJES
CREATE TABLE IF NOT EXISTS factor_riesgo (
  id_factor_riesgo SERIAL PRIMARY KEY,
  id_visita INT NOT NULL REFERENCES visita(id_visita) ON DELETE CASCADE,
  sobrepeso BOOLEAN DEFAULT FALSE,
  sobrepeso_imc NUMERIC(4,2),
  obesidad BOOLEAN DEFAULT FALSE,
  obesidad_imc NUMERIC(4,2),
  circ_abdominal BOOLEAN DEFAULT FALSE,
  circ_abdominal_cm NUMERIC(5,2),
  circ_abdominal_fecha DATE,
  riesgo_ecv_elevado BOOLEAN DEFAULT FALSE,
  riesgo_ecv_observacion TEXT,
  fecha_registro TIMESTAMP DEFAULT NOW(),
  id_usuario_registro INT REFERENCES usuario(id_usuario)
);
CREATE INDEX IF NOT EXISTS idx_fr_visita ON factor_riesgo(id_visita);

-- 7. AUDITORÍA DE CORRECCIONES
CREATE TABLE IF NOT EXISTS auditoria_correccion (
  id_auditoria_correccion SERIAL PRIMARY KEY,
  id_visita INT REFERENCES visita(id_visita),
  id_consulta_original INT REFERENCES consulta_medica(id_consulta),
  id_consulta_corregida INT REFERENCES consulta_medica(id_consulta),
  tabla VARCHAR(50),
  campo VARCHAR(100),
  valor_anterior TEXT,
  valor_nuevo TEXT,
  motivo TEXT,
  id_usuario INT REFERENCES usuario(id_usuario),
  ip_equipo VARCHAR(45),
  fecha_hora TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ac_visita ON auditoria_correccion(id_visita);
CREATE INDEX IF NOT EXISTS idx_ac_fecha ON auditoria_correccion(fecha_hora);

-- 8. SEED - CATÁLOGO ENFERMEDADES CRÓNICAS
INSERT INTO enfermedad_cronica (grupo, nombre, edad_min, edad_max, sexo_aplica, requiere_localizacion, orden) VALUES
('Diabetes Mellitus','Diabetes Mellitus Pct. 0 a 19 años',0,19,'A',false,1),
('Diabetes Mellitus','Diabetes Mellitus Pct. 20 a 39 años',20,39,'A',false,2),
('Diabetes Mellitus','Diabetes Mellitus Pct. 40 a 59 años',40,59,'A',false,3),
('Diabetes Mellitus','Diabetes Mellitus Pct. 60 y + años',60,999,'A',false,4),
('Hipertensión Arterial','Hipertensión Arterial Pct. 0 a 19 años',0,19,'A',false,5),
('Hipertensión Arterial','Hipertensión Arterial Pct. 20 a 39 años',20,39,'A',false,6),
('Hipertensión Arterial','Hipertensión Arterial Pct. 40 a 59 años',40,59,'A',false,7),
('Hipertensión Arterial','Hipertensión Arterial Pct. 60 y + años',60,999,'A',false,8),
('Insuficiencia Renal Crónica','Insuficiencia Renal Crónica 0 a 19 años',0,19,'A',false,9),
('Insuficiencia Renal Crónica','Insuficiencia Renal Crónica 20 a 39 años',20,39,'A',false,10),
('Insuficiencia Renal Crónica','Insuficiencia Renal Crónica 40 a 59 años',40,59,'A',false,11),
('Insuficiencia Renal Crónica','Insuficiencia Renal Crónica 60 y + años',60,999,'A',false,12),
('Enfermedades Cardiovasculares','Enfermedades Cardiovasculares 0 a 19 años',0,19,'A',false,13),
('Enfermedades Cardiovasculares','Enfermedades Cardiovasculares 20 a 39 años',20,39,'A',false,14),
('Enfermedades Cardiovasculares','Enfermedades Cardiovasculares 40 a 59 años',40,59,'A',false,15),
('Enfermedades Cardiovasculares','Enfermedades Cardiovasculares 60 y + años',60,999,'A',false,16),
('Cáncer','Cáncer Pct. De 0 a 19 años',0,19,'A',true,17),
('Cáncer','Cáncer Pct. De 20 a 39 años',20,39,'A',true,18),
('Cáncer','Cáncer Pct. De 40 a 59 años',40,59,'A',true,19),
('Cáncer','Cáncer Pct. De 60 y más años',60,999,'A',true,20),
('Cáncer - Localización','Cáncer Gástrico',0,999,'A',false,21),
('Cáncer - Localización','Cáncer Pulmonar',0,999,'A',false,22),
('Cáncer - Localización','Cáncer de Próstata',0,999,'M',false,23),
('Cáncer - Localización','Cáncer de Mama',0,999,'F',false,24),
('Cáncer - Localización','Cáncer de Cérvix',0,999,'F',false,25)
ON CONFLICT DO NOTHING;
