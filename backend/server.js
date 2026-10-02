const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Permite peticiones sin origen (curl, Postman), orígenes en la lista
        // configurada (CORS_ORIGINS) y cualquier origen local (localhost/127.0.0.1).
        const esLocal = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || esLocal) {
            return callback(null, true);
        }
        return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
}));

app.use(express.json());

const pool = require('./config/db');

// Migraciones idempotentes al arranque.
// schema.sql usa CREATE TABLE IF NOT EXISTS, así que si una tabla ya existía
// desde una versión anterior del schema, las columnas nuevas nunca se agregan.
// Estos ALTER TABLE ... IF NOT EXISTS sincronizan la base existente con el
// schema actual sin borrar datos. Al agregar columnas nuevas en el codigo,
// repetirlas aqui y en schema.sql.
async function aplicarMigraciones() {
    const migraciones = [
        `ALTER TABLE paciente ADD COLUMN IF NOT EXISTS direccion VARCHAR(250)`,
        `ALTER TABLE paciente ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`,
        `ALTER TABLE paciente ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`,
        `ALTER TABLE paciente ADD COLUMN IF NOT EXISTS telefono VARCHAR(15)`,
        // Caché persistente de geocodificación: evita repetir llamadas a
        // Nominatim en cada carga de estadísticas y sobrevive a reinicios.
        `CREATE TABLE IF NOT EXISTS geocodigo_cache (
            direccion TEXT PRIMARY KEY,
            lat DOUBLE PRECISION,
            lng DOUBLE PRECISION,
            lugar TEXT,
            fecha TIMESTAMP DEFAULT NOW()
        )`,
    ];
    for (const sql of migraciones) {
        try {
            await pool.query(sql);
        } catch (error) {
            console.error('Migración fallida:', error.message, '\nSQL:', sql);
        }
    }
}

