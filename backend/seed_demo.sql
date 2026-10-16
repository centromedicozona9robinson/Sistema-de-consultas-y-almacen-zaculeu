-- ============================================================
-- DATOS DE DEMOSTRACIÓN (NO se aplican en producción)
-- ------------------------------------------------------------
-- Carga pacientes, visitas, preconsultas, consultas (incluidas
-- correcciones y entregas), factores de riesgo, enfermedades
-- crónicas, embarazadas con IMC, medicamentos/lotes, recetas,
-- dispensaciones, movimientos de inventario, avisos y bitácora,
-- para ver en funcionamiento TODAS las estadísticas y las
-- funcionalidades nuevas (editar / corregir / entregar).
--
-- Uso:
--   psql "postgresql://postgres:postgres@127.0.0.1:5434/zaculeu_db" -f backend/seed_demo.sql
--
-- Es idempotente: identifica los registros demo por
--   * paciente.dpi                     LIKE '9000%'
--   * medicamento.nombre_medicamento   LIKE 'DEMO %'
-- y los elimina/regenera en cada ejecución.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) LIMPIEZA DE DATOS DEMO PREVIOS (respetando FKs)
-- ------------------------------------------------------------
DELETE FROM dispensacion d
 USING prescripcion p, consulta_medica c, visita v, paciente pa
 WHERE d.id_prescripcion = p.id_prescripcion
   AND p.id_consulta = c.id_consulta
   AND c.id_visita = v.id_visita
   AND v.id_paciente = pa.id_paciente
   AND pa.dpi LIKE '9000%';

DELETE FROM movimiento_inventario m
 USING lote_medicamento l, medicamento me
 WHERE m.id_lote = l.id_lote
   AND l.id_medicamento = me.id_medicamento
   AND me.nombre_medicamento LIKE 'DEMO %';

DELETE FROM prescripcion p
 USING consulta_medica c, visita v, paciente pa
 WHERE p.id_consulta = c.id_consulta
   AND c.id_visita = v.id_visita
   AND v.id_paciente = pa.id_paciente
   AND pa.dpi LIKE '9000%';

DELETE FROM auditoria_correccion a
 USING visita v, paciente pa
 WHERE a.id_visita = v.id_visita
   AND v.id_paciente = pa.id_paciente
   AND pa.dpi LIKE '9000%';

DELETE FROM consulta_medica c
 USING visita v, paciente pa
 WHERE c.id_visita = v.id_visita
   AND v.id_paciente = pa.id_paciente
   AND pa.dpi LIKE '9000%';

DELETE FROM factor_riesgo f
 USING visita v, paciente pa
 WHERE f.id_visita = v.id_visita
   AND v.id_paciente = pa.id_paciente
   AND pa.dpi LIKE '9000%';

DELETE FROM preconsulta pr
 USING visita v, paciente pa
 WHERE pr.id_visita = v.id_visita
   AND v.id_paciente = pa.id_paciente
   AND pa.dpi LIKE '9000%';

DELETE FROM visita v
 USING paciente pa
 WHERE v.id_paciente = pa.id_paciente
   AND pa.dpi LIKE '9000%';

DELETE FROM paciente_enfermedad_cronica pec
 USING paciente pa
 WHERE pec.id_paciente = pa.id_paciente
   AND pa.dpi LIKE '9000%';

DELETE FROM paciente WHERE dpi LIKE '9000%';

DELETE FROM lote_medicamento l
 USING medicamento me
 WHERE l.id_medicamento = me.id_medicamento
   AND me.nombre_medicamento LIKE 'DEMO %';

DELETE FROM medicamento WHERE nombre_medicamento LIKE 'DEMO %';

DELETE FROM aviso_sistema WHERE titulo LIKE '[DEMO]%';

-- ------------------------------------------------------------
-- 2) CATEGORÍAS Y MEDICAMENTOS DEMO
-- ------------------------------------------------------------
INSERT INTO categoria_medicamento (nombre_categoria, descripcion)
SELECT v.nombre_categoria, v.descripcion
FROM (VALUES
    ('Antidiabéticos',    'Control de la glucosa'),
    ('Gastroprotectores', 'Protección de la mucosa gástrica'),
    ('Sueros',            'Rehidratación oral')
) AS v(nombre_categoria, descripcion)
WHERE NOT EXISTS (
    SELECT 1 FROM categoria_medicamento c WHERE c.nombre_categoria = v.nombre_categoria
);

