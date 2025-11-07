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
        const accesoInicial = curso.es_gratuito ? true : false

        const result = await pool.query(
            `INSERT INTO inscripciones (usuario_id, curso_id, estado_pago, acceso_activo, fecha_habilitacion)
             VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
            [userId, cursoId, estadoInicial, accesoInicial, curso.es_gratuito ? new Date() : null]
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
                        END as porcentaje_progreso,
                    CASE
                        WHEN c.es_gratuito = true THEN true
                        WHEN i.estado_pago = 'habilitado' AND i.acceso_activo = true THEN true
                        ELSE false
                    END as tiene_acceso_actual
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

        // Aprobar pago y activar acceso
        const result = await pool.query(
            `UPDATE inscripciones
             SET estado_pago = 'habilitado',
                 fecha_habilitacion = NOW(),
                 habilitado_por = $1,
                 acceso_activo = true
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


// const getAllEnrollments = async (req, res) => {
//     try {
//         const {
//             priority = 'pending', // 'pending', 'all', 'recent'
//             limit = 100,
//             offset = 0,
//             search = '',
//             curso = '',
//             estado = '',
//             fechaDesde = '',
//             fechaHasta = ''
//         } = req.query
//
//         console.log('📚 Obteniendo inscripciones:', { priority, limit, offset, search })
//
//         // ========== QUERY BASE ==========
//         let baseQuery = `
//             SELECT i.*,
//                    u.nombre_completo, u.email, u.nombre_usuario, u.telefono,
//                    c.titulo as curso_titulo, c.precio, c.es_gratuito, c.slug,
//                    admin.nombre_completo as aprobado_por_nombre
//             FROM inscripciones i
//             JOIN perfiles_usuario u ON i.usuario_id = u.id
//             JOIN cursos c ON i.curso_id = c.id
//             LEFT JOIN perfiles_usuario admin ON i.habilitado_por = admin.id
//             WHERE 1=1
//         `
//
//         let countQuery = `
//             SELECT COUNT(*) as total,
//                    COUNT(CASE WHEN i.estado_pago = 'pendiente' THEN 1 END) as pendientes,
//                    COUNT(CASE WHEN i.estado_pago = 'habilitado' THEN 1 END) as habilitadas,
//                    SUM(CASE WHEN i.estado_pago = 'habilitado' AND NOT c.es_gratuito THEN c.precio ELSE 0 END) as ingresos_totales,
//                    SUM(CASE WHEN i.estado_pago = 'pendiente' AND NOT c.es_gratuito THEN c.precio ELSE 0 END) as ingresos_pendientes
//             FROM inscripciones i
//             JOIN perfiles_usuario u ON i.usuario_id = u.id
//             JOIN cursos c ON i.curso_id = c.id
//             WHERE 1=1
//         `
//
//         const params = []
//         const countParams = []
//         let paramCount = 0
//
//         // ========== APLICAR FILTROS ==========
//
//         // Filtro por búsqueda
//         if (search && search.trim()) {
//             paramCount++
//             const searchCondition = ` AND (
//                 u.nombre_completo ILIKE $${paramCount} OR
//                 u.email ILIKE $${paramCount} OR
//                 u.nombre_usuario ILIKE $${paramCount} OR
//                 c.titulo ILIKE $${paramCount}
//             )`
//             baseQuery += searchCondition
//             countQuery += searchCondition
//
//             const searchParam = `%${search.trim()}%`
//             params.push(searchParam)
//             countParams.push(searchParam)
//         }
//
//         // Filtro por curso
//         if (curso && curso.trim()) {
//             paramCount++
//             const cursoCondition = ` AND c.titulo ILIKE $${paramCount}`
//             baseQuery += cursoCondition
//             countQuery += cursoCondition
//
//             const cursoParam = `%${curso.trim()}%`
//             params.push(cursoParam)
//             countParams.push(cursoParam)
//         }
//
//         // Filtro por estado (solo si no es prioridad pendientes)
//         if (estado && estado.trim() && priority !== 'pending') {
//             paramCount++
//             const estadoCondition = ` AND i.estado_pago = $${paramCount}`
//             baseQuery += estadoCondition
//             countQuery += estadoCondition
//
//             params.push(estado.trim())
//             countParams.push(estado.trim())
//         }
//
//         // Filtro por fechas
//         if (fechaDesde && fechaDesde.trim()) {
//             paramCount++
//             const fechaDesdeCondition = ` AND i.fecha_inscripcion >= $${paramCount}`
//             baseQuery += fechaDesdeCondition
//             countQuery += fechaDesdeCondition
//
//             params.push(fechaDesde.trim())
//             countParams.push(fechaDesde.trim())
//         }
//
//         if (fechaHasta && fechaHasta.trim()) {
//             paramCount++
//             const fechaHastaCondition = ` AND i.fecha_inscripcion <= $${paramCount}`
//             baseQuery += fechaHastaCondition
//             countQuery += fechaHastaCondition
//
//             params.push(fechaHasta.trim())
//             countParams.push(fechaHasta.trim())
//         }
//
//         // ========== ORDENAMIENTO SEGÚN PRIORIDAD ==========
//         let orderBy = ''
//
//         switch (priority) {
//             case 'pending':
//                 // PRIORIDAD 1: Pendientes primero, luego los más recientes
//                 orderBy = ` ORDER BY
//                     CASE WHEN i.estado_pago = 'pendiente' THEN 0 ELSE 1 END,
//                     i.fecha_inscripcion DESC`
//                 break
//
//             case 'recent':
//                 // PRIORIDAD 2: Más recientes primero
//                 orderBy = ` ORDER BY i.fecha_inscripcion DESC`
//                 break
//
//             case 'all':
//             default:
//                 // PRIORIDAD 3: Pendientes, luego habilitados, luego por fecha
//                 orderBy = ` ORDER BY
//                     CASE
//                         WHEN i.estado_pago = 'pendiente' THEN 0
//                         WHEN i.estado_pago = 'habilitado' THEN 1
//                         ELSE 2
//                     END,
//                     i.fecha_inscripcion DESC`
//                 break
//         }
//
//         baseQuery += orderBy
//
//         // ========== PAGINACIÓN ==========
//         const limitNum = Math.min(500, Math.max(10, parseInt(limit) || 100))
//         const offsetNum = Math.max(0, parseInt(offset) || 0)
//
//         baseQuery += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
//         params.push(limitNum, offsetNum)
//
//         // ========== EJECUTAR QUERIES ==========
//         console.log('🔍 Ejecutando query principal...')
//         const [inscripcionesResult, statsResult] = await Promise.all([
//             pool.query(baseQuery, params),
//             pool.query(countQuery, countParams)
//         ])
//
//         const inscripciones = inscripcionesResult.rows
//         const stats = statsResult.rows[0]
//
//         // ========== CALCULAR METADATA ==========
//         const totalRecords = parseInt(stats.total) || 0
//         const pendientes = parseInt(stats.pendientes) || 0
//         const habilitadas = parseInt(stats.habilitadas) || 0
//         const ingresosTotales = parseFloat(stats.ingresos_totales) || 0
//         const ingresosPendientes = parseFloat(stats.ingresos_pendientes) || 0
//
//         // ========== DETERMINAR SI HAY MÁS DATOS ==========
//         const hasMore = (offsetNum + inscripciones.length) < totalRecords
//         const nextOffset = hasMore ? offsetNum + limitNum : null
//
//         // ========== METADATA PARA LAZY LOADING ==========
//         const loadingMetadata = {
//             current_batch: {
//                 offset: offsetNum,
//                 limit: limitNum,
//                 returned: inscripciones.length
//             },
//             next_batch: hasMore ? {
//                 offset: nextOffset,
//                 limit: limitNum,
//                 estimated_size: Math.min(limitNum, totalRecords - nextOffset)
//             } : null,
//             progress: {
//                 loaded: offsetNum + inscripciones.length,
//                 total: totalRecords,
//                 percentage: totalRecords > 0 ? Math.round(((offsetNum + inscripciones.length) / totalRecords) * 100) : 100
//             },
//             priority_info: {
//                 current_priority: priority,
//                 pendientes_loaded: priority === 'pending' ?
//                     Math.min(pendientes, offsetNum + inscripciones.length) : 'unknown',
//                 total_pendientes: pendientes
//             }
//         }
//
//         // ========== RESPUESTA OPTIMIZADA ==========
//         const response = {
//             success: true,
//             data: {
//                 inscripciones,
//                 statistics: {
//                     total_inscripciones: totalRecords,
//                     pendientes,
//                     habilitadas,
//                     rechazadas: totalRecords - pendientes - habilitadas,
//                     ingresos_totales: ingresosTotales,
//                     ingresos_pendientes: ingresosPendientes
//                 },
//                 lazy_loading: loadingMetadata,
//                 filters_applied: {
//                     search: search || null,
//                     curso: curso || null,
//                     estado: estado || null,
//                     fecha_desde: fechaDesde || null,
//                     fecha_hasta: fechaHasta || null,
//                     priority
//                 }
//             },
//             message: hasMore ?
//                 `Cargados ${inscripciones.length} registros. ${loadingMetadata.progress.loaded}/${totalRecords} total.` :
//                 `Todos los registros cargados: ${totalRecords} total.`
//         }
//
//         console.log(`✅ Respuesta enviada: ${inscripciones.length} registros, hasMore: ${hasMore}`)
//         res.json(response)
//
//     } catch (error) {
//         console.error('❌ Error obteniendo inscripciones:', error)
//         res.status(500).json({
//             success: false,
//             message: 'Error interno del servidor',
//             debug: process.env.NODE_ENV === 'development' ? {
//                 error: error.message,
//                 stack: error.stack
//             } : undefined
//         })
//     }
// }


const getAllEnrollments = async (req, res) => {
    try {
        const {
            priority = 'all', // Cambiar default a 'all' en lugar de 'pending'
            limit = null, // null = traer todos
            offset = null, // null = desde el inicio
            search = '',
            curso = '',
            estado = '',
            fechaDesde = '',
            fechaHasta = ''
        } = req.query

        console.log('📚 Obteniendo inscripciones:', { priority, limit, offset, search })

        // ========== QUERY BASE ==========
        let baseQuery = `
            SELECT i.*,
                   u.nombre_completo, u.email, u.nombre_usuario, u.telefono,
                   c.titulo as curso_titulo, c.precio, c.es_gratuito, c.slug,
                   admin.nombre_completo as aprobado_por_nombre,
                   CASE
                       WHEN c.es_gratuito = true THEN true
                       WHEN i.estado_pago = 'habilitado' AND i.acceso_activo = true THEN true
                       ELSE false
                   END as tiene_acceso_actual
            FROM inscripciones i
            JOIN perfiles_usuario u ON i.usuario_id = u.id
            JOIN cursos c ON i.curso_id = c.id
            LEFT JOIN perfiles_usuario admin ON i.habilitado_por = admin.id
            WHERE 1=1
        `

        let countQuery = `
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN i.estado_pago = 'pendiente' THEN 1 END) as pendientes,
                   COUNT(CASE WHEN i.estado_pago = 'habilitado' THEN 1 END) as habilitadas,
                   COUNT(CASE WHEN i.estado_pago = 'rechazado' THEN 1 END) as rechazadas,
                   COUNT(CASE WHEN i.estado_pago = 'habilitado' AND i.acceso_activo = true THEN 1 END) as accesos_activos,
                   COUNT(CASE WHEN i.estado_pago = 'habilitado' AND i.acceso_activo = false THEN 1 END) as accesos_inactivos,
                   SUM(CASE WHEN i.estado_pago = 'habilitado' AND NOT c.es_gratuito THEN c.precio ELSE 0 END) as ingresos_totales,
                   SUM(CASE WHEN i.estado_pago = 'pendiente' AND NOT c.es_gratuito THEN c.precio ELSE 0 END) as ingresos_pendientes
            FROM inscripciones i
            JOIN perfiles_usuario u ON i.usuario_id = u.id
            JOIN cursos c ON i.curso_id = c.id
            WHERE 1=1
        `

        const params = []
        const countParams = []
        let paramCount = 0

        // ========== APLICAR FILTROS ==========

        // Filtro por búsqueda
        if (search && search.trim()) {
            paramCount++
            const searchCondition = ` AND (
                u.nombre_completo ILIKE $${paramCount} OR 
                u.email ILIKE $${paramCount} OR 
                u.nombre_usuario ILIKE $${paramCount} OR
                c.titulo ILIKE $${paramCount}
            )`
            baseQuery += searchCondition
            countQuery += searchCondition

            const searchParam = `%${search.trim()}%`
            params.push(searchParam)
            countParams.push(searchParam)
        }

        // Filtro por curso
        if (curso && curso.trim()) {
            paramCount++
            const cursoCondition = ` AND c.titulo ILIKE $${paramCount}`
            baseQuery += cursoCondition
            countQuery += cursoCondition

            const cursoParam = `%${curso.trim()}%`
            params.push(cursoParam)
            countParams.push(cursoParam)
        }

        // Filtro por estado
        if (estado && estado.trim()) {
            paramCount++
            const estadoCondition = ` AND i.estado_pago = $${paramCount}`
            baseQuery += estadoCondition
            countQuery += estadoCondition

            params.push(estado.trim())
            countParams.push(estado.trim())
        }

        // Filtro por fechas
        if (fechaDesde && fechaDesde.trim()) {
            paramCount++
            const fechaDesdeCondition = ` AND i.fecha_inscripcion >= $${paramCount}`
            baseQuery += fechaDesdeCondition
            countQuery += fechaDesdeCondition

            params.push(fechaDesde.trim())
            countParams.push(fechaDesde.trim())
        }

        if (fechaHasta && fechaHasta.trim()) {
            paramCount++
            const fechaHastaCondition = ` AND i.fecha_inscripcion <= $${paramCount}`
            baseQuery += fechaHastaCondition
            countQuery += fechaHastaCondition

            params.push(fechaHasta.trim())
            countParams.push(fechaHasta.trim())
        }

        // ========== ORDENAMIENTO SEGÚN PRIORIDAD ==========
        let orderBy = ''

        switch (priority) {
            case 'pending':
                // PRIORIDAD 1: Pendientes primero, luego los más recientes
                orderBy = ` ORDER BY 
                    CASE WHEN i.estado_pago = 'pendiente' THEN 0 ELSE 1 END,
                    i.fecha_inscripcion DESC`
                break

            case 'recent':
                // PRIORIDAD 2: Más recientes primero
                orderBy = ` ORDER BY i.fecha_inscripcion DESC`
                break

            case 'all':
            default:
                // PRIORIDAD 3: Pendientes, luego habilitados, luego por fecha
                orderBy = ` ORDER BY 
                    CASE 
                        WHEN i.estado_pago = 'pendiente' THEN 0 
                        WHEN i.estado_pago = 'habilitado' THEN 1 
                        ELSE 2 
                    END,
                    i.fecha_inscripcion DESC`
                break
        }

        baseQuery += orderBy

        // ========== PAGINACIÓN CONDICIONAL ==========
        // 🚨 CAMBIO PRINCIPAL: Solo aplicar paginación si se especifica limit y offset
        if (limit !== null && offset !== null) {
            const limitNum = Math.min(500, Math.max(10, parseInt(limit) || 100))
            const offsetNum = Math.max(0, parseInt(offset) || 0)

            baseQuery += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
            params.push(limitNum, offsetNum)

            console.log(`🔍 Ejecutando query con paginación: LIMIT ${limitNum} OFFSET ${offsetNum}`)
        } else {
            console.log('🔍 Ejecutando query SIN paginación (todos los registros)')
        }

        // ========== EJECUTAR QUERIES ==========
        const [inscripcionesResult, statsResult] = await Promise.all([
            pool.query(baseQuery, params),
            pool.query(countQuery, countParams)
        ])

        const inscripciones = inscripcionesResult.rows
        const stats = statsResult.rows[0]

        // ========== CALCULAR METADATA ==========
        const totalRecords = parseInt(stats.total) || 0
        const pendientes = parseInt(stats.pendientes) || 0
        const habilitadas = parseInt(stats.habilitadas) || 0
        const rechazadas = parseInt(stats.rechazadas) || 0
        const accesosActivos = parseInt(stats.accesos_activos) || 0
        const accesosInactivos = parseInt(stats.accesos_inactivos) || 0
        const ingresosTotales = parseFloat(stats.ingresos_totales) || 0
        const ingresosPendientes = parseFloat(stats.ingresos_pendientes) || 0

        // ========== RESPUESTA SIMPLIFICADA PARA TODOS LOS DATOS ==========
        if (limit === null && offset === null) {
            // Modo: TODOS LOS DATOS (para el frontend)
            console.log(`✅ Enviando TODOS los registros: ${inscripciones.length}/${totalRecords}`)

            const response = {
                success: true,
                data: {
                    inscripciones,
                    statistics: {
                        total_inscripciones: totalRecords,
                        pendientes,
                        habilitadas,
                        rechazadas,
                        accesos_activos: accesosActivos,
                        accesos_inactivos: accesosInactivos,
                        ingresos_totales: ingresosTotales,
                        ingresos_pendientes: ingresosPendientes
                    }
                },
                message: `Todos los registros cargados: ${totalRecords} total.`
            }

            return res.json(response)
        }

        // ========== MODO PAGINADO (legacy) ==========
        const limitNum = Math.min(500, Math.max(10, parseInt(limit) || 100))
        const offsetNum = Math.max(0, parseInt(offset) || 0)

        const hasMore = (offsetNum + inscripciones.length) < totalRecords
        const nextOffset = hasMore ? offsetNum + limitNum : null

        const loadingMetadata = {
            current_batch: {
                offset: offsetNum,
                limit: limitNum,
                returned: inscripciones.length
            },
            next_batch: hasMore ? {
                offset: nextOffset,
                limit: limitNum,
                estimated_size: Math.min(limitNum, totalRecords - nextOffset)
            } : null,
            progress: {
                loaded: offsetNum + inscripciones.length,
                total: totalRecords,
                percentage: totalRecords > 0 ? Math.round(((offsetNum + inscripciones.length) / totalRecords) * 100) : 100
            },
            priority_info: {
                current_priority: priority,
                pendientes_loaded: priority === 'pending' ?
                    Math.min(pendientes, offsetNum + inscripciones.length) : 'unknown',
                total_pendientes: pendientes
            }
        }

        const response = {
            success: true,
            data: {
                inscripciones,
                statistics: {
                    total_inscripciones: totalRecords,
                    pendientes,
                    habilitadas,
                    rechazadas,
                    accesos_activos: accesosActivos,
                    accesos_inactivos: accesosInactivos,
                    ingresos_totales: ingresosTotales,
                    ingresos_pendientes: ingresosPendientes
                },
                lazy_loading: loadingMetadata,
                filters_applied: {
                    search: search || null,
                    curso: curso || null,
                    estado: estado || null,
                    fecha_desde: fechaDesde || null,
                    fecha_hasta: fechaHasta || null,
                    priority
                }
            },
            message: hasMore ?
                `Cargados ${inscripciones.length} registros. ${loadingMetadata.progress.loaded}/${totalRecords} total.` :
                `Todos los registros cargados: ${totalRecords} total.`
        }

        console.log(`✅ Respuesta paginada enviada: ${inscripciones.length} registros, hasMore: ${hasMore}`)
        res.json(response)

    } catch (error) {
        console.error('❌ Error obteniendo inscripciones:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            debug: process.env.NODE_ENV === 'development' ? {
                error: error.message,
                stack: error.stack
            } : undefined
        })
    }
}