// ============================================================
// AUTH
// ============================================================
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { rows } = await pool.query(
            `SELECT u.*, r.nombre_rol
             FROM usuario u
             INNER JOIN rol r ON u.id_rol = r.id_rol
             WHERE u.nombre_usuario = $1 AND u.activo = TRUE`,
            [username]
        );
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
        }
        const user = rows[0];

        // Valida contra contrasena_hash (bcrypt). Si la cuenta aún tiene el hash
        // placeholder de la semilla original, acepta la contraseña temporal y
        // la migra automáticamente a un hash real.
        const HASH_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
        const esHashValido = HASH_RE.test(user.contrasena_hash || '');
        let passOk = false;
        if (esHashValido) {
            passOk = await bcrypt.compare(password, user.contrasena_hash);
        } else {
            const legacy = {
                'DOC':        'Doctor1234',
                'Enfer':      'Enfer1234',
                'admin':      'Admin123!',
                'directora':  'Directora123!',
            };
            passOk = legacy[user.nombre_usuario] === password;
            if (passOk) {
                const nuevoHash = await bcrypt.hash(password, 10);
                await pool.query('UPDATE usuario SET contrasena_hash = $1 WHERE id_usuario = $2', [nuevoHash, user.id_usuario]);
            }
        }
        if (!passOk) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        await pool.query('UPDATE usuario SET ultimo_acceso = NOW() WHERE id_usuario = $1', [user.id_usuario]);

        await pool.query(
            `INSERT INTO bitacora (id_usuario, accion, descripcion, ip_equipo)
             VALUES ($1, 'LOGIN', $2, $3)`,
            [user.id_usuario, `Inicio de sesión: ${user.nombre_completo}`, req.ip]
        );

        res.json({
            message: 'Login exitoso',
            user: {
                id:       user.id_usuario,
                username: user.nombre_usuario,
                rol:      user.nombre_rol,
                nombre:   user.nombre_completo,
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ============================================================
// VISITAS / DASHBOARD
// ============================================================
app.get('/api/visitas/hoy', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
              v.id_visita,
              v.estado,
              v.fecha_visita,
              v.motivo_consulta,
              p.id_paciente,
              p.nombre_completo,
              p.dpi,
              DATE_PART('year', AGE(p.fecha_nacimiento))::INT AS edad,
              p.sexo,
              CONCAT(pr.presion_sistolica, '/', pr.presion_diastolica) AS presion,
              pr.peso,
              pr.temperatura
            FROM visita v
            INNER JOIN paciente p ON v.id_paciente = p.id_paciente
            LEFT JOIN preconsulta pr ON v.id_visita = pr.id_visita
            WHERE v.fecha_visita::DATE = CURRENT_DATE
            ORDER BY v.fecha_visita DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo visitas de hoy' });
    }
});

app.get('/api/visitas/estadisticas', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
              COUNT(DISTINCT v.id_visita)                                                               AS total_visitas_hoy,
              COUNT(DISTINCT v.id_visita) FILTER (WHERE v.estado = 'pendiente')                        AS pendientes,
              COUNT(DISTINCT v.id_visita) FILTER (WHERE v.estado = 'en_triaje')                        AS en_triaje,
              COUNT(DISTINCT v.id_visita) FILTER (WHERE v.estado = 'completado')                       AS completados,
              COUNT(DISTINCT v.id_visita) FILTER (WHERE v.fecha_visita >= NOW() - INTERVAL '1 hour')   AS ultima_hora
            FROM visita v
            WHERE v.fecha_visita::DATE = CURRENT_DATE
        `);
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
});

// ============================================================
// PACIENTES
// ============================================================
app.get('/api/patients', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
              id_paciente,
              nombre_completo,
              dpi,
              DATE_PART('year', AGE(fecha_nacimiento))::INT AS edad,
              sexo,
              es_cronico,
              fecha_registro
            FROM paciente
            WHERE activo = TRUE
            ORDER BY fecha_registro DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo pacientes' });
    }
});

app.post('/api/patients', async (req, res) => {
    const { nombre_completo, dpi, fecha_nacimiento, sexo, telefono, direccion, lat, lng, id_usuario_registro } = req.body;
    if (!nombre_completo || !fecha_nacimiento || !sexo) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: nombre_completo, fecha_nacimiento y sexo' });
    }
    try {
        const { rows } = await pool.query(
            `INSERT INTO paciente (nombre_completo, dpi, fecha_nacimiento, sexo, telefono, direccion, lat, lng, id_usuario_registro)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id_paciente`,
            [nombre_completo, dpi || null, fecha_nacimiento, sexo, telefono || null, direccion || null, lat ?? null, lng ?? null, id_usuario_registro || 1]
        );
        await pool.query(
            `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
             VALUES ($1, 'CREAR_PACIENTE', 'paciente', $2, $3)`,
            [id_usuario_registro || 1, rows[0].id_paciente, `Registro de nuevo paciente: ${nombre_completo}`]
        );
        res.status(201).json({ id: rows[0].id_paciente, message: 'Paciente registrado correctamente' });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un paciente con ese DPI' });
        }
        res.status(500).json({ error: 'Error al registrar paciente' });
    }
});

// Elimina un expediente y todo su historial asociado (visitas, preconsultas,
// consultas, prescripciones y dispensaciones) en una sola transacción.
app.delete('/api/patients/:id', async (req, res) => {
    const { id } = req.params;
    const id_usuario_editor = req.body?.id_usuario_editor || 1;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            'SELECT nombre_completo FROM paciente WHERE id_paciente = $1', [id]
        );
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Paciente no encontrado' });
        }
        await client.query(`
            DELETE FROM dispensacion
            WHERE id_prescripcion IN (
                SELECT p.id_prescripcion FROM prescripcion p
                INNER JOIN consulta_medica cm ON p.id_consulta = cm.id_consulta
                INNER JOIN visita v ON cm.id_visita = v.id_visita
                WHERE v.id_paciente = $1
            )`, [id]);
        await client.query(`
            DELETE FROM prescripcion
            WHERE id_consulta IN (
                SELECT cm.id_consulta FROM consulta_medica cm
                INNER JOIN visita v ON cm.id_visita = v.id_visita
                WHERE v.id_paciente = $1
            )`, [id]);
        await client.query(`
            DELETE FROM consulta_medica
            WHERE id_visita IN (SELECT id_visita FROM visita WHERE id_paciente = $1)`, [id]);
        await client.query(`
            DELETE FROM preconsulta
            WHERE id_visita IN (SELECT id_visita FROM visita WHERE id_paciente = $1)`, [id]);
        await client.query('DELETE FROM visita WHERE id_paciente = $1', [id]);
        await client.query('DELETE FROM paciente WHERE id_paciente = $1', [id]);
        await client.query(
            `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
             VALUES ($1, 'ELIMINAR_PACIENTE', 'paciente', $2, $3)`,
            [id_usuario_editor, id, `Expediente eliminado definitivamente: ${rows[0].nombre_completo}`]
        );
        await client.query('COMMIT');
        res.json({ message: 'Expediente eliminado correctamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar expediente' });
    } finally {
        client.release();
    }
});

// ============================================================
// EXPEDIENTE DE PACIENTE
// ============================================================
app.get('/api/expediente/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: pRows } = await pool.query(
            `SELECT *, DATE_PART('year', AGE(fecha_nacimiento))::INT AS edad
             FROM paciente WHERE id_paciente = $1`, [id]
        );
        if (pRows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });

        const { rows: visitas } = await pool.query(`
            SELECT v.*,
                   pr.presion_sistolica, pr.presion_diastolica, pr.frecuencia_cardiaca,
                   pr.temperatura, pr.peso, pr.talla, pr.imc, pr.saturacion_oxigeno,
                   pr.alerta_signos, pr.detalle_alerta,
                   cm.diagnostico, cm.indicaciones, cm.observaciones, cm.fecha_seguimiento,
                   u.nombre_completo AS nombre_medico
            FROM visita v
            LEFT JOIN preconsulta pr    ON v.id_visita = pr.id_visita
            LEFT JOIN consulta_medica cm ON v.id_visita = cm.id_visita
            LEFT JOIN usuario u          ON cm.id_medico = u.id_usuario
            WHERE v.id_paciente = $1
            ORDER BY v.fecha_visita DESC
        `, [id]);

        // Recetas (prescripciones + medicamentos) por cada visita
        const { rows: recetas } = await pool.query(
            `SELECT v.id_visita, p.id_medicamento, m.nombre_medicamento AS nombre,
                    p.cantidad_recetada AS cantidad, p.dosis
             FROM visita v
             INNER JOIN consulta_medica cm ON v.id_visita = cm.id_visita
             INNER JOIN prescripcion p ON p.id_consulta = cm.id_consulta
             INNER JOIN medicamento m ON p.id_medicamento = m.id_medicamento
             WHERE v.id_paciente = $1
             ORDER BY v.fecha_visita DESC, p.id_prescripcion`,
            [id]
        );
        const recetasPorVisita = {};
        for (const r of recetas) {
            (recetasPorVisita[r.id_visita] = recetasPorVisita[r.id_visita] || []).push(r);
        }
        for (const v of visitas) {
            v.recetas = recetasPorVisita[v.id_visita] || [];
        }

        res.json({ paciente: pRows[0], visitas });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo expediente' });
    }
});

// ============================================================
// USUARIOS (Control de acceso)
// ============================================================
app.get('/api/usuarios', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT u.id_usuario, u.nombre_completo, u.nombre_usuario,
                   u.id_rol, u.activo, u.fecha_creacion, u.ultimo_acceso, r.nombre_rol
            FROM usuario u
            INNER JOIN rol r ON u.id_rol = r.id_rol
            WHERE u.activo = TRUE
            ORDER BY u.id_usuario
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
});

app.post('/api/usuarios', async (req, res) => {
    const { nombre_completo, nombre_usuario, contrasena, id_rol } = req.body;
    if (!nombre_completo || !nombre_usuario || !contrasena || !id_rol) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    try {
        const hash = await bcrypt.hash(contrasena, 10);
        const { rows } = await pool.query(
            `INSERT INTO usuario (nombre_completo, nombre_usuario, contrasena_hash, id_rol)
             VALUES ($1, $2, $3, $4) RETURNING id_usuario`,
            [nombre_completo, nombre_usuario, hash, id_rol]
        );
        res.status(201).json({ id: rows[0].id_usuario, message: 'Usuario creado correctamente' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'El nombre de usuario ya existe' });
        }
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: target } = await pool.query(
            'SELECT nombre_usuario FROM usuario WHERE id_usuario = $1', [id]
        );
        if (target.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (target[0].nombre_usuario === 'admin') {
            return res.status(403).json({ error: 'La cuenta administradora principal no puede desactivarse. Es la fuente de acceso del sistema.' });
        }
        await pool.query('UPDATE usuario SET activo = FALSE WHERE id_usuario = $1', [id]);
        res.json({ message: 'Usuario desactivado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al desactivar usuario' });
    }
});

app.put('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre_completo, nombre_usuario, id_rol, contrasena } = req.body;
    if (!nombre_completo || !nombre_usuario || !id_rol) {
        return res.status(400).json({ error: 'Nombre, usuario y rol son requeridos' });
    }
    try {
        let query = `UPDATE usuario SET nombre_completo = $1, nombre_usuario = $2, id_rol = $3`;
        const params = [nombre_completo, nombre_usuario, id_rol];
        // La cuenta administradora principal (admin) es la fuente del sistema:
        // su contraseña no puede cambiarse desde este módulo.
        if (contrasena && contrasena.trim()) {
            const { rows: target } = await pool.query(
                'SELECT nombre_usuario FROM usuario WHERE id_usuario = $1', [id]
            );
            if (target.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
            if (target[0].nombre_usuario === 'admin') {
                return res.status(403).json({ error: 'La contraseña de la cuenta administradora principal no puede modificarse. Es la fuente de acceso del sistema.' });
            }
            const hash = await bcrypt.hash(contrasena, 10);
            query += `, contrasena_hash = $4`;
            params.push(hash);
        }
        query += ` WHERE id_usuario = $${params.length + 1} RETURNING id_usuario`;
        params.push(id);
        const { rows } = await pool.query(query, params);
        if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        await pool.query(
            `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
             VALUES ($1, 'ACTUALIZAR_USUARIO', 'usuario', $2, $3)`,
            [req.body.id_usuario_editor || 1, id, `Usuario actualizado: ${nombre_completo}`]
        );
        res.json({ message: 'Usuario actualizado correctamente' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'El nombre de usuario ya existe' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// ============================================================
// AVISOS DEL SISTEMA
// ============================================================
app.get('/api/avisos', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT * FROM aviso_sistema
            WHERE activo = TRUE AND (fecha_fin IS NULL OR fecha_fin > NOW())
            ORDER BY fecha_inicio DESC LIMIT 10
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo avisos' });
    }
});

// ============================================================
// ROLES
// ============================================================
app.get('/api/roles', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM rol ORDER BY id_rol');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo roles' });
    }
});

// ============================================================
// VISITAS - CREAR
// ============================================================
app.post('/api/visitas', async (req, res) => {
    const { id_paciente, motivo_consulta, id_usuario_registro } = req.body;
    if (!id_paciente || !id_usuario_registro) {
        return res.status(400).json({ error: 'Paciente y usuario son requeridos' });
    }
    try {
        const { rows } = await pool.query(
            `INSERT INTO visita (id_paciente, motivo_consulta, id_usuario_registro, estado)
             VALUES ($1, $2, $3, 'pendiente') RETURNING *`,
            [id_paciente, motivo_consulta || null, id_usuario_registro]
        );
        const visita = rows[0];
        await pool.query(
            `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
             VALUES ($1, 'CREAR_VISITA', 'visita', $2, $3)`,
            [id_usuario_registro, visita.id_visita, `Nueva visita para paciente ID ${id_paciente}`]
        );
        res.status(201).json(visita);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear visita' });
    }
});

app.get('/api/visitas/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
              v.*,
              p.nombre_completo,
              p.dpi,
              DATE_PART('year', AGE(p.fecha_nacimiento))::INT AS edad,
              p.sexo
            FROM visita v
            INNER JOIN paciente p ON v.id_paciente = p.id_paciente
            WHERE v.id_visita = $1
        `, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Visita no encontrada' });
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo visita' });
    }
});