INSERT INTO medicamento (nombre_medicamento, nombre_generico, id_categoria, forma_farmaceutica, concentracion, unidad_medida, stock_minimo, requiere_receta, activo)
SELECT m.nombre, m.generico, cat.id_categoria, m.forma, m.concentracion, m.unidad, m.stock, m.requiere_receta, TRUE
FROM (VALUES
    ('DEMO Paracetamol 500 mg', 'Paracetamol', 'Antipiréticos', 'Tableta', '500 mg', 'caja', 60, FALSE),
    ('DEMO Ibuprofeno 400 mg', 'Ibuprofeno', 'Antiinflamatorios', 'Tableta', '400 mg', 'caja', 60, FALSE),
    ('DEMO Amoxicilina 500 mg', 'Amoxicilina', 'Antibióticos', 'Cápsula', '500 mg', 'caja', 40, TRUE),
    ('DEMO Loratadina 10 mg', 'Loratadina', 'Antihistamínicos', 'Tableta', '10 mg', 'caja', 50, FALSE),
    ('DEMO Enalapril 10 mg', 'Enalapril', 'Antihipertensivos', 'Tableta', '10 mg', 'caja', 50, TRUE),
    ('DEMO Metformina 850 mg', 'Metformina', 'Antidiabéticos', 'Tableta', '850 mg', 'caja', 40, TRUE),
    ('DEMO Omeprazol 20 mg', 'Omeprazol', 'Gastroprotectores', 'Cápsula', '20 mg', 'caja', 40, FALSE),
    ('DEMO Sales de Rehidratación Oral', 'Sales de rehidratación oral', 'Sueros', 'Sobre', '20.5 g', 'sobre', 80, FALSE)
) AS m(nombre, generico, categoria, forma, concentracion, unidad, stock, requiere_receta)
JOIN categoria_medicamento cat ON cat.nombre_categoria = m.categoria;

INSERT INTO lote_medicamento (id_medicamento, numero_lote, fecha_fabricacion, fecha_vencimiento, cantidad_inicial, cantidad_actual, precio_compra_unitario, fecha_ingreso, id_usuario_registro)
SELECT me.id_medicamento,
       'LOTE-' || me.id_medicamento || '-A',
       CURRENT_DATE - INTERVAL '90 days',
       CURRENT_DATE + INTERVAL '540 days',
       300, 300,
       ROUND((2 + (me.id_medicamento % 7) * 1.35)::NUMERIC, 2),
       now() - INTERVAL '60 days', 1
FROM medicamento me
WHERE me.nombre_medicamento LIKE 'DEMO %';

