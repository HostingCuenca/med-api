// controllers/clasesVirtualesController.js
const pool = require('../config/database')

// =============================================
// OBTENER CLASES VIRTUALES POR CURSO
// =============================================
const getClasesVirtualesByCourse = async (req, res) => {
    try {
        const { cursoId } = req.params
        const userId = req.user?.id || null

        console.log('Debug - userId:', userId, 'cursoId:', cursoId)

        // Verificar que el curso existe (IGUAL que simulacros)
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

        // Query principal siguiendo el patrón de simulacros
        const result = await pool.query(
            `SELECT cv.*,
                COALESCE(u.nombre_completo, 'Instructor') as instructor_nombre,
                -- Verificar si ya pasó la clase
                CASE 
                    WHEN cv.fecha_programada < NOW() THEN 'finalizada'
                    WHEN cv.fecha_programada <= NOW() + INTERVAL '15 minutes' THEN 'proximamente'
                    ELSE 'programada'
                END as estado_tiempo
            FROM clases_virtuales cv 
            LEFT JOIN perfiles_usuario u ON cv.creada_por = u.id
            WHERE cv.curso_id = $1 AND cv.activa = true 
            ORDER BY cv.fecha_programada`,
            [cursoId]
        )

        // Formatear respuesta siguiendo tu patrón
        const clasesVirtuales = result.rows.map(row => ({
            ...row,
            fecha_programada: row.fecha_programada,
            duracion_minutos: parseInt(row.duracion_minutos) || 60,
            instructor_nombre: row.instructor_nombre,
            estado_tiempo: row.estado_tiempo,
            // Agregar info útil para frontend
            fecha_display: new Date(row.fecha_programada).toLocaleString('es-EC', {
                timeZone: 'America/Guayaquil',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }),
            puede_acceder: row.estado_tiempo === 'proximamente' || row.estado_tiempo === 'programada'
        }))

        res.json({
            success: true,
            data: {
                clasesVirtuales,
                curso: cursoCheck.rows[0],
                estadisticas: {
                    total_clases: clasesVirtuales.length,
                    proximas: clasesVirtuales.filter(c => c.estado_tiempo === 'programada').length,
                    finalizadas: clasesVirtuales.filter(c => c.estado_tiempo === 'finalizada').length
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo clases virtuales:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// OBTENER CLASES VIRTUALES DEL USUARIO (todas sus clases)
// =============================================
const getMisClasesVirtuales = async (req, res) => {
    try {
        const userId = req.user?.id

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        // SIGUIENDO TU LÓGICA: JOIN con inscripciones para verificar acceso
        const result = await pool.query(
            `SELECT cv.*, c.titulo as curso_titulo, c.es_gratuito,
                u.nombre_completo as instructor_nombre,
                -- Verificar acceso igual que simulacros
                CASE
                    WHEN c.es_gratuito = true THEN 'habilitado'
                    WHEN i.estado_pago IS NULL THEN 'no_inscrito'
                    ELSE i.estado_pago
                END as estado_acceso,
                -- Estado temporal de la clase
                CASE 
                    WHEN cv.fecha_programada < NOW() THEN 'finalizada'
                    WHEN cv.fecha_programada <= NOW() + INTERVAL '15 minutes' THEN 'proximamente'
                    ELSE 'programada'
                END as estado_tiempo
            FROM clases_virtuales cv
            JOIN cursos c ON cv.curso_id = c.id
            LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
            LEFT JOIN perfiles_usuario u ON cv.creada_por = u.id
            WHERE cv.activa = true 
                AND (c.es_gratuito = true OR i.estado_pago = 'habilitado')
            ORDER BY cv.fecha_programada DESC`,
            [userId]
        )

        const clasesVirtuales = result.rows.map(row => ({
            id: row.id,
            titulo: row.titulo,
            descripcion: row.descripcion,
            plataforma: row.plataforma,
            link_reunion: row.link_reunion,
            fecha_programada: row.fecha_programada,
            duracion_minutos: parseInt(row.duracion_minutos) || 60,
            curso_titulo: row.curso_titulo,
            instructor_nombre: row.instructor_nombre,
            estado_acceso: row.estado_acceso,
            estado_tiempo: row.estado_tiempo,
            puede_acceder: row.estado_acceso === 'habilitado' &&
                (row.estado_tiempo === 'proximamente' || row.estado_tiempo === 'programada'),
            fecha_display: new Date(row.fecha_programada).toLocaleString('es-EC', {
                timeZone: 'America/Guayaquil',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })
        }))

        res.json({
            success: true,
            data: {
                clasesVirtuales,
                estadisticas: {
                    total: clasesVirtuales.length,
                    proximas: clasesVirtuales.filter(c => c.estado_tiempo === 'programada').length,
                    hoy: clasesVirtuales.filter(c => {
                        const hoy = new Date().toDateString()
                        const fechaClase = new Date(c.fecha_programada).toDateString()
                        return hoy === fechaClase
                    }).length
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo mis clases virtuales:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// OBTENER DETALLE DE CLASE VIRTUAL Y VERIFICAR ACCESO
// =============================================
const getClaseVirtualDetail = async (req, res) => {
    try {
        const { claseId } = req.params
        const userId = req.user?.id

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        // MISMA LÓGICA QUE getSimulacroQuestions
        const accessCheck = await pool.query(
            `SELECT cv.*, c.es_gratuito, c.titulo as curso_titulo,
                u.nombre_completo as instructor_nombre, u.email as instructor_email,
                CASE
                    WHEN c.es_gratuito = true THEN 'habilitado'
                    WHEN i.estado_pago IS NULL THEN 'no_inscrito'
                    ELSE i.estado_pago
                END as estado_acceso,
                CASE 
                    WHEN cv.fecha_programada < NOW() THEN 'finalizada'
                    WHEN cv.fecha_programada <= NOW() + INTERVAL '15 minutes' THEN 'proximamente'
                    ELSE 'programada'
                END as estado_tiempo
             FROM clases_virtuales cv
             JOIN cursos c ON cv.curso_id = c.id
             LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
             LEFT JOIN perfiles_usuario u ON cv.creada_por = u.id
             WHERE cv.id = $2 AND cv.activa = true`,
            [userId, claseId]
        )

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Clase virtual no encontrada'
            })
        }

        const claseVirtual = accessCheck.rows[0]

        // Verificar acceso (IGUAL que simulacros)
        if (claseVirtual.estado_acceso !== 'habilitado') {
            return res.status(403).json({
                success: false,
                message: claseVirtual.estado_acceso === 'no_inscrito'
                    ? 'Debes inscribirte en el curso para acceder a esta clase virtual'
                    : 'Tu inscripción está pendiente de aprobación. Contacta al administrador.',
                estadoAcceso: claseVirtual.estado_acceso
            })
        }

        // Respuesta estructurada igual que simulacros
        res.json({
            success: true,
            data: {
                claseVirtual: {
                    id: claseVirtual.id,
                    titulo: claseVirtual.titulo,
                    descripcion: claseVirtual.descripcion,
                    plataforma: claseVirtual.plataforma,
                    link_reunion: claseVirtual.link_reunion,
                    fecha_programada: claseVirtual.fecha_programada,
                    duracion_minutos: claseVirtual.duracion_minutos,
                    curso_titulo: claseVirtual.curso_titulo,
                    instructor_nombre: claseVirtual.instructor_nombre,
                    instructor_email: claseVirtual.instructor_email,
                    estado_tiempo: claseVirtual.estado_tiempo,
                    puede_acceder: claseVirtual.estado_tiempo === 'proximamente' ||
                        claseVirtual.estado_tiempo === 'programada'
                },
                configuracion: {
                    mostrarLink: claseVirtual.estado_tiempo === 'proximamente' ||
                        claseVirtual.estado_tiempo === 'programada',
                    mensaje: getEstadoMensaje(claseVirtual.estado_tiempo)
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo detalle de clase virtual:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CREAR CLASE VIRTUAL (SOLO ADMIN/INSTRUCTOR)
// =============================================
const createClaseVirtual = async (req, res) => {
    try {
        const userId = req.user?.id
        const { titulo, descripcion, cursoId, plataforma, linkReunion, fechaProgramada, duracionMinutos } = req.body

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        // Verificar permisos (admin o instructor del curso)
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
                message: 'No tienes permisos para crear clases virtuales en este curso'
            })
        }

        // Crear clase virtual
        const result = await pool.query(
            `INSERT INTO clases_virtuales (titulo, descripcion, curso_id, plataforma, link_reunion, fecha_programada, duracion_minutos, creada_por)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [titulo, descripcion, cursoId, plataforma, linkReunion, fechaProgramada, duracionMinutos || 60, userId]
        )

        res.json({
            success: true,
            message: 'Clase virtual creada exitosamente',
            data: result.rows[0]
        })

    } catch (error) {
        console.error('Error creando clase virtual:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// FUNCIONES DE UTILIDAD
// =============================================
const getEstadoMensaje = (estadoTiempo) => {
    const mensajes = {
        'programada': 'La clase virtual está programada. El enlace estará disponible 15 minutos antes.',
        'proximamente': '¡La clase virtual está a punto de comenzar! Ya puedes acceder al enlace.',
        'finalizada': 'Esta clase virtual ya finalizó.'
    }
    return mensajes[estadoTiempo] || 'Estado desconocido'
}

module.exports = {
    getClasesVirtualesByCourse,
    getMisClasesVirtuales,
    getClaseVirtualDetail,
    createClaseVirtual
}