// ============================================================
// PRECONSULTA - REGISTRAR SIGNOS VITALES
// ============================================================
app.post('/api/preconsulta', async (req, res) => {
    const {
        id_visita,
        presion_arterial,
        peso,
        talla,
        id_usuario_registro
    } = req.body;

    if (!id_visita || !id_usuario_registro) {
        return res.status(400).json({ error: 'Visita y usuario son requeridos' });
    }

    let presion_sistolica = null;
    let presion_diastolica = null;
    if (typeof presion_arterial === 'string' && presion_arterial.trim()) {
        const partes = presion_arterial.trim().split('/').map(p => parseFloat(p));
        if (partes.length === 2 && !isNaN(partes[0]) && !isNaN(partes[1])) {
            presion_sistolica = partes[0];
            presion_diastolica = partes[1];
        } else if (partes.length === 1 && !isNaN(partes[0])) {
            presion_sistolica = partes[0];
        }
    }

    const imc = peso && talla ? ((peso * 0.453592) / (talla * talla)).toFixed(2) : null;

    const sistolicaFuera = presion_sistolica ? (presion_sistolica > 140 || presion_sistolica < 90) : false;
    const diastolicaFuera = presion_diastolica ? (presion_diastolica > 90 || presion_diastolica < 60) : false;
    const alerta_signos = sistolicaFuera || diastolicaFuera;

    let detalle_alerta = [];
    if (presion_sistolica && (presion_sistolica > 140 || presion_sistolica < 90)) detalle_alerta.push(`Presión sistólica: ${presion_sistolica}`);
    if (presion_diastolica && (presion_diastolica > 90 || presion_diastolica < 60)) detalle_alerta.push(`Presión diastólica: ${presion_diastolica}`);

    try {
        await pool.query('BEGIN');

        const { rows } = await pool.query(
            `INSERT INTO preconsulta (
                id_visita, presion_sistolica, presion_diastolica,
                frecuencia_cardiaca, temperatura, frecuencia_respiratoria, saturacion_oxigeno,
                peso, talla, imc, alerta_signos, detalle_alerta, id_usuario_registro
             ) VALUES ($1,$2,$3,NULL,NULL,NULL,NULL,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (id_visita) DO UPDATE SET
                presion_sistolica = EXCLUDED.presion_sistolica,
                presion_diastolica = EXCLUDED.presion_diastolica,
                frecuencia_cardiaca = NULL,
                temperatura = NULL,
                frecuencia_respiratoria = NULL,
                saturacion_oxigeno = NULL,
                peso = EXCLUDED.peso,
                talla = EXCLUDED.talla,
                imc = EXCLUDED.imc,
                alerta_signos = EXCLUDED.alerta_signos,
                detalle_alerta = EXCLUDED.detalle_alerta,
                id_usuario_registro = EXCLUDED.id_usuario_registro,
                fecha_hora_registro = NOW()
             RETURNING *`,
            [
                id_visita,
                presion_sistolica,
                presion_diastolica,
                peso || null,
                talla || null,
                imc,
                alerta_signos,
                detalle_alerta.join('; ') || null,
                id_usuario_registro
            ]
        );

        await pool.query(
            `UPDATE visita SET estado = 'en_triaje' WHERE id_visita = $1`,
            [id_visita]
        );

        await pool.query(
            `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
             VALUES ($1, 'REGISTRAR_PRECONSULTA', 'preconsulta', $2, $3)`,
            [id_usuario_registro, id_visita, `Signos vitales registrados${alerta_signos ? ' - ALERTA: ' + detalle_alerta.join(', ') : ''}`]
        );

        await pool.query('COMMIT');
        res.status(201).json({ ...rows[0], alerta_signos, detalle_alerta: detalle_alerta.join('; ') });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Error al registrar preconsulta' });
    }
});