-- ------------------------------------------------------------
-- 3) PACIENTES DEMO
-- ------------------------------------------------------------
INSERT INTO paciente (nombre_completo, dpi, fecha_nacimiento, sexo, direccion, lat, lng, telefono, es_cronico, alergias, enfermedades_cronicas, medicamentos_actuales, esta_embarazada, activo, fecha_registro, id_usuario_registro)
VALUES
('Pedro Demo Chan',     '9000000000001', '1985-03-12', 'M', 'Zona 1, Huehuetenango, Huehuetenango', 15.319600, -91.468000, '5551-0001', TRUE,  'Penicilina',                    'Hipertensión arterial',            'Losartan 50 mg',          FALSE, TRUE, now(), 4),
('Lucía Demo Ramírez',  '9000000000002', '1996-07-21', 'F', 'Zona 2, Huehuetenango, Huehuetenango', 15.316000, -91.474000, '5551-0002', FALSE, NULL,                            NULL,                               NULL,                      TRUE,  TRUE, now(), 4),
('Marta Demo Ixcoy',    '9000000000003', '1990-11-02', 'F', 'Zona 3, Huehuetenango, Huehuetenango', 15.312000, -91.480000, '5551-0003', FALSE, 'Sulfas',                        NULL,                               NULL,                      TRUE,  TRUE, now(), 4),
('José Demo López',     '9000000000004', '1955-01-15', 'M', 'Zona 4, Huehuetenango, Huehuetenango', 15.325000, -91.472000, '5551-0004', TRUE,  NULL,                            'Diabetes mellitus tipo 2',         'Metformina 850 mg',       FALSE, TRUE, now(), 4),
('Ana Demo García',     '9000000000005', '2001-05-30', 'F', 'Zona 5, Huehuetenango, Huehuetenango', 15.329000, -91.465000, '5551-0005', FALSE, NULL,                            NULL,                               NULL,                      TRUE,  TRUE, now(), 4),
('Carlos Demo Méndez',  '9000000000006', '2018-09-10', 'M', 'Zona 6, Huehuetenango, Huehuetenango', 15.308000, -91.462000, '5551-0006', FALSE, NULL,                            NULL,                               NULL,                      FALSE, TRUE, now(), 4),
('Sofía Demo Aguilar',  '9000000000007', '2015-02-18', 'F', 'Zona 7, Huehuetenango, Huehuetenango', 15.322000, -91.458000, '5551-0007', FALSE, 'Mariscos',                      NULL,                               NULL,                      FALSE, TRUE, now(), 4),
('Beatriz Demo Ortiz',  '9000000000008', '1972-06-06', 'F', 'Zona 8, Huehuetenango, Huehuetenango', 15.315000, -91.454000, '5551-0008', TRUE,  NULL,                            'Obesidad, enfermedad cardiovascular', 'Aspirina 81 mg',       FALSE, TRUE, now(), 4),
('Diego Demo Castillo', '9000000000009', '1999-12-01', 'M', 'Zona 9, Huehuetenango, Huehuetenango', 15.330000, -91.482000, '5551-0009', FALSE, NULL,                            NULL,                               NULL,                      FALSE, TRUE, now(), 4),
('Rosa Demo Hernández', '9000000000010', '1988-04-25', 'F', 'Zona 10, Huehuetenango, Huehuetenango', 15.306000, -91.470000, '5551-0010', FALSE, 'Aspirina',                     NULL,                               NULL,                      TRUE,  TRUE, now(), 4),
('Elena Demo Morales',  '9000000000011', '1993-08-14', 'F', 'Aldea Chiantla, Huehuetenango',         15.354000, -91.458000, '5551-0011', FALSE, NULL,                            NULL,                               NULL,                      TRUE,  TRUE, now(), 4),
('Carmen Demo Juárez',  '9000000000012', '1980-10-09', 'F', 'Zona 1, Huehuetenango, Huehuetenango', 15.320000, -91.469000, '5551-0012', FALSE, NULL,                            NULL,                               NULL,                      TRUE,  TRUE, now(), 4);

-- ------------------------------------------------------------
-- 4) EMBARAZADAS CON IMC PREGESTACIONAL (cubren las 6 categorías OMS)
-- ------------------------------------------------------------
UPDATE paciente SET esta_embarazada=TRUE, imc_pregestacional=17.4, peso_habitual_kg=42.0,
       fur = CURRENT_DATE - (22*7), fpp = CURRENT_DATE - (22*7) + 280, semana_gestacion=22,
       fecha_registro_embarazo = now() - INTERVAL '2 days', usuario_registro_embarazo=4
 WHERE dpi='9000000000002';   -- bajo peso
UPDATE paciente SET esta_embarazada=TRUE, imc_pregestacional=22.4, peso_habitual_kg=54.0,
       fur = CURRENT_DATE - (10*7), fpp = CURRENT_DATE - (10*7) + 280, semana_gestacion=10,
       fecha_registro_embarazo = now() - INTERVAL '5 days', usuario_registro_embarazo=4
 WHERE dpi='9000000000003';   -- normal
UPDATE paciente SET esta_embarazada=TRUE, imc_pregestacional=27.6, peso_habitual_kg=68.0,
       fur = CURRENT_DATE - (8*7), fpp = CURRENT_DATE - (8*7) + 280, semana_gestacion=8,
       fecha_registro_embarazo = now() - INTERVAL '12 days', usuario_registro_embarazo=4
 WHERE dpi='9000000000005';   -- sobrepeso
UPDATE paciente SET esta_embarazada=TRUE, imc_pregestacional=32.1, peso_habitual_kg=79.0,
       fur = CURRENT_DATE - (30*7), fpp = CURRENT_DATE - (30*7) + 280, semana_gestacion=30,
       fecha_registro_embarazo = now() - INTERVAL '1 day', usuario_registro_embarazo=4
 WHERE dpi='9000000000010';   -- obesidad I
