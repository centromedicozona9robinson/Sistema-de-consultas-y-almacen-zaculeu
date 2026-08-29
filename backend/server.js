const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Permite peticiones sin origen (curl, Postman) y orígenes en la lista
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origen no permitido por CORS'));
    },
}));

app.use(express.json());

const pool = require('./config/db');

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
    const { nombre_completo, dpi, fecha_nacimiento, sexo, telefono, direccion, id_usuario_registro } = req.body;
    if (!nombre_completo || !fecha_nacimiento || !sexo) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: nombre_completo, fecha_nacimiento y sexo' });
    }
    try {
        const { rows } = await pool.query(
            `INSERT INTO paciente (nombre_completo, dpi, fecha_nacimiento, sexo, telefono, direccion, id_usuario_registro)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_paciente`,
            [nombre_completo, dpi || null, fecha_nacimiento, sexo, telefono || null, direccion || null, id_usuario_registro || 1]
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
        if (contrasena && contrasena.trim()) {
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
    const { id_visita, diagnostico, indicaciones, observaciones, fecha_seguimiento, id_medico } = req.body;
    if (!id_visita || !id_medico) {
        return res.status(400).json({ error: 'Visita y médico son requeridos' });
    }
    try {
        await pool.query('BEGIN');

        const { rows } = await pool.query(
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

        await pool.query(
            `UPDATE visita SET estado = 'completado' WHERE id_visita = $1`,
            [id_visita]
        );

        await pool.query(
            `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, id_registro_afectado, descripcion)
             VALUES ($1, 'REGISTRAR_CONSULTA', 'consulta_medica', $2, $3)`,
            [id_medico, id_visita, `Diagnóstico: ${diagnostico?.substring(0, 100) || 'N/A'}`]
        );

        await pool.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Error al registrar consulta médica' });
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
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo consulta médica' });
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

const PORT = process.env.PORT || 5000;

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`✅ Backend server (PostgreSQL) running on port ${PORT}`);
});
