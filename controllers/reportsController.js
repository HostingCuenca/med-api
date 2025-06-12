// // controllers/reportsController.js
// const pool = require('../config/database')
//
// // =============================================
// // REPORTE GENERAL
// // =============================================
// const getGeneralReport = async (req, res) => {
//     try {
//         const [usuarios, cursos, inscripciones, simulacros] = await Promise.all([
//             pool.query(`
//         SELECT
//           COUNT(*) as total,
//           COUNT(CASE WHEN activo = true THEN 1 END) as activos,
//           COUNT(CASE WHEN fecha_registro >= NOW() - INTERVAL '30 days' THEN 1 END) as nuevos_mes
//         FROM perfiles_usuario
//       `),
//             pool.query(`
//         SELECT
//           COUNT(*) as total,
//           COUNT(CASE WHEN activo = true THEN 1 END) as activos,
//           COUNT(CASE WHEN es_gratuito = true THEN 1 END) as gratuitos,
//           AVG(precio) as precio_promedio
//         FROM cursos
//       `),
//             pool.query(`
//         SELECT
//           COUNT(*) as total,
//           COUNT(CASE WHEN estado_pago = 'habilitado' THEN 1 END) as habilitadas,
//           COUNT(CASE WHEN estado_pago = 'pendiente' THEN 1 END) as pendientes,
//           SUM(CASE WHEN estado_pago = 'habilitado' THEN c.precio ELSE 0 END) as ingresos_totales
//         FROM inscripciones i
//         JOIN cursos c ON i.curso_id = c.id
//       `),
//             pool.query(`
//         SELECT
//           COUNT(DISTINCT s.id) as total_simulacros,
//           COUNT(DISTINCT ia.id) as total_intentos,
//           AVG(ia.puntaje) as puntaje_promedio
//         FROM simulacros s
//         LEFT JOIN intentos_simulacro ia ON s.id = ia.simulacro_id
//       `)
//         ])
//
//         res.json({
//             success: true,
//             data: {
//                 usuarios: usuarios.rows[0],
//                 cursos: cursos.rows[0],
//                 inscripciones: inscripciones.rows[0],
//                 simulacros: simulacros.rows[0]
//             }
//         })
//
//     } catch (error) {
//         console.error('Error generando reporte:', error)
//         res.status(500).json({
//             success: false,
//             message: 'Error interno del servidor'
//         })
//     }
// }
//
// // =============================================
// // CURSOS MÁS POPULARES
// // =============================================
// const getPopularCourses = async (req, res) => {
//     try {
//         const result = await pool.query(`
//       SELECT c.id, c.titulo, c.precio, c.es_gratuito,
//         COUNT(i.id) as total_inscripciones,
//         COUNT(CASE WHEN i.estado_pago = 'habilitado' THEN 1 END) as inscripciones_activas,
//         AVG(ia.puntaje) as puntaje_promedio_simulacros
//       FROM cursos c
//       LEFT JOIN inscripciones i ON c.id = i.curso_id
//       LEFT JOIN simulacros s ON c.id = s.curso_id
//       LEFT JOIN intentos_simulacro ia ON s.id = ia.simulacro_id
//       WHERE c.activo = true
//       GROUP BY c.id
//       ORDER BY total_inscripciones DESC
//       LIMIT 10
//     `)
//
//         res.json({
//             success: true,
//             data: { cursosPopulares: result.rows }
//         })
//
//     } catch (error) {
//         console.error('Error obteniendo cursos populares:', error)
//         res.status(500).json({
//             success: false,
//             message: 'Error interno del servidor'
//         })
//     }
// }
//
// module.exports = { getGeneralReport, getPopularCourses }

// controllers/reportsController.js - CORREGIDO Y COMPLETO
const pool = require('../config/database')