UPDATE paciente SET esta_embarazada=TRUE, imc_pregestacional=37.6, peso_habitual_kg=92.0,
       fur = CURRENT_DATE - (15*7), fpp = CURRENT_DATE - (15*7) + 280, semana_gestacion=15,
       fecha_registro_embarazo = now() - INTERVAL '20 days', usuario_registro_embarazo=4
 WHERE dpi='9000000000011';   -- obesidad II
UPDATE paciente SET esta_embarazada=TRUE, imc_pregestacional=42.0, peso_habitual_kg=104.0,
       fur = CURRENT_DATE - (34*7), fpp = CURRENT_DATE - (34*7) + 280, semana_gestacion=34,
       fecha_registro_embarazo = now() - INTERVAL '9 days', usuario_registro_embarazo=4
 WHERE dpi='9000000000012';   -- obesidad III

-- ------------------------------------------------------------
-- 5) ENFERMEDADES CRÓNICAS ASIGNADAS
-- ------------------------------------------------------------
INSERT INTO paciente_enfermedad_cronica (id_paciente, id_enfermedad_cronica, fecha_diagnostico, id_usuario_registro)
SELECT pa.id_paciente, x.id_enfermedad_cronica, CURRENT_DATE - INTERVAL '400 days', 3
FROM paciente pa
JOIN (VALUES
    ('9000000000001', 7),   -- Pedro  -> Hipertensión 40-59
    ('9000000000004', 4),   -- José   -> Diabetes 60+
    ('9000000000008', 15)   -- Beatriz-> Cardiovascular 40-59
) AS x(dpi, id_enfermedad_cronica) ON x.dpi = pa.dpi;

-- ------------------------------------------------------------
-- 6) VISITAS + PRECONSULTAS + CONSULTAS + RIESGO + RECETAS + DISPENSACIÓN
-- ------------------------------------------------------------
DO $$
DECLARE
    p RECORD;
    i INT;
    j INT;
    n INT;
    v_dias INT;
    v_id_visita INT;
    v_id_consulta INT;
    v_id_prescripcion INT;
    v_estado TEXT;
    v_motivo TEXT;
    v_diag TEXT;
    v_es_consulta BOOLEAN;
    v_es_reconsulta BOOLEAN;
    v_entregado BOOLEAN;
    v_talla NUMERIC;
    v_imc NUMERIC;
    v_peso_lb NUMERIC;
    v_temp NUMERIC;
    v_sys INT;
    v_dia INT;
    v_fc INT;
    v_fr INT;
    v_sat INT;
    v_alerta BOOLEAN;
    v_idx INT;
    v_med INT;
    v_lote INT;
    v_cant INT;
    v_disp INT;
    v_medicos INT[] := ARRAY[3,3,3,2,4];
    motivos TEXT[] := ARRAY['Fiebre y dolor de cabeza','Dolor abdominal','Tos y congestión nasal','Control de presión arterial','Diarrea','Dolor de garganta','Control prenatal','Dolor muscular','Mareos','Control de glucosa'];
    diagnosticos TEXT[] := ARRAY['Infección respiratoria aguda','Gastroenteritis aguda','Faringitis','Hipertensión arterial','Dengue clásico','Cefalea tensional','Diabetes mellitus tipo 2','Amigdalitis','Lumbalgia','Control prenatal normal','Anemia ferropénica',''];
    med_nombres TEXT[];
