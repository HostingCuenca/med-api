
// controllers/materialesController.js - CÓDIGO COMPLETO 100%
const pool = require('../config/database')

// =============================================
// OBTENER MATERIALES POR CURSO (igual que simulacros)
// =============================================
const getMaterialesByCourse = async (req, res) => {
    try {
        const { cursoId } = req.params
        const userId = req.user?.id || null

        console.log('Debug - userId:', userId, 'cursoId:', cursoId)

        // Verificar que el curso existe (MISMO PATRÓN que simulacros)
        const cursoCheck = await pool.query(
            'SELECT titulo, es_gratuito FROM cursos WHERE id = $1 AND activo = true',
            [cursoId]
        )

        if (cursoCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        // Query principal siguiendo patrón de simulacros
        const result = await pool.query(
            `SELECT m.*
            FROM materiales m 
            WHERE m.curso_id = $1 AND (m.tipo_material = 'curso' OR m.tipo_material IS NULL)
            ORDER BY m.fecha_creacion DESC`,
            [cursoId]
        )

        const materiales = result.rows.map(row => ({
            ...row,
            precio: parseFloat(row.precio) || 0,
            es_gratuito: row.es_gratuito || false,
            creado_por_nombre: 'Administrador',
            tipo_display: getTipoMaterialDisplay(row.tipo_material || 'curso')
        }))

        res.json({
            success: true,
            data: {
                materiales,
                curso: cursoCheck.rows[0],
                estadisticas: {
                    total_materiales: materiales.length,
                    gratuitos: materiales.filter(m => m.es_gratuito).length,
                    de_pago: materiales.filter(m => !m.es_gratuito).length
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo materiales:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// MARKETPLACE PÚBLICO - MATERIALES LIBRES
// =============================================
const getMarketplaceMaterials = async (req, res) => {
    try {
        const { categoria, tipo, page = 1, limit = 12, search } = req.query

        console.log('📚 Obteniendo marketplace:', { categoria, tipo, page, search })

        let query = `
            SELECT m.*, 
                'admin' as autor,
                CASE 
                    WHEN c.id IS NOT NULL THEN c.titulo 
                    ELSE 'Material Independiente'
                END as curso_titulo
            FROM materiales m
            LEFT JOIN cursos c ON m.curso_id = c.id
            WHERE m.visible_publico = true 
                AND (m.tipo_material = 'libre' OR m.tipo_material = 'premium')
        `
        const params = []
        let paramCount = 0

        // Filtros dinámicos
        if (categoria && categoria.trim() !== '') {
            paramCount++
            query += ` AND m.categoria = $${paramCount}`
            params.push(categoria)
        }

        if (tipo && tipo.trim() !== '') {
            paramCount++
            query += ` AND m.tipo_material = $${paramCount}`
            params.push(tipo)
        }

        if (search && search.trim() !== '') {
            paramCount++
            query += ` AND (m.titulo ILIKE $${paramCount} OR m.descripcion ILIKE $${paramCount})`
            params.push(`%${search}%`)
        }

        query += ' ORDER BY m.fecha_creacion DESC'

        // Paginación
        const pageNum = Math.max(1, parseInt(page) || 1)
        const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12))
        const offset = (pageNum - 1) * limitNum

        query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
        params.push(limitNum, offset)

        const result = await pool.query(query, params)

        // Query para contar total
        let countQuery = `
            SELECT COUNT(*) as total
            FROM materiales m
            WHERE m.visible_publico = true 
                AND (m.tipo_material = 'libre' OR m.tipo_material = 'premium')
        `
        const countParams = []
        let countParamCount = 0

        if (categoria && categoria.trim() !== '') {
            countParamCount++
            countQuery += ` AND m.categoria = $${countParamCount}`
            countParams.push(categoria)
        }

        if (tipo && tipo.trim() !== '') {
            countParamCount++
            countQuery += ` AND m.tipo_material = $${countParamCount}`
            countParams.push(tipo)
        }

        if (search && search.trim() !== '') {
            countParamCount++
            countQuery += ` AND (m.titulo ILIKE $${countParamCount} OR m.descripcion ILIKE $${countParamCount})`
            countParams.push(`%${search}%`)
        }

        const countResult = await pool.query(countQuery, countParams)
        const totalRecords = parseInt(countResult.rows[0].total) || 0

        // Obtener categorías disponibles
        const categoriasResult = await pool.query(
            `SELECT categoria, COUNT(*) as cantidad 
             FROM materiales 
             WHERE visible_publico = true AND categoria IS NOT NULL
             GROUP BY categoria 
             ORDER BY cantidad DESC`
        )

        const materiales = result.rows.map(row => ({
            ...row,
            precio: parseFloat(row.precio) || 0,
            tipo_display: getTipoMaterialDisplay(row.tipo_material),
            archivo_extension: getFileExtension(row.archivo_url),
            puede_descargar: row.tipo_material === 'libre'
        }))

        res.json({
            success: true,
            data: {
                materiales,
                categorias_disponibles: categoriasResult.rows,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total_records: totalRecords,
                    total_pages: Math.ceil(totalRecords / limitNum),
                    has_next: pageNum < Math.ceil(totalRecords / limitNum),
                    has_prev: pageNum > 1
                },
                filtros_aplicados: {
                    categoria: categoria || null,
                    tipo: tipo || null,
                    search: search || null
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo marketplace:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// DETALLE DE MATERIAL CON VERIFICACIÓN DE ACCESO
// =============================================
const getMaterialDetail = async (req, res) => {
    try {
        const { materialId } = req.params
        const userId = req.user?.id

        console.log('📄 Obteniendo detalle material:', materialId)

        // Query similar a simulacros
        const result = await pool.query(
            `SELECT m.*, 
                'admin' as autor,
                '' as autor_email,
                c.titulo as curso_titulo,
                c.es_gratuito as curso_gratuito,
                CASE
                    WHEN m.tipo_material IN ('libre', 'premium') THEN 'publico'
                    WHEN c.es_gratuito = true THEN 'habilitado'
                    WHEN i.estado_pago IS NULL THEN 'no_inscrito'
                    ELSE i.estado_pago
                END as estado_acceso
             FROM materiales m
             LEFT JOIN cursos c ON m.curso_id = c.id
             LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
             WHERE m.id = $2`,
            [userId, materialId]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Material no encontrado'
            })
        }

        const material = result.rows[0]

        // Verificar acceso según tipo de material
        let puedeAcceder = false
        let mensaje = ''

        if (material.tipo_material === 'libre') {
            puedeAcceder = true
            mensaje = 'Material gratuito disponible'
        } else if (material.tipo_material === 'premium') {
            puedeAcceder = false
            mensaje = 'Material premium - Contactar por WhatsApp para adquirir'
        } else if (material.tipo_material === 'curso' || !material.tipo_material) {
            // Material de curso - verificar inscripción
            if (material.estado_acceso === 'habilitado') {
                puedeAcceder = true
                mensaje = 'Acceso habilitado por inscripción al curso'
            } else if (material.estado_acceso === 'no_inscrito') {
                puedeAcceder = false
                mensaje = 'Debes inscribirte en el curso para acceder a este material'
            } else {
                puedeAcceder = false
                mensaje = 'Tu inscripción está pendiente de aprobación'
            }
        }

        res.json({
            success: true,
            data: {
                material: {
                    ...material,
                    precio: parseFloat(material.precio) || 0,
                    tipo_display: getTipoMaterialDisplay(material.tipo_material),
                    archivo_extension: getFileExtension(material.archivo_url),
                    stock_disponible: material.stock_disponible || -1
                },
                acceso: {
                    puede_acceder: puedeAcceder,
                    puede_descargar: puedeAcceder && material.tipo_material !== 'premium',
                    puede_comprar: material.tipo_material === 'premium',
                    mensaje,
                    estado_acceso: material.estado_acceso
                },
                autor: {
                    nombre: material.autor,
                    email: material.autor_email
                },
                curso: material.curso_titulo ? {
                    titulo: material.curso_titulo,
                    es_gratuito: material.curso_gratuito
                } : null
            }
        })

    } catch (error) {
        console.error('Error obteniendo detalle material:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// MIS MATERIALES (materiales de cursos inscritos)
// =============================================
// const getMisMateriales1 = async (req, res) => {
//     try {
//         const userId = req.user?.id
//
//         if (!userId) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Usuario no autenticado'
//             })
//         }
//
//         // SIGUIENDO LÓGICA DE SIMULACROS: JOIN con inscripciones
//         const result = await pool.query(
//             `SELECT m.*, c.titulo as curso_titulo,
//                 'admin' as autor,
//                 -- Verificar acceso igual que simulacros
//                 CASE
//                     WHEN c.es_gratuito = true THEN 'habilitado'
//                     WHEN i.estado_pago IS NULL THEN 'no_inscrito'
//                     ELSE i.estado_pago
//                 END as estado_acceso
//             FROM materiales m
//             JOIN cursos c ON m.curso_id = c.id
//             LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
//             WHERE (m.tipo_material = 'curso' OR m.tipo_material IS NULL)
//                 AND (c.es_gratuito = true OR i.estado_pago = 'habilitado')
//             ORDER BY m.fecha_creacion DESC`,
//             [userId]
//         )
//
//         const materiales = result.rows.map(row => ({
//             ...row,
//             precio: parseFloat(row.precio) || 0,
//             puede_acceder: row.estado_acceso === 'habilitado',
//             tipo_display: getTipoMaterialDisplay(row.tipo_material || 'curso'),
//             archivo_extension: getFileExtension(row.archivo_url)
//         }))
//
//         res.json({
//             success: true,
//             data: {
//                 materiales,
//                 estadisticas: {
//                     total: materiales.length,
//                     por_curso: materiales.reduce((acc, material) => {
//                         acc[material.curso_titulo] = (acc[material.curso_titulo] || 0) + 1
//                         return acc
//                     }, {}),
//                     accesibles: materiales.filter(m => m.puede_acceder).length
//                 }
//             }
//         })
//
//     } catch (error) {
//         console.error('Error obteniendo mis materiales:', error)
//         res.status(500).json({
//             success: false,
//             message: 'Error interno del servidor'
//         })
//     }
// }

// =============================================
// MIS MATERIALES - VERSIÓN MODIFICADA (SOLO CURSOS INSCRITOS)
// =============================================
const getMisMateriales = async (req, res) => {
    try {
        const userId = req.user?.id

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        console.log('📚 Obteniendo MIS materiales (solo cursos inscritos):', userId)

        // QUERY MODIFICADA: SOLO materiales de cursos donde REALMENTE está inscrito y habilitado
        const result = await pool.query(
            `SELECT m.*, c.titulo as curso_titulo, c.es_gratuito as curso_gratuito,
                'admin' as autor,
                i.estado_pago,
                i.fecha_inscripcion,
                i.fecha_habilitacion,
                -- Estado de acceso más estricto
                CASE
                    WHEN i.estado_pago = 'habilitado' THEN 'habilitado'
                    WHEN i.estado_pago = 'pendiente' THEN 'pendiente'
                    WHEN i.estado_pago = 'pagado' THEN 'habilitado'
                    ELSE 'sin_acceso'
                END as estado_acceso
            FROM materiales m
            JOIN cursos c ON m.curso_id = c.id
            -- ✅ CAMBIO CLAVE: INNER JOIN en lugar de LEFT JOIN
            -- Esto garantiza que SOLO se muestren materiales de cursos inscritos
            INNER JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
            WHERE (m.tipo_material = 'curso' OR m.tipo_material IS NULL)
                -- ✅ CONDICIÓN MÁS ESTRICTA: Solo cursos con pago habilitado
                AND i.estado_pago IN ('habilitado', 'pagado')
            ORDER BY m.fecha_creacion DESC`,
            [userId]
        )

        const materiales = result.rows.map(row => ({
            ...row,
            precio: parseFloat(row.precio) || 0,
            puede_acceder: row.estado_acceso === 'habilitado',
            tipo_display: getTipoMaterialDisplay(row.tipo_material || 'curso'),
            archivo_extension: getFileExtension(row.archivo_url),
            // Información adicional de la inscripción
            inscripcion: {
                estado_pago: row.estado_pago,
                fecha_inscripcion: row.fecha_inscripcion,
                fecha_habilitacion: row.fecha_habilitacion,
                curso_gratuito: row.curso_gratuito
            }
        }))

        // Obtener estadísticas de inscripciones del usuario
        const inscripcionesStats = await pool.query(
            `SELECT 
                COUNT(*) as total_inscripciones,
                COUNT(CASE WHEN estado_pago = 'habilitado' THEN 1 END) as habilitadas,
                COUNT(CASE WHEN estado_pago = 'pendiente' THEN 1 END) as pendientes,
                COUNT(CASE WHEN estado_pago = 'pagado' THEN 1 END) as pagadas
            FROM inscripciones 
            WHERE usuario_id = $1`,
            [userId]
        )

        const stats = inscripcionesStats.rows[0]

        res.json({
            success: true,
            data: {
                materiales,
                estadisticas: {
                    total_materiales: materiales.length,
                    por_curso: materiales.reduce((acc, material) => {
                        acc[material.curso_titulo] = (acc[material.curso_titulo] || 0) + 1
                        return acc
                    }, {}),
                    accesibles: materiales.filter(m => m.puede_acceder).length,
                    // ✅ NUEVA: Estadísticas de inscripciones
                    inscripciones: {
                        total: parseInt(stats.total_inscripciones) || 0,
                        habilitadas: parseInt(stats.habilitadas) || 0,
                        pendientes: parseInt(stats.pendientes) || 0,
                        pagadas: parseInt(stats.pagadas) || 0
                    }
                },
                mensaje: materiales.length === 0 ?
                    'No tienes materiales disponibles. Inscríbete en cursos para acceder a contenido.' :
                    `Tienes acceso a ${materiales.length} materiales de tus cursos inscritos.`
            }
        })

    } catch (error) {
        console.error('Error obteniendo mis materiales:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// MÉTODO ALTERNATIVO: MIS MATERIALES + LIBRES
// =============================================
const getMisMaterialesCompleto = async (req, res) => {
    try {
        const userId = req.user?.id

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        console.log('📚 Obteniendo TODOS mis materiales (cursos + libres):', userId)

        // Query combinada: materiales de cursos inscritos + materiales libres
        const result = await pool.query(
            `-- Materiales de cursos inscritos
            SELECT m.*, c.titulo as curso_titulo, c.es_gratuito as curso_gratuito,
                'admin' as autor,
                i.estado_pago,
                'curso_inscrito' as fuente_acceso,
                CASE
                    WHEN i.estado_pago IN ('habilitado', 'pagado') THEN 'habilitado'
                    ELSE 'sin_acceso'
                END as estado_acceso
            FROM materiales m
            JOIN cursos c ON m.curso_id = c.id
            INNER JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
            WHERE (m.tipo_material = 'curso' OR m.tipo_material IS NULL)
                AND i.estado_pago IN ('habilitado', 'pagado')

            UNION ALL

            -- Materiales libres (disponibles para todos)
            SELECT m.*, 
                COALESCE(c.titulo, 'Material Independiente') as curso_titulo,
                COALESCE(c.es_gratuito, true) as curso_gratuito,
                'admin' as autor,
                NULL as estado_pago,
                'material_libre' as fuente_acceso,
                'habilitado' as estado_acceso
            FROM materiales m
            LEFT JOIN cursos c ON m.curso_id = c.id
            WHERE m.tipo_material = 'libre' 
                AND m.visible_publico = true

            ORDER BY fecha_creacion DESC`,
            [userId]
        )

        const materiales = result.rows.map(row => ({
            ...row,
            precio: parseFloat(row.precio) || 0,
            puede_acceder: row.estado_acceso === 'habilitado',
            tipo_display: getTipoMaterialDisplay(row.tipo_material || 'curso'),
            archivo_extension: getFileExtension(row.archivo_url)
        }))

        // Separar por tipo de acceso
        const materialesCursos = materiales.filter(m => m.fuente_acceso === 'curso_inscrito')
        const materialesLibres = materiales.filter(m => m.fuente_acceso === 'material_libre')

        res.json({
            success: true,
            data: {
                materiales: {
                    todos: materiales,
                    de_cursos_inscritos: materialesCursos,
                    libres: materialesLibres
                },
                estadisticas: {
                    total_materiales: materiales.length,
                    de_cursos: materialesCursos.length,
                    libres: materialesLibres.length,
                    por_curso: materialesCursos.reduce((acc, material) => {
                        acc[material.curso_titulo] = (acc[material.curso_titulo] || 0) + 1
                        return acc
                    }, {})
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo materiales completos:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}


// =============================================
// CREAR MATERIAL (ADMIN/INSTRUCTOR)
// =============================================
const createMaterial = async (req, res) => {
    try {
        const userId = req.user?.id
        const {
            titulo, descripcion, archivoUrl, tipoArchivo, precio = 0,
            esGratuito = false, cursoId = null, tipoMaterial = 'curso',
            categoria = null, stockDisponible = -1, visiblePublico = false,
            imagenUrl = null
        } = req.body

        console.log('➕ Creando material:', { titulo, tipoMaterial, cursoId })

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        if (!titulo || !archivoUrl) {
            return res.status(400).json({
                success: false,
                message: 'Título y archivo URL son requeridos'
            })
        }

        // Verificar permisos si es material de curso
        if (cursoId) {
            const permisoCheck = await pool.query(
                `SELECT u.tipo_usuario, c.instructor_id 
                 FROM perfiles_usuario u, cursos c 
                 WHERE u.id = $1 AND c.id = $2`,
                [userId, cursoId]
            )

            if (permisoCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Curso no encontrado'
                })
            }

            const { tipo_usuario, instructor_id } = permisoCheck.rows[0]
            const puedeCrear = tipo_usuario === 'admin' || instructor_id === userId

            if (!puedeCrear) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para crear materiales en este curso'
                })
            }
        } else {
            // Solo admin puede crear materiales independientes
            const userCheck = await pool.query(
                'SELECT tipo_usuario FROM perfiles_usuario WHERE id = $1',
                [userId]
            )

            if (userCheck.rows[0]?.tipo_usuario !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Solo administradores pueden crear materiales independientes'
                })
            }
        }

        // Crear material
        const result = await pool.query(
            `INSERT INTO materiales 
             (titulo, descripcion, archivo_url, tipo_archivo, precio, es_gratuito, 
              curso_id, tipo_material, categoria, stock_disponible, visible_publico, 
              imagen_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [titulo, descripcion, archivoUrl, tipoArchivo, precio, esGratuito,
                cursoId, tipoMaterial, categoria, stockDisponible, visiblePublico,
                imagenUrl]
        )

        console.log('✅ Material creado exitosamente:', result.rows[0].id)

        res.status(201).json({
            success: true,
            message: 'Material creado exitosamente',
            data: { material: result.rows[0] }
        })

    } catch (error) {
        console.error('Error creando material:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ACTUALIZAR MATERIAL (ADMIN/INSTRUCTOR)
// =============================================
const updateMaterial = async (req, res) => {
    try {
        const { materialId } = req.params
        const userId = req.user?.id
        const {
            titulo, descripcion, archivoUrl, tipoArchivo, precio,
            esGratuito, tipoMaterial, categoria, stockDisponible,
            visiblePublico, imagenUrl
        } = req.body

        console.log('✏️ Actualizando material:', materialId)

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        // Verificar que el material existe
        const materialCheck = await pool.query(
            'SELECT * FROM materiales WHERE id = $1',
            [materialId]
        )

        if (materialCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Material no encontrado'
            })
        }

        const material = materialCheck.rows[0]

        // Verificar permisos
        if (material.curso_id) {
            // Material de curso - verificar permisos
            const permisoCheck = await pool.query(
                `SELECT u.tipo_usuario, c.instructor_id
                 FROM perfiles_usuario u, cursos c
                 WHERE u.id = $1 AND c.id = $2`,
                [userId, material.curso_id]
            )

            if (permisoCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para editar este material'
                })
            }

            const { tipo_usuario, instructor_id } = permisoCheck.rows[0]
            const puedeEditar = tipo_usuario === 'admin' || instructor_id === userId

            if (!puedeEditar) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para editar materiales de este curso'
                })
            }
        } else {
            // Material independiente - solo admin
            const userCheck = await pool.query(
                'SELECT tipo_usuario FROM perfiles_usuario WHERE id = $1',
                [userId]
            )

            if (userCheck.rows[0]?.tipo_usuario !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Solo administradores pueden editar materiales independientes'
                })
            }
        }

        // Construir query dinámico solo con campos que se envían
        const updates = []
        const values = []
        let paramCount = 0

        const fieldsToUpdate = {
            titulo,
            descripcion,
            archivo_url: archivoUrl,
            tipo_archivo: tipoArchivo,
            precio,
            es_gratuito: esGratuito,
            tipo_material: tipoMaterial,
            categoria,
            stock_disponible: stockDisponible,
            visible_publico: visiblePublico,
            imagen_url: imagenUrl
        }

        // Solo actualizar campos que se enviaron
        Object.entries(fieldsToUpdate).forEach(([key, value]) => {
            if (value !== undefined) {
                paramCount++
                updates.push(`${key} = $${paramCount}`)
                values.push(value)
            }
        })

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se enviaron campos para actualizar'
            })
        }

        // Solo actualizar fecha_creacion si es necesario (comentado por ahora)
        // paramCount++
        // updates.push(`fecha_actualizacion = ${paramCount}`)
        // values.push(new Date())

        // Agregar ID del material al final
        paramCount++
        values.push(materialId)

        const query = `
            UPDATE materiales
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
                RETURNING *
        `

        const result = await pool.query(query, values)

        console.log('✅ Material actualizado exitosamente:', materialId)

        res.json({
            success: true,
            message: 'Material actualizado exitosamente',
            data: {
                material: {
                    ...result.rows[0],
                    precio: parseFloat(result.rows[0].precio) || 0,
                    tipo_display: getTipoMaterialDisplay(result.rows[0].tipo_material),
                    archivo_extension: getFileExtension(result.rows[0].archivo_url)
                }
            }
        })

    } catch (error) {
        console.error('Error actualizando material:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CARRITO SIMBÓLICO - AGREGAR ITEM
// =============================================
const addToCart = async (req, res) => {
    try {
        const { materialId, cantidad = 1, sessionId } = req.body
        const userId = req.user?.id || null

        console.log('🛒 Agregando al carrito:', { materialId, cantidad, sessionId, userId })

        if (!materialId) {
            return res.status(400).json({
                success: false,
                message: 'Material ID es requerido'
            })
        }

        if (!userId && !sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID es requerido para usuarios no logueados'
            })
        }

        // Verificar que el material existe y es premium
        const materialCheck = await pool.query(
            'SELECT id, titulo, precio, tipo_material, stock_disponible FROM materiales WHERE id = $1',
            [materialId]
        )

        if (materialCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Material no encontrado'
            })
        }

        const material = materialCheck.rows[0]

        if (material.tipo_material !== 'premium') {
            return res.status(400).json({
                success: false,
                message: 'Solo materiales premium pueden agregarse al carrito'
            })
        }

        // Verificar stock si no es ilimitado
        if (material.stock_disponible !== -1 && material.stock_disponible < cantidad) {
            return res.status(400).json({
                success: false,
                message: `Stock insuficiente. Disponible: ${material.stock_disponible}`
            })
        }

        // Agregar o actualizar en carrito
        const result = await pool.query(
            `INSERT INTO carrito_temporal (session_id, usuario_id, material_id, cantidad)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (COALESCE(usuario_id::text, session_id), material_id)
             DO UPDATE SET cantidad = carrito_temporal.cantidad + EXCLUDED.cantidad, fecha_agregado = CURRENT_TIMESTAMP
             RETURNING *`,
            [sessionId, userId, materialId, cantidad]
        )

        // Obtener total del carrito
        const cartTotal = await getCartTotal(userId, sessionId)

        console.log('✅ Material agregado al carrito exitosamente')

        res.json({
            success: true,
            message: 'Material agregado al carrito exitosamente',
            data: {
                item: result.rows[0],
                carrito: cartTotal
            }
        })

    } catch (error) {
        console.error('Error agregando al carrito:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// const deleteMaterials = async (req, res) => {
//     try {
//         const { materialIds } = req.body
//         const userId = req.user?.id
//
//         console.log('🗑️ Eliminación masiva de materiales:', materialIds?.length)
//
//         if (!userId) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Usuario no autenticado'
//             })
//         }
//
//         // Solo admin puede hacer eliminación masiva
//         const userCheck = await pool.query(
//             'SELECT tipo_usuario FROM perfiles_usuario WHERE id = $1',
//             [userId]
//         )
//
//         if (userCheck.rows[0]?.tipo_usuario !== 'admin') {
//             return res.status(403).json({
//                 success: false,
//                 message: 'Solo administradores pueden realizar eliminación masiva'
//             })
//         }
//
//         if (!materialIds || !Array.isArray(materialIds) || materialIds.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Lista de IDs de materiales es requerida'
//             })
//         }
//
//         // Verificar cuáles materiales existen
//         const materialesCheck = await pool.query(
//             'SELECT id, titulo FROM materiales WHERE id = ANY($1)',
//             [materialIds]
//         )
//
//         const materialesExistentes = materialesCheck.rows
//         const idsExistentes = materialesExistentes.map(m => m.id)
//
//         if (materialesExistentes.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'No se encontraron materiales válidos para eliminar'
//             })
//         }
//
//         // Limpiar items del carrito que referencien estos materiales
//         const carritoCleanup = await pool.query(
//             'DELETE FROM carrito_temporal WHERE material_id = ANY($1)',
//             [idsExistentes]
//         )
//
//         // Eliminar materiales
//         const result = await pool.query(
//             'DELETE FROM materiales WHERE id = ANY($1) RETURNING id, titulo, tipo_material',
//             [idsExistentes]
//         )
//
//         const eliminados = result.rows.length
//         const itemsCarritoRemovidos = carritoCleanup.rowCount || 0
//
//         console.log(`✅ Eliminación masiva completada: ${eliminados} materiales, ${itemsCarritoRemovidos} items de carrito`)
//
//         res.json({
//             success: true,
//             message: `${eliminados} materiales eliminados exitosamente`,
//             data: {
//                 materiales_eliminados: result.rows,
//                 total_eliminados: eliminados,
//                 total_solicitados: materialIds.length,
//                 items_carrito_removidos: itemsCarritoRemovidos,
//                 no_encontrados: materialIds.filter(id => !idsExistentes.includes(id))
//             }
//         })
//
//     } catch (error) {
//         console.error('Error en eliminación masiva:', error)
//         res.status(500).json({
//             success: false,
//             message: 'Error interno del servidor'
//         })
//     }
// }

const deleteMaterials = async (req, res) => {
    try {
        const { materialIds } = req.body
        const userId = req.user?.id

        console.log('🗑️ Eliminación de materiales:', materialIds?.length)

        // 1. VALIDACIÓN DE AUTENTICACIÓN
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        // 2. VERIFICACIÓN DE PERMISOS (SOLO ADMIN)
        const userCheck = await pool.query(
            'SELECT tipo_usuario FROM perfiles_usuario WHERE id = $1',
            [userId]
        )

        if (userCheck.rows[0]?.tipo_usuario !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Solo administradores pueden eliminar materiales'
            })
        }

        // 3. VALIDACIÓN DE DATOS DE ENTRADA
        if (!materialIds || !Array.isArray(materialIds) || materialIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Lista de IDs de materiales es requerida'
            })
        }

        // 4. VERIFICACIÓN DE EXISTENCIA DE MATERIALES
        const materialesCheck = await pool.query(
            'SELECT id, titulo, tipo_material FROM materiales WHERE id = ANY($1)',
            [materialIds]
        )

        const materialesExistentes = materialesCheck.rows
        const idsExistentes = materialesExistentes.map(m => m.id)

        if (materialesExistentes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron materiales válidos para eliminar'
            })
        }

        // 5. ELIMINACIÓN DIRECTA
        const result = await pool.query(
            'DELETE FROM materiales WHERE id = ANY($1) RETURNING id, titulo, tipo_material',
            [idsExistentes]
        )

        const eliminados = result.rows.length

        console.log(`✅ Eliminación completada: ${eliminados} materiales`)

        // 6. RESPUESTA SIMPLIFICADA
        res.json({
            success: true,
            message: `${eliminados} materiales eliminados exitosamente`,
            data: {
                materiales_eliminados: result.rows,
                total_eliminados: eliminados,
                total_solicitados: materialIds.length,
                no_encontrados: materialIds.filter(id => !idsExistentes.includes(id))
            }
        })

    } catch (error) {
        console.error('Error eliminando materiales:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}


// =============================================
// OBTENER MATERIAL PARA EDICIÓN (ADMIN/INSTRUCTOR)
// =============================================
const getMaterialForEdit = async (req, res) => {
    try {
        const { materialId } = req.params
        const userId = req.user?.id

        console.log('📝 Obteniendo material para editar:', materialId)

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        // Obtener material con información de curso
        const result = await pool.query(
            `SELECT m.*, c.titulo as curso_titulo, c.instructor_id
             FROM materiales m
             LEFT JOIN cursos c ON m.curso_id = c.id
             WHERE m.id = $1`,
            [materialId]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Material no encontrado'
            })
        }

        const material = result.rows[0]

        // Verificar permisos
        let puedeEditar = false
        const userTypeResult = await pool.query(
            'SELECT tipo_usuario FROM perfiles_usuario WHERE id = $1',
            [userId]
        )

        const tipoUsuario = userTypeResult.rows[0]?.tipo_usuario

        if (tipoUsuario === 'admin') {
            puedeEditar = true
        } else if (material.instructor_id === userId) {
            puedeEditar = true
        }

        if (!puedeEditar) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para editar este material'
            })
        }

        // Obtener categorías disponibles para el formulario
        const categoriasResult = await pool.query(
            `SELECT categoria, COUNT(*) as cantidad 
             FROM materiales 
             WHERE categoria IS NOT NULL 
             GROUP BY categoria 
             ORDER BY cantidad DESC`
        )

        res.json({
            success: true,
            data: {
                material: {
                    ...material,
                    precio: parseFloat(material.precio) || 0,
                    tipo_display: getTipoMaterialDisplay(material.tipo_material),
                    archivo_extension: getFileExtension(material.archivo_url)
                },
                categorias_disponibles: categoriasResult.rows.map(c => c.categoria),
                puede_editar: puedeEditar,
                es_admin: tipoUsuario === 'admin'
            }
        })

    } catch (error) {
        console.error('Error obteniendo material para editar:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CARRITO SIMBÓLICO - VER CARRITO
// =============================================
const getCart = async (req, res) => {
    try {
        const { sessionId } = req.query
        const userId = req.user?.id || null

        console.log('🛒 Obteniendo carrito:', { sessionId, userId })

        if (!userId && !sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID es requerido para usuarios no logueados'
            })
        }

        // Obtener items del carrito con detalles del material
        let query = `
            SELECT ct.*, m.titulo, m.descripcion, m.precio, m.imagen_url, m.categoria,
                   (ct.cantidad * m.precio) as subtotal
            FROM carrito_temporal ct
            JOIN materiales m ON ct.material_id = m.id
            WHERE `

        let params = []

        if (userId) {
            query += 'ct.usuario_id = $1'
            params = [userId]
        } else {
            query += 'ct.session_id = $1'
            params = [sessionId]
        }

        query += ' ORDER BY ct.fecha_agregado DESC'

        const result = await pool.query(query, params)

        // Calcular totales
        const items = result.rows.map(row => ({
            id: row.id,
            material: {
                id: row.material_id,
                titulo: row.titulo,
                descripcion: row.descripcion,
                precio: parseFloat(row.precio),
                imagen_url: row.imagen_url,
                categoria: row.categoria
            },
            cantidad: row.cantidad,
            subtotal: parseFloat(row.subtotal),
            fecha_agregado: row.fecha_agregado
        }))

        const total = items.reduce((sum, item) => sum + item.subtotal, 0)

        res.json({
            success: true,
            data: {
                items,
                resumen: {
                    total_items: items.length,
                    total_materiales: items.reduce((sum, item) => sum + item.cantidad, 0),
                    total_precio: total.toFixed(2)
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo carrito:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CARRITO SIMBÓLICO - REMOVER ITEM
// =============================================
const removeFromCart = async (req, res) => {
    try {
        const { itemId } = req.params
        const userId = req.user?.id || null

        console.log('🗑️ Removiendo del carrito:', { itemId, userId })

        let query = 'DELETE FROM carrito_temporal WHERE id = $1'
        let params = [itemId]

        // Si está logueado, verificar que sea su item
        if (userId) {
            query += ' AND usuario_id = $2'
            params.push(userId)
        }

        const result = await pool.query(query + ' RETURNING *', params)

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Item no encontrado en el carrito'
            })
        }

        console.log('✅ Item removido del carrito exitosamente')

        res.json({
            success: true,
            message: 'Item removido del carrito exitosamente'
        })

    } catch (error) {
        console.error('Error removiendo del carrito:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CARRITO SIMBÓLICO - LIMPIAR CARRITO
// =============================================
const clearCart = async (req, res) => {
    try {
        const { sessionId } = req.query
        const userId = req.user?.id || null

        console.log('🧹 Limpiando carrito:', { sessionId, userId })

        if (!userId && !sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID es requerido para usuarios no logueados'
            })
        }

        let query = 'DELETE FROM carrito_temporal WHERE '
        let params = []

        if (userId) {
            query += 'usuario_id = $1'
            params = [userId]
        } else {
            query += 'session_id = $1'
            params = [sessionId]
        }

        const result = await pool.query(query, params)

        console.log('✅ Carrito limpiado exitosamente')

        res.json({
            success: true,
            message: 'Carrito limpiado exitosamente',
            data: {
                items_removidos: result.rowCount
            }
        })

    } catch (error) {
        console.error('Error limpiando carrito:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// GENERAR LINK DE WHATSAPP PARA COMPRA
// =============================================
const generateWhatsAppLink = async (req, res) => {
    try {
        const { materiales, datosUsuario } = req.body
        const { nombre, email, telefono, mensaje_adicional = '' } = datosUsuario

        console.log('📱 Generando link WhatsApp:', {
            materialesCount: materiales?.length,
            usuario: nombre
        })

        if (!materiales || !Array.isArray(materiales) || materiales.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Lista de materiales es requerida'
            })
        }

        if (!nombre || !email) {
            return res.status(400).json({
                success: false,
                message: 'Nombre y email son requeridos'
            })
        }

        // Obtener detalles de los materiales
        const materialIds = materiales.map(m => m.id)
        const materialesResult = await pool.query(
            `SELECT id, titulo, precio, tipo_material 
             FROM materiales 
             WHERE id = ANY($1) AND tipo_material = 'premium'`,
            [materialIds]
        )

        if (materialesResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se encontraron materiales válidos para compra'
            })
        }

        // Calcular total
        const total = materialesResult.rows.reduce((sum, material) => {
            const cantidad = materiales.find(m => m.id === material.id)?.cantidad || 1
            return sum + (parseFloat(material.precio) * cantidad)
        }, 0)

        // Generar mensaje de WhatsApp
        let mensaje = `¡Hola! Me interesa adquirir los siguientes materiales:\n\n`

        mensaje += `*DATOS DEL CLIENTE:*\n`
        mensaje += `👤 Nombre: ${nombre}\n`
        mensaje += `📧 Email: ${email}\n`
        if (telefono) mensaje += `📞 Teléfono: ${telefono}\n`

        mensaje += `\n*MATERIALES SOLICITADOS:*\n`

        materialesResult.rows.forEach(material => {
            const cantidad = materiales.find(m => m.id === material.id)?.cantidad || 1
            const subtotal = parseFloat(material.precio) * cantidad
            mensaje += `📚 ${material.titulo}\n`
            mensaje += `   💰 $${material.precio} x ${cantidad} = $${subtotal.toFixed(2)}\n\n`
        })

        mensaje += `*TOTAL: $${total.toFixed(2)}*\n\n`

        if (mensaje_adicional.trim()) {
            mensaje += `*Mensaje adicional:*\n${mensaje_adicional}\n\n`
        }

        mensaje += `Espero su respuesta para coordinar la entrega. ¡Gracias!`

        // Número de WhatsApp (configurar según tu negocio)
        const numeroWhatsApp = process.env.WHATSAPP_BUSINESS_NUMBER || '593999999999'

        // Generar link
        const mensajeCodificado = encodeURIComponent(mensaje)
        const whatsappLink = `https://wa.me/${numeroWhatsApp}?text=${mensajeCodificado}`

        res.json({
            success: true,
            data: {
                whatsapp_link: whatsappLink,
                mensaje_preview: mensaje,
                resumen: {
                    total_materiales: materialesResult.rows.length,
                    total_precio: total.toFixed(2),
                    cliente: nombre
                }
            }
        })

    } catch (error) {
        console.error('Error generando link WhatsApp:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// FUNCIÓN AUXILIAR - OBTENER TOTAL DEL CARRITO
// =============================================
const getCartTotal = async (userId, sessionId) => {
    try {
        let query = `
            SELECT 
                COUNT(*) as total_items,
                SUM(cantidad) as total_materiales,
                SUM(ct.cantidad * m.precio) as total_precio
            FROM carrito_temporal ct
            JOIN materiales m ON ct.material_id = m.id
            WHERE `

        let params = []

        if (userId) {
            query += 'ct.usuario_id = $1'
            params = [userId]
        } else {
            query += 'ct.session_id = $1'
            params = [sessionId]
        }

        const result = await pool.query(query, params)
        const row = result.rows[0]

        return {
            total_items: parseInt(row.total_items) || 0,
            total_materiales: parseInt(row.total_materiales) || 0,
            total_precio: parseFloat(row.total_precio) || 0
        }
    } catch (error) {
        console.error('Error obteniendo total del carrito:', error)
        return { total_items: 0, total_materiales: 0, total_precio: 0 }
    }
}

// =============================================
// FUNCIONES DE UTILIDAD
// =============================================
const getTipoMaterialDisplay = (tipoMaterial) => {
    const tipos = {
        'curso': { name: 'Material de Curso', color: 'bg-blue-100 text-blue-800', icon: '📚' },
        'libre': { name: 'Descarga Gratuita', color: 'bg-green-100 text-green-800', icon: '🆓' },
        'premium': { name: 'Material Premium', color: 'bg-yellow-100 text-yellow-800', icon: '⭐' }
    }
    return tipos[tipoMaterial] || { name: tipoMaterial, color: 'bg-gray-100 text-gray-800', icon: '📄' }
}

const getFileExtension = (archivoUrl) => {
    if (!archivoUrl) return { extension: 'unknown', icon: '📎' }
    const extension = archivoUrl.split('.').pop()?.toLowerCase()

    const iconos = {
        'pdf': '📄',
        'doc': '📝', 'docx': '📝',
        'xls': '📊', 'xlsx': '📊',
        'ppt': '📽️', 'pptx': '📽️',
        'zip': '🗜️', 'rar': '🗜️',
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️',
        'mp4': '🎥', 'avi': '🎥', 'mov': '🎥',
        'mp3': '🎵', 'wav': '🎵'
    }

    return {
        extension: extension || 'unknown',
        icon: iconos[extension] || '📎'
    }
}

module.exports = {
    getMaterialesByCourse,
    getMarketplaceMaterials,
    getMaterialDetail,
    getMisMateriales,
    createMaterial,
    generateWhatsAppLink,
    // Carrito simbólico
    updateMaterial,

    deleteMaterials,
    getMaterialForEdit,
    addToCart,
    getCart,
    removeFromCart,
    clearCart
}
