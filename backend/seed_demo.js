// Carga los datos de demostración (backend/seed_demo.sql) usando las mismas
// credenciales de .env que el servidor. NO usar en producción.
//
// Uso:  npm run seed:demo   (desde la carpeta backend)
const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

(async () => {
    const archivo = path.join(__dirname, 'seed_demo.sql');
    const sql = fs.readFileSync(archivo, 'utf8');
    try {
        await pool.query(sql);
        const { rows } = await pool.query(
            `SELECT 'Pacientes demo' AS concepto, COUNT(*)::INT AS total FROM paciente WHERE dpi LIKE '9000%'
             UNION ALL SELECT 'Visitas demo', COUNT(*)::INT FROM visita v JOIN paciente p ON v.id_paciente=p.id_paciente WHERE p.dpi LIKE '9000%'
             UNION ALL SELECT 'Consultas demo', COUNT(*)::INT FROM consulta_medica c JOIN visita v ON c.id_visita=v.id_visita JOIN paciente p ON v.id_paciente=p.id_paciente WHERE p.dpi LIKE '9000%'
             UNION ALL SELECT 'Correcciones (versionado)', COUNT(*)::INT FROM consulta_medica c JOIN visita v ON c.id_visita=v.id_visita JOIN paciente p ON v.id_paciente=p.id_paciente WHERE p.dpi LIKE '9000%' AND c.tipo_version='corregido'
             UNION ALL SELECT 'Embarazadas (IMC)', COUNT(*)::INT FROM paciente WHERE dpi LIKE '9000%' AND esta_embarazada
             UNION ALL SELECT 'Medicamentos demo', COUNT(*)::INT FROM medicamento WHERE nombre_medicamento LIKE 'DEMO %'
             UNION ALL SELECT 'Dispensaciones', COUNT(*)::INT FROM dispensacion d JOIN prescripcion pr ON d.id_prescripcion=pr.id_prescripcion JOIN consulta_medica c ON pr.id_consulta=c.id_consulta JOIN visita v ON c.id_visita=v.id_visita JOIN paciente p ON v.id_paciente=p.id_paciente WHERE p.dpi LIKE '9000%'`
        );
        console.log('✅ Datos de demostración cargados.');
        console.table(rows);
    } catch (error) {
        console.error('❌ Error cargando los datos de demostración:', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
