// controllers/progressController.js - CORREGIDO
const pool = require('../config/database')

// =============================================
// ACTUALIZAR PROGRESO DE CLASE - CORREGIDO
// =============================================
const updateClassProgress = async (req, res) => {
    try {
        const { claseId } = req.params
        const { porcentajeVisto, completada = false } = req.body
        const userId = req.user.id

        if (porcentajeVisto === undefined || porcentajeVisto < 0 || porcentajeVisto > 100) {
            return res.status(400).json({
                success: false,
                message: 'Porcentaje visto debe ser un número entre 0 y 100'
            })
        }

        // Verificar que la clase existe y el usuario tiene acceso
        const claseCheck = await pool.query(
            `SELECT cl.id, c.es_gratuito, i.estado_pago, i.acceso_activo, c.titulo as curso_titulo
             FROM clases cl
                      JOIN modulos m ON cl.modulo_id = m.id
                      JOIN cursos c ON m.curso_id = c.id
                      LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
             WHERE cl.id = $2`,
            [userId, claseId]
        )

        if (claseCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Clase no encontrada'
            })
        }

        const clase = claseCheck.rows[0]

        // Verificar acceso (ahora valida acceso_activo)
        if (!clase.es_gratuito && (clase.estado_pago !== 'habilitado' || clase.acceso_activo !== true)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes acceso a esta clase'
            })
        }

        // Auto-completar si el porcentaje es 95% o más
        const esCompletada = completada || porcentajeVisto >= 95

        // CORREGIDO: Usar "porcentajeVisto" (con comillas) como en el esquema
        const result = await pool.query(
            `INSERT INTO progreso_clases (usuario_id, clase_id, "porcentajeVisto", completada)
             VALUES ($1, $2, $3, $4)
                 ON CONFLICT (usuario_id, clase_id)
             DO UPDATE SET
                "porcentajeVisto" = GREATEST(progreso_clases."porcentajeVisto", $3),
                                     completada = CASE WHEN $4 = true THEN true ELSE progreso_clases.completada END,
               fecha_ultima_vista = NOW()
             RETURNING *`,
            [userId, claseId, porcentajeVisto, esCompletada]
        )

        res.json({
            success: true,
            message: esCompletada ? 'Clase completada' : 'Progreso actualizado',
            data: { progreso: result.rows[0] }
        })

    } catch (error) {
        console.error('Error actualizando progreso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// OBTENER PROGRESO POR CURSO - CORREGIDO
// =============================================
const getCourseProgress = async (req, res) => {
    try {
        const { cursoId } = req.params
        const userId = req.user.id

        // Verificar acceso al curso
        const accesoCheck = await pool.query(
            `SELECT c.titulo, c.slug, c.descripcion, c.miniatura_url, c.es_gratuito, i.estado_pago, i.acceso_activo
             FROM cursos c
                      LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
             WHERE c.id = $2 AND c.activo = true`,
            [userId, cursoId]
        )

        if (accesoCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        const curso = accesoCheck.rows[0]

        // Obtener progreso general - CORREGIDO el campo
        const resumenResult = await pool.query(
            `SELECT
                 COUNT(cl.id) as total_clases,
                 COUNT(CASE WHEN pc.completada = true THEN 1 END) as clases_completadas,
                 COALESCE(AVG(pc."porcentajeVisto"), 0) as progreso_promedio,
                 COUNT(DISTINCT m.id) as total_modulos
             FROM clases cl
                      JOIN modulos m ON cl.modulo_id = m.id
                      LEFT JOIN progreso_clases pc ON cl.id = pc.clase_id AND pc.usuario_id = $1
             WHERE m.curso_id = $2`,
            [userId, cursoId]
        )

        const resumen = resumenResult.rows[0]

        // Obtener progreso detallado por módulos - CORREGIDO el campo
        const detalleResult = await pool.query(
            `SELECT m.id as modulo_id, m.titulo as modulo_titulo, m.descripcion as modulo_descripcion, m.orden as modulo_orden,
                    json_agg(
                            json_build_object(
                                    'id', cl.id,
                                    'titulo', cl.titulo,
                                    'descripcion', cl.descripcion,
                                    'orden', cl.orden,
                                    'es_gratuita', cl.es_gratuita,
                                    'video_youtube_url', cl.video_youtube_url,
                                    'duracion_minutos', cl.duracion_minutos,
                                    'porcentaje_visto', COALESCE(pc."porcentajeVisto", 0),
                                    'completada', COALESCE(pc.completada, false),
                                    'fecha_ultima_vista', pc.fecha_ultima_vista,
                                    'puede_acceder', CASE
                                                         WHEN $3 = true OR $4 = 'habilitado' OR cl.es_gratuita = true THEN true
                                                         ELSE false
                                        END
                            ) ORDER BY cl.orden
                    ) as clases
             FROM modulos m
                      JOIN clases cl ON m.id = cl.modulo_id
                      LEFT JOIN progreso_clases pc ON cl.id = pc.clase_id AND pc.usuario_id = $1
             WHERE m.curso_id = $2
             GROUP BY m.id, m.titulo, m.descripcion, m.orden
             ORDER BY m.orden`,
            [userId, cursoId, curso.es_gratuito, curso.estado_pago]
        )

        // Calcular porcentaje de progreso total
        const porcentajeProgreso = resumen.total_clases > 0
            ? Math.round((resumen.clases_completadas / resumen.total_clases) * 100)
            : 0

        res.json({
            success: true,
            data: {
                curso: {
                    titulo: curso.titulo,
                    slug: curso.slug,
                    descripcion: curso.descripcion,
                    miniatura_url: curso.miniatura_url,
                    tieneAcceso: curso.es_gratuito || (curso.estado_pago === 'habilitado' && curso.acceso_activo === true),
                    es_gratuito: curso.es_gratuito,
                    estado_pago: curso.estado_pago,
                    acceso_activo: curso.acceso_activo
                },
                resumen: {
                    ...resumen,
                    porcentaje_progreso: porcentajeProgreso
                },
                modulos: detalleResult.rows
            }
        })

    } catch (error) {
        console.error('Error obteniendo progreso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// OBTENER PROGRESO GENERAL DEL USUARIO
// =============================================
const getMyOverallProgress = async (req, res) => {
    try {
        const userId = req.user.id

        // CORREGIDO: Usar CAST en lugar de ROUND para PostgreSQL
        const result = await pool.query(
            `SELECT c.id as curso_id, c.titulo, c.slug, c.miniatura_url,
                    COUNT(cl.id) as total_clases,
                    COUNT(CASE WHEN pc.completada = true THEN 1 END) as clases_completadas,
                    CASE
                        WHEN COUNT(cl.id) > 0 THEN
                            CAST((COUNT(CASE WHEN pc.completada = true THEN 1 END)::float / COUNT(cl.id)::float) * 100 AS DECIMAL(5,2))
                        ELSE 0
                        END as porcentaje_progreso,
                    i.fecha_inscripcion,
                    MAX(pc.fecha_ultima_vista) as ultima_actividad
             FROM inscripciones i
                      JOIN cursos c ON i.curso_id = c.id
                      JOIN modulos m ON c.id = m.curso_id
                      JOIN clases cl ON m.id = cl.modulo_id
                      LEFT JOIN progreso_clases pc ON cl.id = pc.clase_id AND pc.usuario_id = $1
             WHERE i.usuario_id = $1 AND i.estado_pago = 'habilitado' AND i.acceso_activo = true
             GROUP BY c.id, c.titulo, c.slug, c.miniatura_url, i.fecha_inscripcion
             ORDER BY i.fecha_inscripcion DESC`,
            [userId]
        )

        // Estadísticas generales
        const statsResult = await pool.query(
            `SELECT
                 COUNT(DISTINCT i.curso_id) as cursos_inscritos,
                 COUNT(DISTINCT CASE WHEN pc.completada = true THEN pc.clase_id END) as total_clases_completadas,
                 COUNT(DISTINCT isa.id) as simulacros_realizados,
                 COALESCE(AVG(isa.puntaje), 0) as promedio_simulacros
             FROM inscripciones i
                      LEFT JOIN cursos c ON i.curso_id = c.id
                      LEFT JOIN modulos m ON c.id = m.curso_id
                      LEFT JOIN clases cl ON m.id = cl.modulo_id
                      LEFT JOIN progreso_clases pc ON cl.id = pc.clase_id AND pc.usuario_id = $1
                      LEFT JOIN intentos_simulacro isa ON isa.usuario_id = $1
             WHERE i.usuario_id = $1 AND i.estado_pago = 'habilitado' AND i.acceso_activo = true`,
            [userId]
        )

        res.json({
            success: true,
            data: {
                estadisticas: statsResult.rows[0],
                cursos: result.rows
            }
        })

    } catch (error) {
        console.error('Error obteniendo progreso general:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

module.exports = {
    updateClassProgress,
    getCourseProgress,
    getMyOverallProgress
}