// =============================================
// REPORTE GENERAL - CORREGIDO
// =============================================
const getGeneralReport = async (req, res) => {
    try {
        const [usuarios, cursos, inscripciones, simulacros, ingresos] = await Promise.all([
            // Estadísticas de usuarios
            pool.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN activo = true THEN 1 END) as activos,
                    COUNT(CASE WHEN fecha_registro >= NOW() - INTERVAL '30 days' THEN 1 END) as nuevos_mes,
                    COUNT(CASE WHEN tipo_usuario = 'estudiante' THEN 1 END) as estudiantes,
                    COUNT(CASE WHEN tipo_usuario = 'instructor' THEN 1 END) as instructores,
                    COUNT(CASE WHEN tipo_usuario = 'admin' THEN 1 END) as admins
                FROM perfiles_usuario
            `),

            // Estadísticas de cursos
            pool.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN activo = true THEN 1 END) as activos,
                    COUNT(CASE WHEN es_gratuito = true THEN 1 END) as gratuitos,
                    COUNT(CASE WHEN es_gratuito = false THEN 1 END) as pagos,
                    COALESCE(AVG(CASE WHEN es_gratuito = false THEN precio END), 0) as precio_promedio,
                    COUNT(CASE WHEN fecha_creacion >= NOW() - INTERVAL '30 days' THEN 1 END) as nuevos_mes
                FROM cursos
            `),

            // Estadísticas de inscripciones
            pool.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN estado_pago = 'habilitado' THEN 1 END) as habilitadas,
                    COUNT(CASE WHEN estado_pago = 'pendiente' THEN 1 END) as pendientes,
                    COUNT(CASE WHEN fecha_inscripcion >= NOW() - INTERVAL '30 days' THEN 1 END) as nuevas_mes
                FROM inscripciones
            `),

            // Estadísticas de simulacros
            pool.query(`
                SELECT 
                    COUNT(DISTINCT s.id) as total_simulacros,
                    COUNT(DISTINCT ia.id) as total_intentos,
                    COALESCE(AVG(ia.puntaje), 0) as puntaje_promedio,
                    COUNT(CASE WHEN ia.fecha_intento >= NOW() - INTERVAL '30 days' THEN 1 END) as intentos_mes
                FROM simulacros s
                LEFT JOIN intentos_simulacro ia ON s.id = ia.simulacro_id
                WHERE s.activo = true
            `),

            // Estadísticas de ingresos - NUEVA QUERY SEPARADA
            pool.query(`
                SELECT 
                    COALESCE(SUM(c.precio), 0) as ingresos_totales,
                    COALESCE(SUM(CASE WHEN i.fecha_habilitacion >= NOW() - INTERVAL '30 days' THEN c.precio ELSE 0 END), 0) as ingresos_mes,
                    COUNT(CASE WHEN i.estado_pago = 'habilitado' AND c.es_gratuito = false THEN 1 END) as ventas_totales
                FROM inscripciones i
                JOIN cursos c ON i.curso_id = c.id
                WHERE i.estado_pago = 'habilitado' AND c.es_gratuito = false
            `)
        ])

        res.json({
            success: true,
            data: {
                usuarios: usuarios.rows[0],
                cursos: cursos.rows[0],
                inscripciones: inscripciones.rows[0],
                simulacros: simulacros.rows[0],
                ingresos: ingresos.rows[0]
            }
        })

    } catch (error) {
        console.error('Error generando reporte general:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CURSOS MÁS POPULARES - CORREGIDO
// =============================================
const getPopularCourses = async (req, res) => {
    try {
        const { limit = 10 } = req.query

        const result = await pool.query(`
            SELECT 
                c.id, 
                c.titulo, 
                c.slug,
                c.precio, 
                c.es_gratuito,
                c.miniatura_url,
                p.nombre_completo as instructor_nombre,
                COUNT(DISTINCT i.id) as total_inscripciones,
                COUNT(DISTINCT CASE WHEN i.estado_pago = 'habilitado' THEN i.id END) as inscripciones_activas,
                COUNT(DISTINCT s.id) as total_simulacros,
                COUNT(DISTINCT ia.id) as intentos_simulacros,
                COALESCE(AVG(ia.puntaje), 0) as puntaje_promedio_simulacros,
                COALESCE(SUM(CASE WHEN i.estado_pago = 'habilitado' AND c.es_gratuito = false THEN c.precio ELSE 0 END), 0) as ingresos_generados
            FROM cursos c
            LEFT JOIN perfiles_usuario p ON c.instructor_id = p.id
            LEFT JOIN inscripciones i ON c.id = i.curso_id
            LEFT JOIN simulacros s ON c.id = s.curso_id
            LEFT JOIN intentos_simulacro ia ON s.id = ia.simulacro_id
            WHERE c.activo = true
            GROUP BY c.id, c.titulo, c.slug, c.precio, c.es_gratuito, c.miniatura_url, p.nombre_completo
            ORDER BY total_inscripciones DESC, inscripciones_activas DESC
            LIMIT $1
        `, [limit])

        res.json({
            success: true,
            data: { cursosPopulares: result.rows }
        })

    } catch (error) {
        console.error('Error obteniendo cursos populares:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// REPORTE DE PROGRESO GENERAL - NUEVO
// =============================================
const getProgressReport = async (req, res) => {
    try {
        // Progreso general por curso
        const progressResult = await pool.query(`
            SELECT 
                c.id,
                c.titulo,
                COUNT(DISTINCT i.usuario_id) as estudiantes_inscritos,
                COUNT(DISTINCT cl.id) as total_clases,
                COUNT(DISTINCT CASE WHEN pc.completada = true THEN pc.id END) as clases_completadas,
                CASE 
                    WHEN COUNT(DISTINCT cl.id) > 0 THEN 
                        ROUND((COUNT(DISTINCT CASE WHEN pc.completada = true THEN pc.id END)::float / 
                               COUNT(DISTINCT cl.id)::float) * 100, 2)
                    ELSE 0 
                END as porcentaje_progreso_promedio,
                COUNT(DISTINCT s.id) as total_simulacros,
                COUNT(DISTINCT ia.id) as intentos_realizados,
                COALESCE(AVG(ia.puntaje), 0) as puntaje_promedio
            FROM cursos c
            LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.estado_pago = 'habilitado'
            LEFT JOIN modulos m ON c.id = m.curso_id
            LEFT JOIN clases cl ON m.id = cl.modulo_id
            LEFT JOIN progreso_clases pc ON cl.id = pc.clase_id AND pc.usuario_id = i.usuario_id
            LEFT JOIN simulacros s ON c.id = s.curso_id
            LEFT JOIN intentos_simulacro ia ON s.id = ia.simulacro_id AND ia.usuario_id = i.usuario_id
            WHERE c.activo = true
            GROUP BY c.id, c.titulo
            ORDER BY estudiantes_inscritos DESC
        `)

        // Estudiantes más activos
        const activeStudentsResult = await pool.query(`
            SELECT 
                u.id,
                u.nombre_completo,
                u.email,
                COUNT(DISTINCT i.curso_id) as cursos_inscritos,
                COUNT(DISTINCT CASE WHEN pc.completada = true THEN pc.clase_id END) as clases_completadas,
                COUNT(DISTINCT ia.id) as simulacros_realizados,
                COALESCE(AVG(ia.puntaje), 0) as promedio_simulacros,
                MAX(pc.fecha_ultima_vista) as ultima_actividad
            FROM perfiles_usuario u
            JOIN inscripciones i ON u.id = i.usuario_id
            LEFT JOIN progreso_clases pc ON u.id = pc.usuario_id
            LEFT JOIN intentos_simulacro ia ON u.id = ia.usuario_id
            WHERE u.tipo_usuario = 'estudiante' AND u.activo = true AND i.estado_pago = 'habilitado'
            GROUP BY u.id, u.nombre_completo, u.email
            HAVING COUNT(DISTINCT i.curso_id) > 0
            ORDER BY clases_completadas DESC, simulacros_realizados DESC
            LIMIT 20
        `)

        res.json({
            success: true,
            data: {
                progreso_por_curso: progressResult.rows,
                estudiantes_activos: activeStudentsResult.rows
            }
        })

    } catch (error) {
        console.error('Error obteniendo reporte de progreso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// REPORTE FINANCIERO - NUEVO
// =============================================
const getFinancialReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query

        let dateFilter = ''
        const params = []

        if (startDate && endDate) {
            dateFilter = 'AND i.fecha_habilitacion BETWEEN $1 AND $2'
            params.push(startDate, endDate)
        }

        // Ingresos por curso
        const incomeResult = await pool.query(`
            SELECT 
                c.id,
                c.titulo,
                c.precio,
                c.es_gratuito,
                COUNT(CASE WHEN i.estado_pago = 'habilitado' THEN 1 END) as ventas,
                COALESCE(SUM(CASE WHEN i.estado_pago = 'habilitado' THEN c.precio ELSE 0 END), 0) as ingresos_totales,
                COUNT(CASE WHEN i.estado_pago = 'pendiente' THEN 1 END) as ventas_pendientes,
                COALESCE(SUM(CASE WHEN i.estado_pago = 'pendiente' THEN c.precio ELSE 0 END), 0) as ingresos_pendientes
            FROM cursos c
            LEFT JOIN inscripciones i ON c.id = i.curso_id ${dateFilter}
            WHERE c.activo = true AND c.es_gratuito = false
            GROUP BY c.id, c.titulo, c.precio, c.es_gratuito
            ORDER BY ingresos_totales DESC
        `, params)

        // Resumen financiero
        const summaryResult = await pool.query(`
            SELECT 
                COUNT(CASE WHEN i.estado_pago = 'habilitado' THEN 1 END) as total_ventas,
                COALESCE(SUM(CASE WHEN i.estado_pago = 'habilitado' THEN c.precio ELSE 0 END), 0) as ingresos_totales,
                COUNT(CASE WHEN i.estado_pago = 'pendiente' THEN 1 END) as ventas_pendientes,
                COALESCE(SUM(CASE WHEN i.estado_pago = 'pendiente' THEN c.precio ELSE 0 END), 0) as ingresos_pendientes,
                COALESCE(AVG(CASE WHEN i.estado_pago = 'habilitado' THEN c.precio END), 0) as ticket_promedio
            FROM inscripciones i
            JOIN cursos c ON i.curso_id = c.id
            WHERE c.es_gratuito = false ${dateFilter}
        `, params)

        // Ingresos por mes (últimos 6 meses)
        const monthlyResult = await pool.query(`
            SELECT 
                DATE_TRUNC('month', i.fecha_habilitacion) as mes,
                COUNT(*) as ventas,
                SUM(c.precio) as ingresos
            FROM inscripciones i
            JOIN cursos c ON i.curso_id = c.id
            WHERE i.estado_pago = 'habilitado' 
            AND c.es_gratuito = false
            AND i.fecha_habilitacion >= NOW() - INTERVAL '6 months'
            GROUP BY DATE_TRUNC('month', i.fecha_habilitacion)
            ORDER BY mes DESC
        `)

        res.json({
            success: true,
            data: {
                resumen: summaryResult.rows[0],
                ingresos_por_curso: incomeResult.rows,
                ingresos_mensuales: monthlyResult.rows
            }
        })

    } catch (error) {
        console.error('Error obteniendo reporte financiero:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// REPORTE DE ACTIVIDAD - NUEVO
// =============================================
const getActivityReport = async (req, res) => {
    try {
        const { days = 30 } = req.query

        // Actividad reciente
        const activityResult = await pool.query(`
            (SELECT 'registro' as tipo, 
                    u.nombre_completo as usuario, 
                    'Se registró en la plataforma' as descripcion,
                    u.fecha_registro as fecha
             FROM perfiles_usuario u
             WHERE u.fecha_registro >= NOW() - INTERVAL '${days} days')
            
            UNION ALL
            
            (SELECT 'inscripcion' as tipo,
                    u.nombre_completo as usuario,
                    CONCAT('Se inscribió en: ', c.titulo) as descripcion,
                    i.fecha_inscripcion as fecha
             FROM inscripciones i
             JOIN perfiles_usuario u ON i.usuario_id = u.id
             JOIN cursos c ON i.curso_id = c.id
             WHERE i.fecha_inscripcion >= NOW() - INTERVAL '${days} days')
            
            UNION ALL
            
            (SELECT 'simulacro' as tipo,
                    u.nombre_completo as usuario,
                    CONCAT('Realizó simulacro: ', s.titulo, ' (', ia.puntaje, '%)') as descripcion,
                    ia.fecha_intento as fecha
             FROM intentos_simulacro ia
             JOIN perfiles_usuario u ON ia.usuario_id = u.id
             JOIN simulacros s ON ia.simulacro_id = s.id
             WHERE ia.fecha_intento >= NOW() - INTERVAL '${days} days')
            
            ORDER BY fecha DESC
            LIMIT 50
        `)

        // Estadísticas de actividad por día
        const dailyStatsResult = await pool.query(`
            SELECT 
                DATE(fecha) as dia,
                COUNT(*) as total_actividades,
                COUNT(CASE WHEN tipo = 'registro' THEN 1 END) as registros,
                COUNT(CASE WHEN tipo = 'inscripcion' THEN 1 END) as inscripciones,
                COUNT(CASE WHEN tipo = 'simulacro' THEN 1 END) as simulacros
            FROM (
                (SELECT 'registro' as tipo, fecha_registro as fecha FROM perfiles_usuario
                 WHERE fecha_registro >= NOW() - INTERVAL '${days} days')
                UNION ALL
                (SELECT 'inscripcion' as tipo, fecha_inscripcion as fecha FROM inscripciones
                 WHERE fecha_inscripcion >= NOW() - INTERVAL '${days} days')
                UNION ALL
                (SELECT 'simulacro' as tipo, fecha_intento as fecha FROM intentos_simulacro
                 WHERE fecha_intento >= NOW() - INTERVAL '${days} days')
            ) actividades
            GROUP BY DATE(fecha)
            ORDER BY dia DESC
        `)

        res.json({
            success: true,
            data: {
                actividad_reciente: activityResult.rows,
                estadisticas_diarias: dailyStatsResult.rows
            }
        })

    } catch (error) {
        console.error('Error obteniendo reporte de actividad:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// EXPORTAR FUNCIONES
// =============================================
module.exports = {
    getGeneralReport,
    getPopularCourses,
    getProgressReport,      // NUEVO
    getFinancialReport,     // NUEVO
    getActivityReport       // NUEVO
}