BEGIN
    SELECT array_agg(nombre_medicamento ORDER BY id_medicamento) INTO med_nombres
    FROM medicamento WHERE nombre_medicamento LIKE 'DEMO %';

    FOR p IN
        SELECT id_paciente, sexo,
               EXTRACT(YEAR FROM AGE(fecha_nacimiento))::INT AS edad
        FROM paciente WHERE dpi LIKE '9000%' ORDER BY id_paciente
    LOOP
        n := 3 + (p.id_paciente % 5);            -- 3..7 visitas por paciente
        FOR i IN 1..n LOOP
            v_dias := (i - 1) * 6 + (p.id_paciente % 4);
            v_estado := CASE WHEN v_dias <= 1 THEN 'en_triaje'
                             WHEN v_dias <= 3 THEN 'pendiente'
                             ELSE 'completado' END;
            v_motivo := motivos[1 + ((p.id_paciente + i) % array_length(motivos, 1))];

            INSERT INTO visita (id_paciente, motivo_consulta, estado, fecha_visita, id_usuario_registro)
            VALUES (p.id_paciente, v_motivo, v_estado, now() - (v_dias || ' days')::INTERVAL, 4)
            RETURNING id_visita INTO v_id_visita;

            v_talla := CASE WHEN p.edad < 12 THEN 1.30 + (p.id_paciente % 4) * 0.03
                            ELSE 1.55 + (p.id_paciente % 6) * 0.03 END;
            v_imc := CASE WHEN p.edad < 12 THEN 16 + ((p.id_paciente + i) % 5)
                          ELSE 20 + ((p.id_paciente + i) % 16) END;   -- 20..35
            v_peso_lb := ROUND((v_imc * v_talla * v_talla) * 2.2, 1);  -- peso en libras
            v_temp := ROUND((36.4 + ((p.id_paciente + i) % 4) * 0.6)::NUMERIC, 1);
            v_sys := 105 + ((p.id_paciente * 3 + i * 5) % 55);
            v_dia := 65 + ((p.id_paciente * 2 + i * 3) % 30);
            v_fc  := 62 + ((p.id_paciente + i * 2) % 45);
            v_fr  := 14 + ((p.id_paciente + i) % 8);
            v_sat := 94 + ((p.id_paciente + i) % 6);
            v_alerta := (v_temp >= 38.0 OR v_sys >= 140 OR v_dia >= 90 OR v_sat < 92);

            v_es_consulta := (i = 1);
            v_es_reconsulta := (i > 1);

            INSERT INTO preconsulta (
                id_visita, peso, talla, imc, temperatura, presion_sistolica, presion_diastolica,
                frecuencia_cardiaca, frecuencia_respiratoria, saturacion_oxigeno,
                sintomas, hallazgos, alerta_signos, tipo_visita, es_consulta, es_reconsulta,
                motivo_mapeado, fecha_hora_registro, id_usuario_registro)
            VALUES (
                v_id_visita, v_peso_lb, v_talla, ROUND((v_peso_lb / 2.2) / (v_talla * v_talla), 2),
                v_temp, v_sys, v_dia, v_fc, v_fr, v_sat,
                v_motivo,
                CASE WHEN v_alerta THEN 'Signos de alarma detectados en triaje.'
                     ELSE 'Paciente estable, signos dentro de parámetros.' END,
                v_alerta,
                CASE WHEN v_es_consulta AND NOT v_es_reconsulta THEN 'CONSULTA'
                     WHEN v_es_reconsulta AND NOT v_es_consulta THEN 'RECONSULTA'
                     ELSE 'AMBAS' END,
                v_es_consulta, v_es_reconsulta, v_motivo,
                now() - (v_dias || ' days')::INTERVAL, 4);

            -- Factores de riesgo (sobrepeso/obesidad o adulto mayor)
            IF v_imc >= 25 OR p.edad >= 60 THEN
                INSERT INTO factor_riesgo (id_visita, sobrepeso, sobrepeso_imc, obesidad, obesidad_imc,
                        circ_abdominal, circ_abdominal_cm, circ_abdominal_fecha,
                        riesgo_ecv_elevado, riesgo_ecv_observacion, id_usuario_registro)
                VALUES (v_id_visita,
                        v_imc >= 25 AND v_imc < 30,
                        CASE WHEN v_imc >= 25 AND v_imc < 30 THEN ROUND(v_imc, 2) END,
                        v_imc >= 30,
                        CASE WHEN v_imc >= 30 THEN ROUND(v_imc, 2) END,
                        v_imc >= 30,
                        CASE WHEN v_imc >= 30 THEN 96 + (p.id_paciente % 10) END,
                        CASE WHEN v_imc >= 30 THEN (now() - (v_dias || ' days')::INTERVAL)::DATE END,
                        (p.edad >= 60 OR v_imc >= 30),
                        CASE WHEN (p.edad >= 60 OR v_imc >= 30)
                             THEN 'Riesgo cardiovascular elevado, requiere seguimiento.'
                             ELSE 'Se vigila evolución.' END,
                        4);
            END IF;

            -- Consulta médica solo para visitas completadas
            IF v_estado = 'completado' THEN
                v_diag := diagnosticos[1 + ((p.id_paciente + i) % array_length(diagnosticos, 1))];
                v_entregado := v_dias >= 3;

                INSERT INTO consulta_medica (id_visita, diagnostico, indicaciones, observaciones,
                        fecha_hora_consulta, id_medico, version, tipo_version, entregado, fecha_entrega)
                VALUES (v_id_visita, v_diag,
                        'Reposo, hidratación y tratamiento indicado. Volver si persisten los síntomas.',
                        'Evolución favorable esperada.',
                        now() - (v_dias || ' days')::INTERVAL + INTERVAL '2 hours',
                        v_medicos[1 + ((p.id_paciente + i) % array_length(v_medicos, 1))],
                        1, 'original', v_entregado,
                        CASE WHEN v_entregado THEN now() - ((v_dias - 1) || ' days')::INTERVAL END)
                RETURNING id_consulta INTO v_id_consulta;

                IF v_diag <> '' THEN
                    FOR j IN 1..(1 + ((p.id_paciente + i) % 2)) LOOP
                        v_idx := 1 + ((p.id_paciente * 2 + i + j) % array_length(med_nombres, 1));
                        SELECT id_medicamento INTO v_med FROM medicamento WHERE nombre_medicamento = med_nombres[v_idx];
                        v_cant := 10 * (1 + ((p.id_paciente + i + j) % 3));

                        INSERT INTO prescripcion (id_consulta, id_medicamento, dosis, frecuencia, duracion_dias, cantidad_recetada, indicaciones_adicionales, fecha_hora)
                        VALUES (v_id_consulta, v_med, '1 unidad', 'Cada 8 horas', 5, v_cant, 'Tomar después de los alimentos',
                                now() - (v_dias || ' days')::INTERVAL + INTERVAL '3 hours')
                        RETURNING id_prescripcion INTO v_id_prescripcion;

                        IF v_entregado THEN
                            SELECT id_lote INTO v_lote FROM lote_medicamento
                            WHERE id_medicamento = v_med ORDER BY id_lote LIMIT 1;
                            v_disp := CASE WHEN (p.id_paciente + i) % 3 = 0 THEN GREATEST(v_cant / 2, 1) ELSE v_cant END;

                            INSERT INTO dispensacion (id_prescripcion, id_lote, cantidad_dispensada, id_usuario_dispensa, fecha_hora, observaciones)
                            VALUES (v_id_prescripcion, v_lote, v_disp, 4,
                                    now() - (v_dias || ' days')::INTERVAL + INTERVAL '4 hours', 'Entrega en farmacia');

                            IF v_lote IS NOT NULL THEN
                                UPDATE lote_medicamento
                                   SET cantidad_actual = GREATEST(cantidad_actual - v_disp, 0)
                                 WHERE id_lote = v_lote;

                                INSERT INTO movimiento_inventario (id_lote, tipo_movimiento, cantidad, motivo, id_usuario, fecha_hora)
                                VALUES (v_lote, 'salida', v_disp, 'Dispensación a paciente', 4,
                                        now() - (v_dias || ' days')::INTERVAL + INTERVAL '4 hours');
                            END IF;
                        END IF;
                    END LOOP;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 7) CORRECCIONES (funcionalidad "editar/corregir" con versionado)