// ============================================================
// CONSULTA MÉDICA - REGISTRAR DIAGNÓSTICO
// ============================================================
app.post('/api/consulta_medica', async (req, res) => {
    const { id_visita, diagnostico, indicaciones, observaciones, fecha_seguimiento, id_medico, recetas } = req.body;
    if (!id_visita || !id_medico) {
        return res.status(400).json({ error: 'Visita y médico son requeridos' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `INSERT INTO consulta_medica (id_visita, diagnostico, indicaciones, observaciones, fecha_seguimiento, id_medico)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id_visita) DO UPDATE SET
                diagnostico = EXCLUDED.diagnostico,
                indicaciones = EXCLUDED.indicaciones,
                observaciones = EXCLUDED.observaciones,
                fecha_seguimiento = EXCLUDED.fecha_seguimiento,
                id_medico = EXCLUDED.id_medico,
                fecha_hora_consulta = NOW()
             RETURNING *`,
            [id_visita, diagnostico || null, indicaciones || null, observaciones || null, fecha_seguimiento || null, id_medico]
        );
        const id_consulta = rows[0].id_consulta;

        // Elimina prescripciones/dispensaciones previas de esta consulta para
        // que al re-enviar no se dupliquen (reemplazo completo).
        const prevs = await client.query(
            `SELECT id_prescripcion FROM prescripcion WHERE id_consulta = $1`, [id_consulta]
        );
        for (const p of prevs.rows) {
            await client.query('DELETE FROM dispensacion WHERE id_prescripcion = $1', [p.id_prescripcion]);
        }
        await client.query('DELETE FROM prescripcion WHERE id_consulta = $1', [id_consulta]);

        const recetasArr = Array.isArray(recetas) ? recetas : [];
        for (const r of recetasArr) {
            const idMed = r.id_medicamento;
            const qty = parseInt(r.cantidad, 10);
            if (!idMed || !qty || qty <= 0) continue;

            // Stock disponible total (sin lotes vencidos)
            const stockRes = await client.query(
                `SELECT COALESCE(SUM(l.cantidad_actual) FILTER (
                    WHERE l.cantidad_actual > 0 AND l.fecha_vencimiento > CURRENT_DATE), 0)::INT AS disponible
                 FROM lote_medicamento l
                 WHERE l.id_medicamento = $1`,
                [idMed]
            );
            const disponible = stockRes.rows[0].disponible;
            if (disponible <= 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    error: `No hay stock disponible del medicamento. Revise el inventario.`
                });
            }
            const aDispensar = Math.min(qty, disponible);

            const presc = await client.query(
                `INSERT INTO prescripcion (id_consulta, id_medicamento, cantidad_recetada, dosis, frecuencia, duracion_dias)
                 VALUES ($1, $2, $3, $4, NULL, NULL)
                 RETURNING id_prescripcion`,
                [id_consulta, idMed, aDispensar, r.dosis || null]
            );
            const id_prescripcion = presc.rows[0].id_prescripcion;

            // Descuento FIFO por lote (primero el que vence antes, sin vencidos)
            const lotes = await client.query(
                `SELECT id_lote, cantidad_actual
                 FROM lote_medicamento
                 WHERE id_medicamento = $1 AND cantidad_actual > 0 AND fecha_vencimiento > CURRENT_DATE
                 ORDER BY fecha_vencimiento ASC, id_lote ASC`,
                [idMed]
            );

            let restante = aDispensar;
            for (const lote of lotes.rows) {
                if (restante <= 0) break;
                const tomado = Math.min(lote.cantidad_actual, restante);
                await client.query(
                    `UPDATE lote_medicamento SET cantidad_actual = cantidad_actual - $1 WHERE id_lote = $2`,
                    [tomado, lote.id_lote]
                );
                await client.query(
                    `INSERT INTO dispensacion (id_prescripcion, id_lote, cantidad_dispensada, id_usuario_dispensa)
                     VALUES ($1, $2, $3, $4)`,
                    [id_prescripcion, lote.id_lote, tomado, id_medico]
                );
                await client.query(
                    `INSERT INTO movimiento_inventario (id_lote, tipo_movimiento, cantidad, motivo, id_usuario)
                     VALUES ($1, 'salida', $2, $3, $4)`,
                    [lote.id_lote, tomado, 'Dispensación en consulta médica', id_medico]
                );
                restante -= tomado;
            }
        }

        await client.query(
            `UPDATE visita SET estado = 'completado' WHERE id_visita = $1`,
            [id_visita]
        );

        await client.query(
            `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
             VALUES ($1, 'REGISTRAR_CONSULTA', 'consulta_medica', $2, $3)`,
            [id_medico, id_visita, `Diagnóstico: ${(diagnostico || 'N/A').substring(0, 100)}`]
        );

        await client.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Error al registrar consulta médica' });
    } finally {
        client.release();
    }
});

// ============================================================
// OBTENER PRECONSULTA DE UNA VISITA
// ============================================================
app.get('/api/preconsulta/:id_visita', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM preconsulta WHERE id_visita = $1`,
            [req.params.id_visita]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Preconsulta no encontrada' });
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo preconsulta' });
    }
});

// ============================================================
// OBTENER CONSULTA MÉDICA DE UNA VISITA
// ============================================================
app.get('/api/consulta_medica/:id_visita', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT cm.*, u.nombre_completo AS nombre_medico
             FROM consulta_medica cm
             LEFT JOIN usuario u ON cm.id_medico = u.id_usuario
             WHERE cm.id_visita = $1`,
            [req.params.id_visita]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Consulta no encontrada' });
        const con = rows[0];
        const recetas = await pool.query(
            `SELECT p.id_medicamento, m.nombre_medicamento AS nombre, p.cantidad_recetada AS cantidad, p.dosis
             FROM prescripcion p
             INNER JOIN medicamento m ON p.id_medicamento = m.id_medicamento
             WHERE p.id_consulta = $1`,
            [con.id_consulta]
        );
        con.recetas = recetas.rows;
        res.json(con);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo consulta' });
    }
});

// ============================================================
// INVENTARIO DE MEDICINA
// ============================================================

// ---- CATEGORÍAS DE MEDICAMENTOS ----
app.get('/api/categorias', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM categoria_medicamento ORDER BY nombre_categoria'
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo categorías' });
    }
});

