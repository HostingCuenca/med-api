// controllers/dashboardController.js - CORREGIDO
const pool = require('../config/database')

// =============================================
// DASHBOARD ESTUDIANTE - QUERY CORREGIDA
// =============================================
const getStudentDashboard = async (req, res) => {
    try {
        const userId = req.user.id

        // Obtener estadísticas generales
        const statsQuery = `
            SELECT
                COUNT(DISTINCT i.curso_id) as cursos_inscritos,
                COUNT(DISTINCT CASE WHEN pc.completada = true THEN pc.clase_id END) as clases_completadas,
                COUNT(DISTINCT isa.id) as simulacros_realizados,
                COALESCE(AVG(isa.puntaje), 0) as promedio_simulacros
            FROM inscripciones i
                     LEFT JOIN cursos c ON i.curso_id = c.id
                     LEFT JOIN modulos m ON c.id = m.curso_id
                     LEFT JOIN clases cl ON m.id = cl.modulo_id
                     LEFT JOIN progreso_clases pc ON cl.id = pc.clase_id AND pc.usuario_id = $1
                     LEFT JOIN intentos_simulacro isa ON isa.usuario_id = $1
            WHERE i.usuario_id = $1 AND i.estado_pago = 'habilitado'
        `

        const statsResult = await pool.query(statsQuery, [userId])

        // Obtener cursos recientes - CORREGIDO GROUP BY
        const cursosQuery = `
            SELECT c.id, c.titulo, c.slug, c.miniatura_url,
                   COUNT(DISTINCT cl.id) as total_clases,
                   COUNT(DISTINCT CASE WHEN pc.completada = true THEN pc.clase_id END) as clases_completadas,
                   MAX(i.fecha_inscripcion) as fecha_inscripcion
            FROM inscripciones i
                     JOIN cursos c ON i.curso_id = c.id
                     LEFT JOIN modulos m ON c.id = m.curso_id
                     LEFT JOIN clases cl ON m.id = cl.modulo_id
                     LEFT JOIN progreso_clases pc ON cl.id = pc.clase_id AND pc.usuario_id = $1
            WHERE i.usuario_id = $1 AND i.estado_pago = 'habilitado'
            GROUP BY c.id, c.titulo, c.slug, c.miniatura_url
            ORDER BY MAX(i.fecha_inscripcion) DESC
                LIMIT 5
        `

        const cursosResult = await pool.query(cursosQuery, [userId])

        // Obtener actividad reciente - CORREGIDO
        const actividadQuery = `
            (SELECT 'clase' as tipo, cl.titulo, c.titulo as curso_titulo, pc.fecha_ultima_vista as fecha
             FROM progreso_clases pc
             JOIN clases cl ON pc.clase_id = cl.id
             JOIN modulos m ON cl.modulo_id = m.id
             JOIN cursos c ON m.curso_id = c.id
             WHERE pc.usuario_id = $1 AND pc.completada = true)
            UNION ALL
            (SELECT 'simulacro' as tipo, s.titulo, c.titulo as curso_titulo, isa.fecha_intento as fecha
             FROM intentos_simulacro isa
             JOIN simulacros s ON isa.simulacro_id = s.id
             JOIN cursos c ON s.curso_id = c.id
             WHERE isa.usuario_id = $1)
            ORDER BY fecha DESC
            LIMIT 10
        `

        const actividadResult = await pool.query(actividadQuery, [userId])

        res.json({
            success: true,
            data: {
                estadisticas: statsResult.rows[0],
                cursosRecientes: cursosResult.rows,
                actividadReciente: actividadResult.rows
            }
        })

    } catch (error) {
        console.error('Error dashboard estudiante:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// DASHBOARD ADMIN - SIN CAMBIOS
// =============================================
const getAdminDashboard = async (req, res) => {
    try {
        // Estadísticas generales
        const statsQuery = `
            SELECT
                    (SELECT COUNT(*) FROM perfiles_usuario WHERE activo = true) as total_usuarios,
                    (SELECT COUNT(*) FROM perfiles_usuario WHERE tipo_usuario = 'estudiante') as total_estudiantes,
                    (SELECT COUNT(*) FROM cursos WHERE activo = true) as total_cursos,
                    (SELECT COUNT(*) FROM inscripciones WHERE estado_pago = 'pendiente') as pagos_pendientes,
                    (SELECT COUNT(*) FROM inscripciones WHERE estado_pago = 'habilitado') as inscripciones_activas
        `

        const statsResult = await pool.query(statsQuery)

        // Usuarios recientes
        const usuariosQuery = `
            SELECT id, email, nombre_completo, tipo_usuario, fecha_registro
            FROM perfiles_usuario
            ORDER BY fecha_registro DESC
                LIMIT 10
        `

        const usuariosResult = await pool.query(usuariosQuery)

        // Pagos pendientes
        const pagosQuery = `
            SELECT i.id, u.nombre_completo, u.email, c.titulo as curso_titulo, c.precio, i.fecha_inscripcion
            FROM inscripciones i
                     JOIN perfiles_usuario u ON i.usuario_id = u.id
                     JOIN cursos c ON i.curso_id = c.id
            WHERE i.estado_pago = 'pendiente'
            ORDER BY i.fecha_inscripcion DESC
                LIMIT 20
        `

        const pagosResult = await pool.query(pagosQuery)

        res.json({
            success: true,
            data: {
                estadisticas: statsResult.rows[0],
                usuariosRecientes: usuariosResult.rows,
                pagosPendientes: pagosResult.rows
            }
        })

    } catch (error) {
        console.error('Error dashboard admin:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

module.exports = { getStudentDashboard, getAdminDashboard }