// =============================================
// MÉTODO AUXILIAR: OBTENER SOLO ESTADÍSTICAS RÁPIDAS
// =============================================
const getEnrollmentStats = async (req, res) => {
    try {
        console.log('📊 Obteniendo estadísticas rápidas...')

        const statsQuery = `
            SELECT 
                COUNT(*) as total_inscripciones,
                COUNT(CASE WHEN estado_pago = 'pendiente' THEN 1 END) as pendientes,
                COUNT(CASE WHEN estado_pago = 'habilitado' THEN 1 END) as habilitadas,
                COUNT(CASE WHEN estado_pago NOT IN ('pendiente', 'habilitado') THEN 1 END) as otras,
                COUNT(CASE WHEN c.es_gratuito = true THEN 1 END) as gratuitas,
                COUNT(CASE WHEN c.es_gratuito = false THEN 1 END) as pagadas,
                SUM(CASE WHEN estado_pago = 'habilitado' AND c.es_gratuito = false THEN c.precio ELSE 0 END) as ingresos_confirmados,
                SUM(CASE WHEN estado_pago = 'pendiente' AND c.es_gratuito = false THEN c.precio ELSE 0 END) as ingresos_pendientes,
                MAX(fecha_inscripcion) as ultima_inscripcion
            FROM inscripciones i
            JOIN cursos c ON i.curso_id = c.id
        `

        const result = await pool.query(statsQuery)
        const stats = result.rows[0]

        res.json({
            success: true,
            data: {
                total_inscripciones: parseInt(stats.total_inscripciones) || 0,
                pendientes: parseInt(stats.pendientes) || 0,
                habilitadas: parseInt(stats.habilitadas) || 0,
                otras: parseInt(stats.otras) || 0,
                gratuitas: parseInt(stats.gratuitas) || 0,
                pagadas: parseInt(stats.pagadas) || 0,
                ingresos_confirmados: parseFloat(stats.ingresos_confirmados) || 0,
                ingresos_pendientes: parseFloat(stats.ingresos_pendientes) || 0,
                ultima_inscripcion: stats.ultima_inscripcion,
                resumen: {
                    tasa_conversion: stats.total_inscripciones > 0 ?
                        Math.round((parseInt(stats.habilitadas) / parseInt(stats.total_inscripciones)) * 100) : 0,
                    inscripciones_hoy: 'Por implementar', // Agregar filtro de fecha si es necesario
                    cursos_con_inscripciones: 'Por implementar' // Query adicional si es necesario
                }
            }
        })

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error)
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas'
        })
    }
}