app.post('/api/categorias', async (req, res) => {
    const { nombre_categoria, descripcion } = req.body;
    if (!nombre_categoria) {
        return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
    }
    try {
        const { rows } = await pool.query(
            `INSERT INTO categoria_medicamento (nombre_categoria, descripcion)
             VALUES ($1, $2) RETURNING *`,
            [nombre_categoria, descripcion || null]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Esa categoría ya existe' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al crear categoría' });
    }
});

// ---- MEDICAMENTOS (catálogo + stock) ----
app.get('/api/medicamentos', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
              m.id_medicamento,
              m.nombre_medicamento,
              m.nombre_generico,
              m.forma_farmaceutica,
              m.concentracion,
              m.unidad_medida,
              m.stock_minimo,
              m.requiere_receta,
              m.fecha_creacion,
              c.id_categoria,
              c.nombre_categoria,
              COALESCE(SUM(l.cantidad_actual), 0)::INT AS stock_total,
              COALESCE(MIN(l.fecha_vencimiento)
                FILTER (WHERE l.cantidad_actual > 0), NULL) AS proximo_vencimiento,
              COALESCE(SUM(l.cantidad_actual)
                FILTER (WHERE l.cantidad_actual > 0
                        AND l.fecha_vencimiento <= CURRENT_DATE + INTERVAL '90 days'), 0)::INT AS stock_por_vencer
            FROM medicamento m
            LEFT JOIN categoria_medicamento c ON m.id_categoria = c.id_categoria
            LEFT JOIN lote_medicamento l ON l.id_medicamento = m.id_medicamento
            WHERE m.activo = TRUE
            GROUP BY m.id_medicamento, c.id_categoria, c.nombre_categoria
            ORDER BY m.nombre_medicamento
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo medicamentos' });
    }
});

app.post('/api/medicamentos', async (req, res) => {
    const {
        nombre_medicamento, nombre_generico, id_categoria, forma_farmaceutica,
        concentracion, unidad_medida, stock_minimo, requiere_receta, id_usuario_registro
    } = req.body;
    if (!nombre_medicamento || !unidad_medida) {
        return res.status(400).json({ error: 'El nombre y la unidad de medida son obligatorios' });
    }
    try {
        const { rows } = await pool.query(
            `INSERT INTO medicamento (
                nombre_medicamento, nombre_generico, id_categoria, forma_farmaceutica,
                concentracion, unidad_medida, stock_minimo, requiere_receta
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_medicamento`,
            [
                nombre_medicamento,
                nombre_generico || null,
                id_categoria || null,
                forma_farmaceutica || null,
                concentracion || null,
                unidad_medida,
                stock_minimo ?? 0,
                requiere_receta ?? true
            ]
        );
        await pool.query(
            `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
             VALUES ($1, 'CREAR_MEDICAMENTO', 'medicamento', $2, $3)`,
            [id_usuario_registro || 1, rows[0].id_medicamento, `Nuevo medicamento: ${nombre_medicamento}`]
        );
        res.status(201).json({ id: rows[0].id_medicamento, message: 'Medicamento registrado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar medicamento' });
    }
});

app.put('/api/medicamentos/:id', async (req, res) => {
    const { id } = req.params;
    const {
        nombre_medicamento, nombre_generico, id_categoria, forma_farmaceutica,
        concentracion, unidad_medida, stock_minimo, requiere_receta, id_usuario_editor
    } = req.body;
    if (!nombre_medicamento || !unidad_medida) {
        return res.status(400).json({ error: 'El nombre y la unidad de medida son obligatorios' });
    }
    try {
        const { rows } = await pool.query(
            `UPDATE medicamento SET
                nombre_medicamento = $1,
                nombre_generico = $2,
                id_categoria = $3,
                forma_farmaceutica = $4,
                concentracion = $5,
                unidad_medida = $6,
                stock_minimo = $7,
                requiere_receta = $8
             WHERE id_medicamento = $9 RETURNING id_medicamento`,
            [
                nombre_medicamento,
                nombre_generico || null,
                id_categoria || null,
                forma_farmaceutica || null,
                concentracion || null,
                unidad_medida,
                stock_minimo ?? 0,
                requiere_receta ?? true,
                id
            ]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Medicamento no encontrado' });
        }
        await pool.query(
            `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
             VALUES ($1, 'ACTUALIZAR_MEDICAMENTO', 'medicamento', $2, $3)`,
            [id_usuario_editor || 1, id, `Medicamento actualizado: ${nombre_medicamento}`]
        );
        res.json({ message: 'Medicamento actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar medicamento' });
    }
});

