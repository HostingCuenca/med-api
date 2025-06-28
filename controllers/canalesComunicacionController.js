// controllers/canalesComunicacionController.js
const pool = require('../config/database')

// =============================================
// OBTENER CANALES POR CURSO
// =============================================
const getCanalesByCourse = async (req, res) => {
    try {
        const { cursoId } = req.params
        const userId = req.user?.id || null

        // Verificar que el curso existe (IGUAL patrón que simulacros)
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

        // Query principal
        const result = await pool.query(
            `SELECT cc.*,
                u.nombre_completo as creado_por_nombre
            FROM canales_curso cc 
            LEFT JOIN perfiles_usuario u ON cc.creado_por = u.id
            WHERE cc.curso_id = $1 AND cc.activo = true 
            ORDER BY cc.fecha_creacion`,
            [cursoId]
        )

        const canales = result.rows.map(row => ({
            ...row,
            creado_por_nombre: row.creado_por_nombre || 'Administrador',
            tipo_canal_display: getTipoCanalDisplay(row.tipo_canal)
        }))

        res.json({
            success: true,
            data: {
                canales,
                curso: cursoCheck.rows[0],
                estadisticas: {
                    total_canales: canales.length,
                    por_tipo: canales.reduce((acc, canal) => {
                        acc[canal.tipo_canal] = (acc[canal.tipo_canal] || 0) + 1
                        return acc
                    }, {})
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo canales:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// OBTENER MIS CANALES (TODOS LOS CURSOS INSCRITOS)
// =============================================
const getMisCanales = async (req, res) => {
    try {
        const userId = req.user?.id

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        // SIGUIENDO LA LÓGICA DE SIMULACROS: JOIN con inscripciones
        const result = await pool.query(
            `SELECT cc.*, c.titulo as curso_titulo, c.es_gratuito,
                u.nombre_completo as creado_por_nombre,
                -- Verificar acceso igual que simulacros
                CASE
                    WHEN c.es_gratuito = true THEN 'habilitado'
                    WHEN i.estado_pago IS NULL THEN 'no_inscrito'
                    ELSE i.estado_pago
                END as estado_acceso
            FROM canales_curso cc
            JOIN cursos c ON cc.curso_id = c.id
            LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
            LEFT JOIN perfiles_usuario u ON cc.creado_por = u.id
            WHERE cc.activo = true 
                AND (c.es_gratuito = true OR i.estado_pago = 'habilitado')
            ORDER BY cc.fecha_creacion DESC`,
            [userId]
        )

        const canales = result.rows.map(row => ({
            id: row.id,
            nombre: row.nombre,
            descripcion: row.descripcion,
            tipo_canal: row.tipo_canal,
            link_acceso: row.link_acceso,
            curso_titulo: row.curso_titulo,
            creado_por_nombre: row.creado_por_nombre || 'Administrador',
            estado_acceso: row.estado_acceso,
            puede_acceder: row.estado_acceso === 'habilitado',
            tipo_canal_display: getTipoCanalDisplay(row.tipo_canal)
        }))

        res.json({
            success: true,
            data: {
                canales,
                estadisticas: {
                    total: canales.length,
                    por_tipo: canales.reduce((acc, canal) => {
                        acc[canal.tipo_canal] = (acc[canal.tipo_canal] || 0) + 1
                        return acc
                    }, {}),
                    activos: canales.filter(c => c.puede_acceder).length
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo mis canales:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// OBTENER DETALLE DE CANAL Y VERIFICAR ACCESO
// =============================================
const getCanalDetail = async (req, res) => {
    try {
        const { canalId } = req.params
        const userId = req.user?.id

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        // MISMA LÓGICA QUE simulacros
        const accessCheck = await pool.query(
            `SELECT cc.*, c.es_gratuito, c.titulo as curso_titulo,
                u.nombre_completo as creado_por_nombre,
                CASE
                    WHEN c.es_gratuito = true THEN 'habilitado'
                    WHEN i.estado_pago IS NULL THEN 'no_inscrito'
                    ELSE i.estado_pago
                END as estado_acceso
             FROM canales_curso cc
             JOIN cursos c ON cc.curso_id = c.id
             LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
             LEFT JOIN perfiles_usuario u ON cc.creado_por = u.id
             WHERE cc.id = $2 AND cc.activo = true`,
            [userId, canalId]
        )

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Canal no encontrado'
            })
        }

        const canal = accessCheck.rows[0]

        // Verificar acceso (IGUAL que simulacros)
        if (canal.estado_acceso !== 'habilitado') {
            return res.status(403).json({
                success: false,
                message: canal.estado_acceso === 'no_inscrito'
                    ? 'Debes inscribirte en el curso para acceder a este canal'
                    : 'Tu inscripción está pendiente de aprobación. Contacta al administrador.',
                estadoAcceso: canal.estado_acceso
            })
        }

        res.json({
            success: true,
            data: {
                canal: {
                    id: canal.id,
                    nombre: canal.nombre,
                    descripcion: canal.descripcion,
                    tipo_canal: canal.tipo_canal,
                    link_acceso: canal.link_acceso,
                    curso_titulo: canal.curso_titulo,
                    creado_por_nombre: canal.creado_por_nombre,
                    tipo_canal_display: getTipoCanalDisplay(canal.tipo_canal)
                },
                configuracion: {
                    puedeAcceder: true,
                    instrucciones: getInstruccionesAcceso(canal.tipo_canal)
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo detalle de canal:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CREAR CANAL (SOLO ADMIN/INSTRUCTOR)
// =============================================
const createCanal = async (req, res) => {
    try {
        const userId = req.user?.id
        const { nombre, descripcion, cursoId, tipoCanal, linkAcceso } = req.body

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
                message: 'No tienes permisos para crear canales en este curso'
            })
        }

        // Crear canal
        const result = await pool.query(
            `INSERT INTO canales_curso (nombre, descripcion, curso_id, tipo_canal, link_acceso, creado_por)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [nombre, descripcion, cursoId, tipoCanal, linkAcceso, userId]
        )

        res.json({
            success: true,
            message: 'Canal creado exitosamente',
            data: result.rows[0]
        })

    } catch (error) {
        console.error('Error creando canal:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

const updateCanal = async (req, res) => {
    try {
        const userId = req.user?.id
        const { canalId } = req.params
        const { nombre, descripcion, tipoCanal, linkAcceso } = req.body

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        // Verificar que el canal existe y permisos (CORREGIR TABLA)
        const permisoCheck = await pool.query(
            `SELECT cc.*, u.tipo_usuario, c.instructor_id
             FROM canales_curso cc
                      JOIN cursos c ON cc.curso_id = c.id
                      JOIN perfiles_usuario u ON u.id = $1
             WHERE cc.id = $2 AND cc.activo = true`,
            [userId, canalId]
        )

        if (permisoCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Canal no encontrado'
            })
        }

        const { tipo_usuario, instructor_id, creado_por } = permisoCheck.rows[0]
        const puedeEditar = tipo_usuario === 'admin' || instructor_id === userId || creado_por === userId

        if (!puedeEditar) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para editar este canal'
            })
        }

        // Actualizar canal (CORREGIR TABLA)
        const result = await pool.query(
            `UPDATE canales_curso
             SET nombre = $1, descripcion = $2, tipo_canal = $3, link_acceso = $4
             WHERE id = $5
                 RETURNING *`,
            [nombre, descripcion, tipoCanal, linkAcceso, canalId]
        )

        res.json({
            success: true,
            message: 'Canal actualizado exitosamente',
            data: result.rows[0]
        })

    } catch (error) {
        console.error('Error actualizando canal:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// FUNCIONES DE UTILIDAD
// =============================================
const getTipoCanalDisplay = (tipoCanal) => {
    const tipos = {
        'whatsapp': { name: 'WhatsApp', icon: '📱', color: 'bg-green-100 text-green-800' },
        'telegram': { name: 'Telegram', icon: '✈️', color: 'bg-blue-100 text-blue-800' },
        'discord': { name: 'Discord', icon: '🎮', color: 'bg-purple-100 text-purple-800' },
        'slack': { name: 'Slack', icon: '💬', color: 'bg-pink-100 text-pink-800' }
    }
    return tipos[tipoCanal] || { name: tipoCanal, icon: '📢', color: 'bg-gray-100 text-gray-800' }
}

const getInstruccionesAcceso = (tipoCanal) => {
    const instrucciones = {
        'whatsapp': 'Haz clic en el enlace para unirte al grupo de WhatsApp del curso.',
        'telegram': 'Haz clic en el enlace para unirte al canal de Telegram.',
        'discord': 'Haz clic en el enlace para unirte al servidor de Discord.',
        'slack': 'Haz clic en el enlace para unirte al workspace de Slack.'
    }
    return instrucciones[tipoCanal] || 'Haz clic en el enlace para acceder al canal.'
}

module.exports = {
    getCanalesByCourse,
    getMisCanales,
    getCanalDetail,
    updateCanal,
    createCanal
}