-- ------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    v_new INT;
BEGIN
    FOR r IN
        SELECT c.id_consulta, c.id_visita, c.diagnostico, c.indicaciones, c.fecha_seguimiento, c.id_medico, c.version
        FROM consulta_medica c
        JOIN visita v ON c.id_visita = v.id_visita
        JOIN paciente pa ON v.id_paciente = pa.id_paciente
        WHERE pa.dpi LIKE '9000%'
          AND c.tipo_version = 'original'
          AND c.diagnostico IS NOT NULL AND c.diagnostico <> ''
          AND (v.id_visita % 4 = 0)
    LOOP
        INSERT INTO consulta_medica (id_visita, diagnostico, indicaciones, observaciones, fecha_seguimiento,
                id_medico, version, tipo_version, padre_version, corregido_por, fecha_corregido, motivo_correcion,
                entregado, fecha_entrega)
        VALUES (r.id_visita, r.diagnostico || ' (corregido)', r.indicaciones,
                'Diagnóstico ajustado tras nueva evaluación.', r.fecha_seguimiento, r.id_medico,
                r.version + 1, 'corregido', r.id_consulta, 3, now(),
                'Ajuste de diagnóstico tras revisión', TRUE, now())
        RETURNING id_consulta INTO v_new;

        INSERT INTO auditoria_correccion (id_visita, id_consulta_original, id_consulta_corregida, tabla, campo, valor_anterior, valor_nuevo, motivo, id_usuario, ip_equipo, fecha_hora)
        VALUES (r.id_visita, r.id_consulta, v_new, 'consulta_medica', 'diagnostico',
                r.diagnostico, r.diagnostico || ' (corregido)', 'Ajuste de diagnóstico tras revisión', 3, '127.0.0.1', now());
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 8) AVISOS DEL SISTEMA Y BITÁCORA
-- ------------------------------------------------------------
INSERT INTO aviso_sistema (tipo, titulo, descripcion, activo, fecha_inicio, fecha_fin, id_usuario)
VALUES
('info',     '[DEMO] Jornada de vacunación',   'Vacunación infantil en el centro de salud, sábado de 8:00 a 13:00.', TRUE,  now() - INTERVAL '1 day', now() + INTERVAL '10 days', 1),
('urgente',  '[DEMO] Campaña de dengue',       'Zona 3 y 4: eliminar criaderos y acudir ante fiebre persistente.',    TRUE,  now() - INTERVAL '3 days', now() + INTERVAL '20 days', 2),
('advertencia', '[DEMO] Control prenatal',     'Recordatorio: pacientes embarazadas deben asistir a control mensual.',  TRUE,  now(),                    NULL,                        3);

INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion, ip_equipo, fecha_hora)
VALUES
(4, 'CREAR',    'paciente',        'Registro de paciente durante el triaje',        '127.0.0.1', now() - INTERVAL '2 days'),
(4, 'CREAR',    'preconsulta',     'Toma de signos vitales',                        '127.0.0.1', now() - INTERVAL '2 days'),
(3, 'CORREGIR', 'consulta_medica', 'Corrección de diagnóstico',                     '127.0.0.1', now() - INTERVAL '1 day'),
(4, 'ENTREGAR', 'consulta_medica', 'Entrega de nota clínica al paciente',           '127.0.0.1', now() - INTERVAL '1 day'),
(1, 'CREAR',    'medicamento',     'Alta de medicamentos en el inventario',         '127.0.0.1', now() - INTERVAL '3 days'),
(4, 'SALIDA',   'inventario',      'Dispensación de medicamentos en farmacia',      '127.0.0.1', now() - INTERVAL '1 day');

COMMIT;

-- Resumen de carga
SELECT 'Pacientes demo'     AS concepto, COUNT(*) FROM paciente    WHERE dpi LIKE '9000%'
UNION ALL SELECT 'Visitas demo',            COUNT(*) FROM visita      v JOIN paciente p ON v.id_paciente=p.id_paciente WHERE p.dpi LIKE '9000%'
UNION ALL SELECT 'Consultas demo',          COUNT(*) FROM consulta_medica c JOIN visita v ON c.id_visita=v.id_visita JOIN paciente p ON v.id_paciente=p.id_paciente WHERE p.dpi LIKE '9000%'
UNION ALL SELECT 'Correcciones',            COUNT(*) FROM consulta_medica c JOIN visita v ON c.id_visita=v.id_visita JOIN paciente p ON v.id_paciente=p.id_paciente WHERE p.dpi LIKE '9000%' AND c.tipo_version='corregido'
UNION ALL SELECT 'Embarazadas',             COUNT(*) FROM paciente    WHERE dpi LIKE '9000%' AND esta_embarazada
UNION ALL SELECT 'Medicamentos demo',       COUNT(*) FROM medicamento WHERE nombre_medicamento LIKE 'DEMO %'
UNION ALL SELECT 'Dispensaciones',          COUNT(*) FROM dispensacion d JOIN prescripcion pr ON d.id_prescripcion=pr.id_prescripcion JOIN consulta_medica c ON pr.id_consulta=c.id_consulta JOIN visita v ON c.id_visita=v.id_visita JOIN paciente p ON v.id_paciente=p.id_paciente WHERE p.dpi LIKE '9000%';
