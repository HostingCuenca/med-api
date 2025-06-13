// controllers/enrollmentController.js - CORREGIDO
const pool = require('../config/database')

// =============================================
// INSCRIBIRSE A UN CURSO
// =============================================
const enrollCourse = async (req, res) => {
    try {
        const { cursoId } = req.body
        const userId = req.user.id

        if (!cursoId) {
            return res.status(400).json({
                success: false,
                message: 'ID del curso es requerido'
            })
        }

        // Verificar que el curso existe
        const cursoResult = await pool.query(
            'SELECT id, es_gratuito, precio, titulo FROM cursos WHERE id = $1 AND activo = true',
            [cursoId]
        )

        if (cursoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        const curso = cursoResult.rows[0]

        // Verificar si ya está inscrito
        const existingEnrollment = await pool.query(
            'SELECT id, estado_pago FROM inscripciones WHERE usuario_id = $1 AND curso_id = $2',
            [userId, cursoId]
        )

        if (existingEnrollment.rows.length > 0) {
            const estado = existingEnrollment.rows[0].estado_pago
            return res.status(400).json({
                success: false,
                message: estado === 'pendiente'
                    ? 'Ya tienes una solicitud pendiente para este curso'
                    : 'Ya estás inscrito en este curso'
            })
        }

        // Crear inscripción
        const estadoInicial = curso.es_gratuito ? 'habilitado' : 'pendiente'

        const result = await pool.query(
            `INSERT INTO inscripciones (usuario_id, curso_id, estado_pago, fecha_habilitacion)
             VALUES ($1, $2, $3, $4)
                 RETURNING *`,
            [userId, cursoId, estadoInicial, curso.es_gratuito ? new Date() : null]
        )

        const mensaje = curso.es_gratuito
            ? 'Inscripción exitosa. Ya puedes acceder al curso.'
            : `Solicitud enviada. Contacta por WhatsApp (+593 98 503 6066) mencionando tu usuario para completar el pago de $${curso.precio}.`

        res.status(201).json({
            success: true,
            message: mensaje,
            data: {
                inscripcion: result.rows[0],
                whatsappMessage: `Hola, soy ${req.user.nombre_usuario} y quiero acceso al curso "${curso.titulo}". Precio: $${curso.precio}`
            }
        })

    } catch (error) {
        console.error('Error inscripción:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// MIS INSCRIPCIONES - CORREGIDO
// =============================================
const getMyEnrollments = async (req, res) => {
    try {
        const userId = req.user.id

        const result = await pool.query(
            `SELECT i.*, c.titulo, c.slug, c.miniatura_url, c.precio, c.es_gratuito,
                    p.nombre_completo as instructor_nombre,
                    COUNT(DISTINCT cl.id) as total_clases,
                    COUNT(DISTINCT CASE WHEN pc.completada = true THEN pc.clase_id END) as clases_completadas,
                    CASE
                        WHEN COUNT(DISTINCT cl.id) > 0 THEN
                            CAST(
                                    (COUNT(DISTINCT CASE WHEN pc.completada = true THEN pc.clase_id END)::float / COUNT(DISTINCT cl.id)::float) * 100
                                AS DECIMAL(5,2)
                            )
                        ELSE 0
                        END as porcentaje_progreso
             FROM inscripciones i
                      JOIN cursos c ON i.curso_id = c.id
                      LEFT JOIN perfiles_usuario p ON c.instructor_id = p.id
                      LEFT JOIN modulos m ON c.id = m.curso_id
                      LEFT JOIN clases cl ON m.id = cl.modulo_id
                      LEFT JOIN progreso_clases pc ON cl.id = pc.clase_id AND pc.usuario_id = $1
             WHERE i.usuario_id = $1
             GROUP BY i.id, c.id, p.nombre_completo
             ORDER BY i.fecha_inscripcion DESC`,
            [userId]
        )

        res.json({
            success: true,
            data: { inscripciones: result.rows }
        })

    } catch (error) {
        console.error('Error obteniendo inscripciones:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// APROBAR PAGO (ADMIN)
// =============================================
const approvePayment = async (req, res) => {
    try {
        const { inscripcionId } = req.params
        const adminId = req.user.id

        // Obtener información de la inscripción
        const inscripcionResult = await pool.query(
            `SELECT i.*, u.nombre_completo, u.email, c.titulo
             FROM inscripciones i
                      JOIN perfiles_usuario u ON i.usuario_id = u.id
                      JOIN cursos c ON i.curso_id = c.id
             WHERE i.id = $1 AND i.estado_pago = 'pendiente'`,
            [inscripcionId]
        )

        if (inscripcionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Inscripción no encontrada o ya procesada'
            })
        }

        // Aprobar pago
        const result = await pool.query(
            `UPDATE inscripciones
             SET estado_pago = 'habilitado', fecha_habilitacion = NOW(), habilitado_por = $1
             WHERE id = $2
                 RETURNING *`,
            [adminId, inscripcionId]
        )

        const inscripcion = inscripcionResult.rows[0]

        res.json({
            success: true,
            message: `Pago aprobado para ${inscripcion.nombre_completo} - Curso: ${inscripcion.titulo}`,
            data: { inscripcion: result.rows[0] }
        })

    } catch (error) {
        console.error('Error aprobando pago:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// PAGOS PENDIENTES (ADMIN)
// =============================================
const getPendingPayments = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT i.id, i.fecha_inscripcion,
                    u.nombre_completo, u.email, u.nombre_usuario,
                    c.titulo as curso_titulo, c.precio
             FROM inscripciones i
                      JOIN perfiles_usuario u ON i.usuario_id = u.id
                      JOIN cursos c ON i.curso_id = c.id
             WHERE i.estado_pago = 'pendiente'
             ORDER BY i.fecha_inscripcion ASC`
        )

        res.json({
            success: true,
            data: {
                pagosPendientes: result.rows,
                total: result.rows.length
            }
        })

    } catch (error) {
        console.error('Error obteniendo pagos pendientes:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// controllers/enrollmentController.js - AGREGAR ESTE NUEVO MÉTODO

// =============================================
// OBTENER TODAS LAS INSCRIPCIONES (ADMIN) - NUEVO
// =============================================
const getAllEnrollments = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            estado,
            search,
            curso,
            fechaDesde,
            fechaHasta
        } = req.query

        let query = `
            SELECT i.*, 
                   u.nombre_completo, u.email, u.nombre_usuario, u.telefono,
                   c.titulo as curso_titulo, c.precio, c.es_gratuito, c.slug,
                   admin.nombre_completo as aprobado_por_nombre
            FROM inscripciones i
            JOIN perfiles_usuario u ON i.usuario_id = u.id
            JOIN cursos c ON i.curso_id = c.id
            LEFT JOIN perfiles_usuario admin ON i.habilitado_por = admin.id
            WHERE 1=1
        `
        const params = []
        let paramCount = 0

        // Filtro por estado
        if (estado && estado !== 'todos' && estado !== '') {
            paramCount++
            query += ` AND i.estado_pago = $${paramCount}`
            params.push(estado)
        }

        // Filtro por búsqueda (usuario, email, curso)
        if (search) {
            paramCount++
            query += ` AND (
                u.nombre_completo ILIKE $${paramCount} OR 
                u.email ILIKE $${paramCount} OR 
                u.nombre_usuario ILIKE $${paramCount} OR
                c.titulo ILIKE $${paramCount}
            )`
            params.push(`%${search}%`)
        }

        // Filtro por curso específico
        if (curso) {
            paramCount++
            query += ` AND c.titulo ILIKE $${paramCount}`
            params.push(`%${curso}%`)
        }

        // Filtro por fecha
        if (fechaDesde) {
            paramCount++
            query += ` AND i.fecha_inscripcion >= $${paramCount}`
            params.push(fechaDesde)
        }

        if (fechaHasta) {
            paramCount++
            query += ` AND i.fecha_inscripcion <= $${paramCount}`
            params.push(fechaHasta)
        }

        // Ordenar por fecha más reciente
        query += ` ORDER BY i.fecha_inscripcion DESC`

        // Paginación
        const offset = (page - 1) * limit
        query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
        params.push(limit, offset)

        const result = await pool.query(query, params)

        // Contar total para paginación
        let countQuery = `
            SELECT COUNT(*) as total
            FROM inscripciones i
            JOIN perfiles_usuario u ON i.usuario_id = u.id
            JOIN cursos c ON i.curso_id = c.id
            WHERE 1=1
        `
        const countParams = []
        let countParamCount = 0

        // Repetir filtros para el conteo
        if (estado && estado !== 'todos' && estado !== '') {
            countParamCount++
            countQuery += ` AND i.estado_pago = $${countParamCount}`
            countParams.push(estado)
        }

        if (search) {
            countParamCount++
            countQuery += ` AND (
                u.nombre_completo ILIKE $${countParamCount} OR 
                u.email ILIKE $${countParamCount} OR 
                u.nombre_usuario ILIKE $${countParamCount} OR
                c.titulo ILIKE $${countParamCount}
            )`
            countParams.push(`%${search}%`)
        }

        if (curso) {
            countParamCount++
            countQuery += ` AND c.titulo ILIKE $${countParamCount}`
            countParams.push(`%${curso}%`)
        }

        if (fechaDesde) {
            countParamCount++
            countQuery += ` AND i.fecha_inscripcion >= $${countParamCount}`
            countParams.push(fechaDesde)
        }

        if (fechaHasta) {
            countParamCount++
            countQuery += ` AND i.fecha_inscripcion <= $${countParamCount}`
            countParams.push(fechaHasta)
        }

        const countResult = await pool.query(countQuery, countParams)
        const total = parseInt(countResult.rows[0].total)

        res.json({
            success: true,
            data: {
                inscripciones: result.rows,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo todas las inscripciones:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}



// =============================================
// VERIFICAR ACCESO A CURSO
// =============================================
const checkCourseAccess = async (req, res) => {
    try {
        const { cursoId } = req.params
        const userId = req.user.id

        const result = await pool.query(
            `SELECT c.es_gratuito, i.estado_pago, i.fecha_habilitacion
             FROM cursos c
                      LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
             WHERE c.id = $2 AND c.activo = true`,
            [userId, cursoId]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        const curso = result.rows[0]
        const tieneAcceso = curso.es_gratuito || curso.estado_pago === 'habilitado'

        res.json({
            success: true,
            data: {
                tieneAcceso,
                esGratuito: curso.es_gratuito,
                estadoPago: curso.estado_pago || 'no_inscrito',
                fechaHabilitacion: curso.fecha_habilitacion
            }
        })

    } catch (error) {
        console.error('Error verificando acceso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

module.exports = {
    enrollCourse,
    getMyEnrollments,
    approvePayment,
    getPendingPayments,
    checkCourseAccess,
    getAllEnrollments
}