// Elimina (desactiva) un medicamento; los lotes e históricos se conservan.
app.delete('/api/medicamentos/:id', async (req, res) => {
    const { id } = req.params;
    const id_usuario_editor = req.body?.id_usuario_editor || 1;
    try {
        const { rows } = await pool.query(
            'SELECT nombre_medicamento FROM medicamento WHERE id_medicamento = $1 AND activo = TRUE', [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Medicamento no encontrado' });
        }
        await pool.query('UPDATE medicamento SET activo = FALSE WHERE id_medicamento = $1', [id]);
        await pool.query(
            `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
             VALUES ($1, 'ELIMINAR_MEDICAMENTO', 'medicamento', $2, $3)`,
            [id_usuario_editor, id, `Medicamento eliminado: ${rows[0].nombre_medicamento}`]
        );
        res.json({ message: 'Medicamento eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar medicamento' });
    }
});

// ---- LOTES (entradas de inventario) ----
app.get('/api/lotes', async (req, res) => {
    const { id_medicamento } = req.query;
    try {
        const query = `
            SELECT
              l.*,
              m.nombre_medicamento,
              m.unidad_medida
            FROM lote_medicamento l
            INNER JOIN medicamento m ON l.id_medicamento = m.id_medicamento
            ${id_medicamento ? 'WHERE l.id_medicamento = $1' : ''}
            ORDER BY l.fecha_vencimiento ASC
        `;
        const { rows } = await pool.query(query, id_medicamento ? [id_medicamento] : []);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo lotes' });
    }
});

// Elimina un lote (solo si no tiene unidades dispensadas a pacientes).
app.delete('/api/lotes/:id', async (req, res) => {
    const { id } = req.params;
    const id_usuario_editor = req.body?.id_usuario_editor || 1;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT l.numero_lote, m.nombre_medicamento
             FROM lote_medicamento l
             INNER JOIN medicamento m ON l.id_medicamento = m.id_medicamento
             WHERE l.id_lote = $1`, [id]
        );
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Lote no encontrado' });
        }
        const disp = await client.query(
            'SELECT COUNT(*)::INT AS n FROM dispensacion WHERE id_lote = $1', [id]
        );
        if (disp.rows[0].n > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'No se puede eliminar: el lote ya tiene unidades dispensadas a pacientes' });
        }
        await client.query('DELETE FROM movimiento_inventario WHERE id_lote = $1', [id]);
        await client.query('DELETE FROM lote_medicamento WHERE id_lote = $1', [id]);
        await client.query(
            `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
             VALUES ($1, 'ELIMINAR_LOTE', 'lote_medicamento', $2, $3)`,
            [id_usuario_editor, id, `Lote ${rows[0].numero_lote} de ${rows[0].nombre_medicamento} eliminado`]
        );
        await client.query('COMMIT');
        res.json({ message: 'Lote eliminado correctamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar lote' });
    } finally {
        client.release();
    }
});

app.post('/api/lotes', async (req, res) => {
    const client = await pool.connect();
    const {
        id_medicamento, numero_lote, fecha_fabricacion, fecha_vencimiento,
        cantidad, precio_compra_unitario, motivo, id_usuario_registro
    } = req.body;
    if (!id_medicamento || !numero_lote || !fecha_vencimiento || !cantidad) {
        return res.status(400).json({ error: 'Medicamento, número de lote, vencimiento y cantidad son obligatorios' });
    }
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `INSERT INTO lote_medicamento (
                id_medicamento, numero_lote, fecha_fabricacion, fecha_vencimiento,
                cantidad_inicial, cantidad_actual, precio_compra_unitario, id_usuario_registro
             ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7) RETURNING *`,
            [
                id_medicamento,
                numero_lote,
                fecha_fabricacion || null,
                fecha_vencimiento,
                cantidad,
                precio_compra_unitario || null,
                id_usuario_registro || null
            ]
        );
        await client.query(
            `INSERT INTO movimiento_inventario (id_lote, tipo_movimiento, cantidad, motivo, id_usuario)
             VALUES ($1, 'entrada', $2, $3, $4)`,
            [rows[0].id_lote, cantidad, motivo || 'compra', id_usuario_registro || null]
        );
        await client.query(
            `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
             VALUES ($1, 'INGRESAR_LOTE', 'lote_medicamento', $2, $3)`,
            [id_usuario_registro || 1, rows[0].id_lote, `Entrada de ${cantidad} unidades del lote ${numero_lote}`]
        );
        await client.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ese número de lote ya está registrado para este medicamento' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al ingresar lote' });
    } finally {
        client.release();
    }
});

// ---- KARDEX / MOVIMIENTOS DE INVENTARIO ----
app.get('/api/inventario/movimientos', async (req, res) => {
    const { limit = 50 } = req.query;
    try {
        const { rows } = await pool.query(`
            SELECT
              mi.*,
              m.nombre_medicamento,
              l.numero_lote,
              u.nombre_completo AS nombre_usuario
            FROM movimiento_inventario mi
            INNER JOIN lote_medicamento l ON mi.id_lote = l.id_lote
            INNER JOIN medicamento m ON l.id_medicamento = m.id_medicamento
            LEFT JOIN usuario u ON mi.id_usuario = u.id_usuario
            ORDER BY mi.fecha_hora DESC
            LIMIT $1
        `, [parseInt(limit) || 50]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo movimientos de inventario' });
    }
});

// ---- RESUMEN DE INVENTARIO (para tarjetas de alerta) ----
app.get('/api/inventario/resumen', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            WITH resumen AS (
              SELECT
                m.id_medicamento,
                m.stock_minimo,
                COALESCE(SUM(l.cantidad_actual) FILTER (WHERE l.cantidad_actual > 0), 0)::INT AS stock_total,
                COALESCE(SUM(l.cantidad_actual) FILTER (
                  WHERE l.cantidad_actual > 0
                    AND l.fecha_vencimiento <= CURRENT_DATE + INTERVAL '90 days'
                ), 0)::INT AS stock_por_vencer
              FROM medicamento m
              LEFT JOIN lote_medicamento l ON l.id_medicamento = m.id_medicamento
              WHERE m.activo = TRUE
              GROUP BY m.id_medicamento
            )
            SELECT
              COUNT(*)::INT AS total_medicamentos,
              COALESCE(SUM(stock_total), 0)::INT AS stock_total_unidades,
              COUNT(*) FILTER (WHERE stock_por_vencer > 0)::INT AS medicamentos_por_vencer,
              COUNT(*) FILTER (WHERE stock_total <= stock_minimo)::INT AS medicamentos_stock_bajo
            FROM resumen
        `);
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo resumen de inventario' });
    }
});

// ============================================================
// ESTADÍSTICAS Y REPORTES
// ============================================================

// Rango de fechas por defecto: últimos 30 días
const fechaLocalISO = (d) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
};

const parseRango = (req) => {
    const hoy = new Date();
    const hace30 = new Date();
    hace30.setDate(hoy.getDate() - 29);
    const desde = req.query.desde || fechaLocalISO(hace30);
    const hasta = req.query.hasta || fechaLocalISO(hoy);
    return { desde, hasta };
};