// =============================================
// VERIFICAR ACCESO A CURSO
// =============================================
// const checkCourseAccess = async (req, res) => {
//     try {
//         const { cursoId } = req.params
//         const userId = req.user.id
//
//         const result = await pool.query(
//             `SELECT c.es_gratuito, i.estado_pago, i.fecha_habilitacion
//              FROM cursos c
//                       LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
//              WHERE c.id = $2 AND c.activo = true`,
//             [userId, cursoId]
//         )
//
//         if (result.rows.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Curso no encontrado'
//             })
//         }
//
//         const curso = result.rows[0]
//         const tieneAcceso = curso.es_gratuito || curso.estado_pago === 'habilitado'
//
//         res.json({
//             success: true,
//             data: {
//                 tieneAcceso,
//                 esGratuito: curso.es_gratuito,
//                 estadoPago: curso.estado_pago || 'no_inscrito',
//                 fechaHabilitacion: curso.fecha_habilitacion
//             }
//         })
//
//     } catch (error) {
//         console.error('Error verificando acceso:', error)
//         res.status(500).json({
//             success: false,
//             message: 'Error interno del servidor'
//         })
//     }
// }

// =============================================
// VERIFICAR ACCESO A CURSO - CORREGIDO
// =============================================
const checkCourseAccess = async (req, res) => {
    try {
        const { cursoId } = req.params
        const userId = req.user.id

        console.log('🔍 Verificando acceso para:', { userId, cursoId })

        const result = await pool.query(
            `SELECT c.es_gratuito, i.estado_pago, i.acceso_activo, i.fecha_habilitacion
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

        console.log('📚 Datos del curso:', {
            es_gratuito: curso.es_gratuito,
            estado_pago: curso.estado_pago,
            acceso_activo: curso.acceso_activo,
            fecha_habilitacion: curso.fecha_habilitacion
        })

        // ✅ NUEVA LÓGICA: Validar estado_pago Y acceso_activo
        const tieneAcceso = curso.es_gratuito ||
            (curso.estado_pago === 'habilitado' && curso.acceso_activo === true)

        // Determinar si está inscrito (tiene cualquier estado de pago)
        const estaInscrito = curso.estado_pago !== null && curso.estado_pago !== undefined

        // Determinar el estado para el frontend
        let estadoParaFrontend = 'no_inscrito'
        if (curso.estado_pago) {
            // Normalizar estados para el frontend
            if (curso.estado_pago === 'habilitado') {
                estadoParaFrontend = curso.acceso_activo ? 'habilitado' : 'inactivo'
            } else if (curso.estado_pago === 'pendiente') {
                estadoParaFrontend = 'pendiente'
            } else if (curso.estado_pago === 'rechazado') {
                estadoParaFrontend = 'rechazado'
            } else {
                estadoParaFrontend = curso.estado_pago
            }
        }

        const response = {
            success: true,
            data: {
                tieneAcceso,
                esGratuito: curso.es_gratuito,
                estadoPago: estadoParaFrontend,
                accesoActivo: curso.acceso_activo,  // ✅ NUEVO
                fechaHabilitacion: curso.fecha_habilitacion,
                inscrito: estaInscrito
            }
        }

        console.log('🎯 Respuesta final:', response.data)

        res.json(response)

    } catch (error) {
        console.error('Error verificando acceso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            debug: {
                error: error.message,
                userId,
                cursoId
            }
        })
    }
}

// =============================================
// DESACTIVAR ACCESO (INDIVIDUAL O BULK)
// =============================================
const suspendAccess = async (req, res) => {
    try {
        const { inscripcionIds } = req.body
        const adminId = req.user.id

        if (!inscripcionIds || inscripcionIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Debes proporcionar al menos una inscripción'
            })
        }

        const ids = Array.isArray(inscripcionIds) ? inscripcionIds : [inscripcionIds]

        // Obtener información antes de suspender
        const infoResult = await pool.query(
            `SELECT i.id, u.nombre_completo, c.titulo, i.estado_pago, i.acceso_activo
             FROM inscripciones i
             JOIN perfiles_usuario u ON i.usuario_id = u.id
             JOIN cursos c ON i.curso_id = c.id
             WHERE i.id = ANY($1) AND i.estado_pago = 'habilitado' AND i.acceso_activo = true`,
            [ids]
        )

        if (infoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron inscripciones activas para suspender'
            })
        }

        // Suspender acceso (solo cambiar acceso_activo, estado_pago NO cambia)
        const result = await pool.query(
            `UPDATE inscripciones
             SET acceso_activo = false
             WHERE id = ANY($1) AND estado_pago = 'habilitado' AND acceso_activo = true
             RETURNING *`,
            [ids]
        )

        const suspendidos = infoResult.rows.map(r =>
            `${r.nombre_completo} - ${r.titulo}`
        ).join(', ')

        res.json({
            success: true,
            message: `${result.rows.length} acceso(s) desactivado(s): ${suspendidos}. El historial de pago se mantiene.`,
            data: {
                suspendidos: result.rows,
                total: result.rows.length
            }
        })

    } catch (error) {
        console.error('Error suspendiendo acceso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// REACTIVAR ACCESO (INDIVIDUAL O BULK)
// =============================================
const reactivateAccess = async (req, res) => {
    try {
        const { inscripcionIds } = req.body
        const adminId = req.user.id

        if (!inscripcionIds || inscripcionIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Debes proporcionar al menos una inscripción'
            })
        }

        const ids = Array.isArray(inscripcionIds) ? inscripcionIds : [inscripcionIds]

        // Obtener información antes de reactivar
        const infoResult = await pool.query(
            `SELECT i.id, u.nombre_completo, c.titulo, i.estado_pago, i.acceso_activo
             FROM inscripciones i
             JOIN perfiles_usuario u ON i.usuario_id = u.id
             JOIN cursos c ON i.curso_id = c.id
             WHERE i.id = ANY($1) AND i.estado_pago = 'habilitado' AND i.acceso_activo = false`,
            [ids]
        )

        if (infoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron inscripciones inactivas para reactivar'
            })
        }

        // Reactivar acceso
        const result = await pool.query(
            `UPDATE inscripciones
             SET acceso_activo = true
             WHERE id = ANY($1) AND estado_pago = 'habilitado' AND acceso_activo = false
             RETURNING *`,
            [ids]
        )

        const reactivados = infoResult.rows.map(r =>
            `${r.nombre_completo} - ${r.titulo}`
        ).join(', ')

        res.json({
            success: true,
            message: `${result.rows.length} acceso(s) reactivado(s): ${reactivados}`,
            data: {
                reactivados: result.rows,
                total: result.rows.length
            }
        })

    } catch (error) {
        console.error('Error reactivando acceso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CERRAR TEMPORADA DE UN CURSO (desactivar todos)
// =============================================
const closeCourseSeason = async (req, res) => {
    try {
        const { cursoId } = req.params
        const adminId = req.user.id

        // Verificar que el curso existe
        const cursoResult = await pool.query(
            'SELECT titulo FROM cursos WHERE id = $1',
            [cursoId]
        )

        if (cursoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        const curso = cursoResult.rows[0]

        // Suspender todos los accesos habilitados del curso
        const result = await pool.query(
            `UPDATE inscripciones
             SET acceso_activo = false
             WHERE curso_id = $1 AND estado_pago = 'habilitado' AND acceso_activo = true
             RETURNING *`,
            [cursoId]
        )

        res.json({
            success: true,
            message: `Temporada cerrada: ${result.rows.length} acceso(s) desactivado(s) del curso "${curso.titulo}". Los usuarios pueden re-solicitar.`,
            data: {
                curso: curso.titulo,
                total_desactivados: result.rows.length,
                desactivados: result.rows
            }
        })

    } catch (error) {
        console.error('Error cerrando temporada:', error)
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
    getAllEnrollments,
    getEnrollmentStats,
    suspendAccess,
    reactivateAccess,
    closeCourseSeason
}