// Visitas por día + resumen del período
app.get('/api/estadisticas/visitas', async (req, res) => {
    const { desde, hasta } = parseRango(req);
    try {
        const { rows: diario } = await pool.query(
            `SELECT
               TO_CHAR(serie.dia::DATE, 'YYYY-MM-DD') AS fecha,
               COUNT(v.id_visita)::INT AS total,
               COUNT(v.id_visita) FILTER (WHERE v.estado = 'pendiente')::INT AS pendientes,
               COUNT(v.id_visita) FILTER (WHERE v.estado = 'en_triaje')::INT AS en_triaje,
               COUNT(v.id_visita) FILTER (WHERE v.estado = 'completado')::INT AS completadas
             FROM generate_series($1::DATE, $2::DATE, '1 day') AS serie(dia)
             LEFT JOIN visita v ON v.fecha_visita::DATE = serie.dia::DATE
             GROUP BY serie.dia::DATE
             ORDER BY serie.dia::DATE ASC`,
            [desde, hasta]
        );
        const { rows: resumen } = await pool.query(
            `SELECT
               COUNT(*)::INT AS total_visitas,
               COUNT(DISTINCT v.id_paciente)::INT AS pacientes_unicos,
               COUNT(*) FILTER (WHERE v.estado = 'completado')::INT AS consultas_completadas,
               COUNT(*) FILTER (WHERE pr.alerta_signos = TRUE)::INT AS con_alertas
             FROM visita v
             LEFT JOIN preconsulta pr ON v.id_visita = pr.id_visita
             WHERE v.fecha_visita::DATE BETWEEN $1 AND $2`,
            [desde, hasta]
        );
        res.json({ diario, resumen: resumen[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo estadísticas de visitas' });
    }
});

// Top medicamentos más dispensados en el período
app.get('/api/estadisticas/medicamentos', async (req, res) => {
    const { desde, hasta } = parseRango(req);
    try {
        const { rows: top } = await pool.query(
            `SELECT
               m.nombre_medicamento AS nombre,
               COALESCE(SUM(p.cantidad_recetada), 0)::INT AS veces_recetado,
               COALESCE(SUM(d.cantidad_dispensada), 0)::INT AS unidades_dispensadas
             FROM prescripcion p
             INNER JOIN consulta_medica cm ON p.id_consulta = cm.id_consulta
             INNER JOIN visita v ON cm.id_visita = v.id_visita
             INNER JOIN medicamento m ON p.id_medicamento = m.id_medicamento
             LEFT JOIN dispensacion d ON d.id_prescripcion = p.id_prescripcion
             WHERE v.fecha_visita::DATE BETWEEN $1 AND $2
             GROUP BY m.id_medicamento, m.nombre_medicamento
             ORDER BY unidades_dispensadas DESC, veces_recetado DESC
             LIMIT 10`,
            [desde, hasta]
        );
        const { rows: total } = await pool.query(
            `SELECT COALESCE(SUM(d.cantidad_dispensada), 0)::INT AS total_unidades
             FROM dispensacion d
             INNER JOIN prescripcion p ON d.id_prescripcion = p.id_prescripcion
             INNER JOIN consulta_medica cm ON p.id_consulta = cm.id_consulta
             INNER JOIN visita v ON cm.id_visita = v.id_visita
             WHERE v.fecha_visita::DATE BETWEEN $1 AND $2`,
            [desde, hasta]
        );
        res.json({ top, total_unidades: total[0].total_unidades });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo estadísticas de medicamentos' });
    }
});

// Top diagnósticos más frecuentes en el período
app.get('/api/estadisticas/diagnosticos', async (req, res) => {
    const { desde, hasta } = parseRango(req);
    try {
        const { rows } = await pool.query(
            `SELECT
               (CASE WHEN NULLIF(TRIM(cm.diagnostico), '') IS NULL THEN 'Sin diagnóstico' ELSE TRIM(cm.diagnostico) END) AS diagnostico,
               COUNT(*)::INT AS cantidad
             FROM consulta_medica cm
             INNER JOIN visita v ON cm.id_visita = v.id_visita
             WHERE v.fecha_visita::DATE BETWEEN $1 AND $2
             GROUP BY diagnostico
             ORDER BY cantidad DESC, diagnostico ASC
             LIMIT 50`,
            [desde, hasta]
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo estadísticas de diagnósticos' });
    }
});

// Geocodificación de direcciones libres con Nominatim (OpenStreetMap).
// Las "Zona N" se resuelven con el catálogo del frontend; el resto intenta
// ubicarse en el mapa real del área de Huehuetenango. Resultados en caché.
const geocodeCache = new Map();
const geocodePatronZona = /zona\s*(\d{1,2}|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/i;
// Área acotada a Huehuetenango y alrededores para privilegiar resultados locales
const GEOCODE_VIEWBOX = '-91.65,15.42,-91.38,15.16';
const GEOCODE_DELAY_MS = 1100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Limpia una dirección "conversacional" para mejorar el acierto de Nominatim:
// quita la ciudad repetida al inicio y muletillas ("atras del", "junto a"...).
const prefijosRuido = [
    "atras del", "atras de", "detras del", "detras de", "tras del", "tras de",
    "junto al", "junto a", "al lado del", "al lado de", "a un lado del",
    "a un lado de", "cerca del", "cerca de", "frente al", "frente a",
    "enfrente de", "en el", "en la", "en un", "del lado de",
];
const ciudadInicial = /^(?:huhuetenango|huehuetenango|guatemala)\b[,\s-]*/i;

const limpiarConsulta = (direccion) => {
    let s = (direccion || '').trim();
    s = s.replace(ciudadInicial, '');
    for (;;) {
        let t = s;
        for (const p of prefijosRuido) {
            const re = new RegExp(
                '^' + p.replace(/\s+/g, '\\s+') + '\\b[,\\s]*',
                'i'
            );
            if (re.test(t)) {
                t = t.replace(re, '');
                break;
            }
        }
        const reSuelto = /^(?:de\s+la|del|de|a\s+la|al)\s+/i;
        if (/^(?:de\s+la|del|de|a\s+la|al)\s+/i.test(t)) {
            t = t.replace(reSuelto, '');
        }
        if (t === s) break;
        s = t;
    }
    return s.trim();
};

const geocodificarDireccion = async (direccion) => {
    if (!direccion || geocodePatronZona.test(direccion)) return null;
    if (geocodeCache.has(direccion)) return geocodeCache.get(direccion);

    // Revisa primero el caché persistente (evita llamadas a Nominatim)
    try {
        const { rows } = await pool.query(
            'SELECT lat, lng, lugar FROM geocodigo_cache WHERE direccion = $1', [direccion]
        );
        if (rows.length) {
            const r = rows[0];
            const val = r.lat != null && r.lng != null
                ? { lat: Number(r.lat), lng: Number(r.lng), lugar: r.lugar }
                : null;
            geocodeCache.set(direccion, val);
            return val;
        }
    } catch (error) {
        // si el caché falla, continúa con la geocodificación normal
    }

    const guardarCache = (direccion, resultado) => {
        geocodeCache.set(direccion, resultado);
        pool.query(
            `INSERT INTO geocodigo_cache (direccion, lat, lng, lugar)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (direccion) DO UPDATE SET
                lat = EXCLUDED.lat, lng = EXCLUDED.lng,
                lugar = EXCLUDED.lugar, fecha = NOW()`,
            [direccion, resultado ? resultado.lat : null, resultado ? resultado.lng : null, resultado ? resultado.lugar : null]
        ).catch(() => { /* el caché es una optimización; no debe bloquear */ });
    };

    const candidatos = [direccion, limpiarConsulta(direccion)].filter(
        (c, i, arr) => c && arr.indexOf(c) === i
    );
    let resultado = null;
    for (const consulta of candidatos) {
        try {
            const url = new URL('https://nominatim.openstreetmap.org/search');
            url.searchParams.set('format', 'jsonv2');
            url.searchParams.set('limit', '1');
            url.searchParams.set('viewbox', GEOCODE_VIEWBOX);
            url.searchParams.set('bounded', '1');
            url.searchParams.set('q', consulta);
            const res = await fetch(url.toString(), {
                headers: {
                    'User-Agent': 'SistemaDeConsultasZaculeu/1.0 (sistema-interno)',
                    'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(6000),
            });
            const datos = await res.json();
            const mejor = (Array.isArray(datos) ? datos : []).find(
                (x) => x && x.lat && x.lon
            );
            if (mejor) {
                resultado = {
                    lat: Number(mejor.lat),
                    lng: Number(mejor.lon),
                    lugar: mejor.display_name,
                };
                break;
            }
        } catch (error) {
            break;
        }
    }
    guardarCache(direccion, resultado);
    return resultado;
};

const geocodificarFilas = async (filas) => {
    // Solo se geocodifican las direcciones que NO tienen coordenadas guardadas
    // en el paciente (definidas con el buscador de dirección del formulario) y
    // que no se resuelven con el catálogo de zonas del frontend.
    const conCoords = {};
    const allaGeocodificar = (f) =>
        f.lat_guardado == null || f.lng_guardado == null;
    filas.forEach((f) => {
        const ok = !allaGeocodificar(f);
        conCoords[f.direccion] = (conCoords[f.direccion] ?? true) && ok;
    });
    const direcciones = Object.keys(conCoords).filter(
        (d) => d && !conCoords[d] && !geocodePatronZona.test(d)
    );
    const resu = {};
    for (let i = 0; i < direcciones.length; i++) {
        if (i > 0) await sleep(GEOCODE_DELAY_MS);
        resu[direcciones[i]] = await geocodificarDireccion(direcciones[i]);
    }
    return filas.map((f) => {
        const geo = resu[f.direccion];
        // Prioriza la coordenada exacta guardada con el paciente (lat/lng del
        // buscador de dirección); si no existe, usa la geocodificada.
        const lat = f.lat_guardado ?? (geo ? geo.lat : null);
        const lng = f.lng_guardado ?? (geo ? geo.lng : null);
        const { lat_guardado, lng_guardado, ...resto } = f;
        return { ...resto, lat, lng, lugar: geo ? geo.lugar : (f.lugar || null) };
    });
};

// Buscador de direcciones: devuelve sugerencias de lugares reales del área de
// Huehuetenango usando Nominatim (autocompletado del formulario de pacientes).
const sugerirCache = new Map();

const sugerirDireccion = async (direccion) => {
    const consulta = limpiarConsulta(direccion) || direccion;
    if (sugerirCache.has(consulta)) return sugerirCache.get(consulta);
    const resultados = [];
    try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('limit', '5');
        url.searchParams.set('viewbox', GEOCODE_VIEWBOX);
        url.searchParams.set('bounded', '1');
        url.searchParams.set('q', consulta);
        const res = await fetch(url.toString(), {
            headers: {
                'User-Agent': 'SistemaDeConsultasZaculeu/1.0 (sistema-interno)',
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(6000),
        });
        const datos = await res.json();
        (Array.isArray(datos) ? datos : []).forEach((x) => {
            if (x && x.lat && x.lon) {
                resultados.push({
                    lat: Number(x.lat),
                    lng: Number(x.lon),
                    nombre: x.display_name,
                });
            }
        });
    } catch (error) {
        // sin sugerencias
    }
    sugerirCache.set(consulta, resultados);
    return resultados;
};

app.get('/api/geocodificar', async (req, res) => {
    const direccion = (req.query.direccion || req.query.q || '').trim();
    if (!direccion) return res.json([]);
    try {
        res.json(await sugerirDireccion(direccion));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar direcciones' });
    }
});

// Mapa de brotes por zona: pacientes con diagnóstico en el período.
// Devuelve la dirección completa; la ubicación (zona o aldea) se resuelve en
// el frontend para soportar "Zona Nueve", aldeas, etc. Para direcciones
// libres devuelve también las coordenadas obtenidas por geocodificación.
app.get('/api/estadisticas/mapa', async (req, res) => {
    const { desde, hasta } = parseRango(req);
    try {
        const sql = `SELECT
               p.nombre_completo,
               p.direccion,
               p.lat AS lat_guardado,
               p.lng AS lng_guardado,
               TRIM(cm.diagnostico) AS diagnostico,
               TO_CHAR(v.fecha_visita::DATE, 'YYYY-MM-DD') AS fecha
             FROM consulta_medica cm
             INNER JOIN visita v   ON cm.id_visita = v.id_visita
             INNER JOIN paciente p ON v.id_paciente = p.id_paciente
             WHERE v.fecha_visita::DATE BETWEEN $1 AND $2
               AND NULLIF(TRIM(cm.diagnostico), '') IS NOT NULL
             ORDER BY v.fecha_visita DESC`;
        const { rows } = await pool.query(sql, [desde, hasta]);
        const conGeocodificacion = await geocodificarFilas(rows);
        res.json(conGeocodificacion);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo datos del mapa de brotes' });
    }
});

// Demografía de pacientes (sexo, edad, crónicos)
app.get('/api/estadisticas/pacientes', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT
               COUNT(*)::INT AS total_pacientes,
               COUNT(*) FILTER (WHERE sexo = 'M')::INT AS masculinos,
               COUNT(*) FILTER (WHERE sexo = 'F')::INT AS femeninos,
               COUNT(*) FILTER (WHERE es_cronico = TRUE)::INT AS cronicos
             FROM paciente
             WHERE activo = TRUE`
        );
        const { rows: porEdad } = await pool.query(
            `SELECT
               (CASE
                 WHEN edad < 15 THEN '0-14'
                 WHEN edad < 30 THEN '15-29'
                 WHEN edad < 45 THEN '30-44'
                 WHEN edad < 60 THEN '45-59'
                 ELSE '60+'
               END) AS rango,
               COUNT(*)::INT AS cantidad
             FROM (SELECT DATE_PART('year', AGE(fecha_nacimiento))::INT AS edad
                   FROM paciente WHERE activo = TRUE) t
             GROUP BY rango
             ORDER BY MIN(edad)`
        );
        const demografia = {
            total_pacientes: rows[0].total_pacientes,
            masculinos: rows[0].masculinos,
            femeninos: rows[0].femeninos,
            cronicos: rows[0].cronicos,
            por_sexo: [
                { nombre: 'Femenino', valor: rows[0].femeninos },
                { nombre: 'Masculino', valor: rows[0].masculinos },
            ],
            por_edad: porEdad.map((r) => ({ ...r, rango: `${r.rango} años` })),
        };
        res.json(demografia);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo estadísticas de pacientes' });
    }
});

const PORT = process.env.PORT || 5000;

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Las migraciones corren antes de aceptar peticiones: si la base no está
// sincronizada, el health check y los endpoints fallarían de forma confusa.
aplicarMigraciones().finally(() => {
    app.listen(PORT, () => {
        console.log(`✅ Backend server (PostgreSQL) running on port ${PORT}`);
    });
});
