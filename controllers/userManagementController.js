// controllers/userManagementController.js - COMPLETO AL 100%
const pool = require('../config/database')
const bcrypt = require('bcryptjs')

// =============================================
// OBTENER TODOS LOS USUARIOS
// =============================================
const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, tipo, search, activo } = req.query

        let query = `
            SELECT id, email, nombre_completo, nombre_usuario, telefono, avatar_url, 
                   tipo_usuario, activo, fecha_registro, ultima_conexion,
                   (SELECT COUNT(*) FROM inscripciones WHERE usuario_id = perfiles_usuario.id) as total_inscripciones,
                   (SELECT COUNT(*) FROM inscripciones WHERE usuario_id = perfiles_usuario.id AND estado_pago = 'habilitado') as inscripciones_activas
            FROM perfiles_usuario 
            WHERE 1=1
        `
        const params = []
        let paramCount = 0

        if (tipo) {
            paramCount++
            query += ` AND tipo_usuario = $${paramCount}`
            params.push(tipo)
        }

        if (activo !== undefined) {
            paramCount++
            query += ` AND activo = $${paramCount}`
            params.push(activo === 'true')
        }

        if (search) {
            paramCount++
            query += ` AND (nombre_completo ILIKE $${paramCount} OR email ILIKE $${paramCount} OR nombre_usuario ILIKE $${paramCount})`
            params.push(`%${search}%`)
        }

        query += ` ORDER BY fecha_registro DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
        params.push(limit, (page - 1) * limit)

        const result = await pool.query(query, params)

        // Contar total
        let countQuery = 'SELECT COUNT(*) as total FROM perfiles_usuario WHERE 1=1'
        const countParams = []
        let countParamCount = 0

        if (tipo) {
            countParamCount++
            countQuery += ` AND tipo_usuario = $${countParamCount}`
            countParams.push(tipo)
        }

        if (activo !== undefined) {
            countParamCount++
            countQuery += ` AND activo = $${countParamCount}`
            countParams.push(activo === 'true')
        }

        if (search) {
            countParamCount++
            countQuery += ` AND (nombre_completo ILIKE $${countParamCount} OR email ILIKE $${countParamCount} OR nombre_usuario ILIKE $${countParamCount})`
            countParams.push(`%${search}%`)
        }

        const countResult = await pool.query(countQuery, countParams)

        res.json({
            success: true,
            data: {
                usuarios: result.rows,
                pagination: {
                    total: parseInt(countResult.rows[0].total),
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(countResult.rows[0].total / limit)
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo usuarios:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// OBTENER USUARIO POR ID - NUEVO
// =============================================
const getUserById = async (req, res) => {
    try {
        const { userId } = req.params

        const result = await pool.query(
            `SELECT u.id, u.email, u.nombre_completo, u.nombre_usuario, u.telefono, 
                    u.avatar_url, u.tipo_usuario, u.activo, u.fecha_registro, u.ultima_conexion,
                    COUNT(DISTINCT i.id) as total_inscripciones,
                    COUNT(DISTINCT CASE WHEN i.estado_pago = 'habilitado' THEN i.id END) as inscripciones_activas,
                    COUNT(DISTINCT CASE WHEN i.estado_pago = 'pendiente' THEN i.id END) as pagos_pendientes,
                    COUNT(DISTINCT pc.clase_id) as clases_completadas,
                    COUNT(DISTINCT isa.id) as simulacros_realizados,
                    COALESCE(AVG(isa.puntaje), 0) as promedio_simulacros
             FROM perfiles_usuario u
             LEFT JOIN inscripciones i ON u.id = i.usuario_id
             LEFT JOIN progreso_clases pc ON u.id = pc.usuario_id AND pc.completada = true
             LEFT JOIN intentos_simulacro isa ON u.id = isa.usuario_id
             WHERE u.id = $1
             GROUP BY u.id`,
            [userId]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            })
        }

        // Obtener inscripciones del usuario
        const inscripcionesResult = await pool.query(
            `SELECT i.*, c.titulo, c.slug, c.precio, c.es_gratuito, c.miniatura_url,
                    p.nombre_completo as instructor_nombre
             FROM inscripciones i
             JOIN cursos c ON i.curso_id = c.id
             LEFT JOIN perfiles_usuario p ON c.instructor_id = p.id
             WHERE i.usuario_id = $1
             ORDER BY i.fecha_inscripcion DESC`,
            [userId]
        )

        res.json({
            success: true,
            data: {
                usuario: result.rows[0],
                inscripciones: inscripcionesResult.rows
            }
        })

    } catch (error) {
        console.error('Error obteniendo usuario:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ACTUALIZAR USUARIO - NUEVO
// =============================================
const updateUser = async (req, res) => {
    try {
        const { userId } = req.params
        const { nombre_completo, nombre_usuario, telefono, avatar_url, email } = req.body

        // Verificar que el usuario existe
        const userCheck = await pool.query('SELECT id, email, nombre_usuario FROM perfiles_usuario WHERE id = $1', [userId])

        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            })
        }

        const currentUser = userCheck.rows[0]

        // Verificar email único (si se está cambiando)
        if (email && email !== currentUser.email) {
            const emailCheck = await pool.query('SELECT id FROM perfiles_usuario WHERE email = $1 AND id != $2', [email, userId])
            if (emailCheck.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El email ya está en uso'
                })
            }
        }

        // Verificar nombre_usuario único (si se está cambiando)
        if (nombre_usuario && nombre_usuario !== currentUser.nombre_usuario) {
            const usernameCheck = await pool.query('SELECT id FROM perfiles_usuario WHERE nombre_usuario = $1 AND id != $2', [nombre_usuario, userId])
            if (usernameCheck.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre de usuario ya está en uso'
                })
            }
        }

        // Construir query dinámico
        const fieldsToUpdate = []
        const params = []
        let paramCount = 0

        if (nombre_completo !== undefined) {
            paramCount++
            fieldsToUpdate.push(`nombre_completo = $${paramCount}`)
            params.push(nombre_completo)
        }

        if (nombre_usuario !== undefined) {
            paramCount++
            fieldsToUpdate.push(`nombre_usuario = $${paramCount}`)
            params.push(nombre_usuario)
        }

        if (email !== undefined) {
            paramCount++
            fieldsToUpdate.push(`email = $${paramCount}`)
            params.push(email)
        }

        if (telefono !== undefined) {
            paramCount++
            fieldsToUpdate.push(`telefono = $${paramCount}`)
            params.push(telefono)
        }

        if (avatar_url !== undefined) {
            paramCount++
            fieldsToUpdate.push(`avatar_url = $${paramCount}`)
            params.push(avatar_url)
        }

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionaron campos para actualizar'
            })
        }

        paramCount++
        params.push(userId)

        const query = `
            UPDATE perfiles_usuario 
            SET ${fieldsToUpdate.join(', ')}
            WHERE id = $${paramCount}
            RETURNING id, email, nombre_completo, nombre_usuario, telefono, avatar_url, tipo_usuario, activo
        `

        const result = await pool.query(query, params)

        res.json({
            success: true,
            message: 'Usuario actualizado exitosamente',
            data: { usuario: result.rows[0] }
        })

    } catch (error) {
        console.error('Error actualizando usuario:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// RESET CONTRASEÑA (ADMIN) - NUEVO
// =============================================
const resetUserPassword = async (req, res) => {
    try {
        const { userId } = req.params
        const { newPassword, sendNotification = true } = req.body

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'La nueva contraseña debe tener al menos 6 caracteres'
            })
        }

        // Verificar que el usuario existe
        const userResult = await pool.query(
            'SELECT id, email, nombre_completo FROM perfiles_usuario WHERE id = $1',
            [userId]
        )

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            })
        }

        const user = userResult.rows[0]

        // Hash de la nueva contraseña
        const hashedPassword = await bcrypt.hash(newPassword, 12)

        // Actualizar contraseña
        await pool.query(
            'UPDATE perfiles_usuario SET password_hash = $1 WHERE id = $2',
            [hashedPassword, userId]
        )

        res.json({
            success: true,
            message: `Contraseña actualizada para ${user.nombre_completo}`,
            data: {
                usuario: {
                    id: user.id,
                    email: user.email,
                    nombre_completo: user.nombre_completo
                },
                newPassword: sendNotification ? newPassword : undefined
            }
        })

    } catch (error) {
        console.error('Error reseteando contraseña:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ELIMINAR USUARIO - NUEVO
// =============================================
const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params
        const { permanent = false } = req.body

        // Verificar que el usuario existe
        const userResult = await pool.query(
            'SELECT id, email, nombre_completo, tipo_usuario FROM perfiles_usuario WHERE id = $1',
            [userId]
        )

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            })
        }

        const user = userResult.rows[0]

        // No permitir eliminar otros admins
        if (user.tipo_usuario === 'admin') {
            return res.status(403).json({
                success: false,
                message: 'No se puede eliminar usuarios administradores'
            })
        }

        if (permanent) {
            // Eliminación permanente (cuidado con las relaciones)
            await pool.query('DELETE FROM perfiles_usuario WHERE id = $1', [userId])

            res.json({
                success: true,
                message: `Usuario ${user.nombre_completo} eliminado permanentemente`
            })
        } else {
            // Soft delete - desactivar usuario
            await pool.query('UPDATE perfiles_usuario SET activo = false WHERE id = $1', [userId])

            res.json({
                success: true,
                message: `Usuario ${user.nombre_completo} desactivado`
            })
        }

    } catch (error) {
        console.error('Error eliminando usuario:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CREAR USUARIO (ADMIN) - NUEVO
// =============================================
const createUser = async (req, res) => {
    try {
        const { email, password, nombre_completo, nombre_usuario, telefono, tipo_usuario = 'estudiante' } = req.body

        // Validaciones
        if (!email || !password || !nombre_completo || !nombre_usuario) {
            return res.status(400).json({
                success: false,
                message: 'Email, contraseña, nombre completo y nombre de usuario son requeridos'
            })
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña debe tener al menos 6 caracteres'
            })
        }

        if (!['estudiante', 'instructor', 'admin'].includes(tipo_usuario)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de usuario inválido'
            })
        }

        // Verificar si ya existe
        const existingUser = await pool.query(
            'SELECT id FROM perfiles_usuario WHERE email = $1 OR nombre_usuario = $2',
            [email, nombre_usuario]
        )

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El email o nombre de usuario ya existe'
            })
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12)

        // Crear usuario
        const result = await pool.query(
            `INSERT INTO perfiles_usuario (email, password_hash, nombre_completo, nombre_usuario, telefono, tipo_usuario) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id, email, nombre_completo, nombre_usuario, telefono, tipo_usuario, activo, fecha_registro`,
            [email, hashedPassword, nombre_completo, nombre_usuario, telefono, tipo_usuario]
        )

        res.status(201).json({
            success: true,
            message: 'Usuario creado exitosamente',
            data: {
                usuario: result.rows[0],
                password_temporal: password // Para que el admin pueda comunicársela al usuario
            }
        })

    } catch (error) {
        console.error('Error creando usuario:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CAMBIAR ROL DE USUARIO
// =============================================
const changeUserRole = async (req, res) => {
    try {
        const { userId } = req.params
        const { tipoUsuario } = req.body

        if (!['estudiante', 'instructor', 'admin'].includes(tipoUsuario)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de usuario inválido'
            })
        }

        const result = await pool.query(
            'UPDATE perfiles_usuario SET tipo_usuario = $1 WHERE id = $2 RETURNING id, email, nombre_completo, tipo_usuario',
            [tipoUsuario, userId]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            })
        }

        res.json({
            success: true,
            message: 'Rol actualizado exitosamente',
            data: { usuario: result.rows[0] }
        })

    } catch (error) {
        console.error('Error cambiando rol:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ACTIVAR/DESACTIVAR USUARIO
// =============================================
const toggleUserStatus = async (req, res) => {
    try {
        const { userId } = req.params

        const result = await pool.query(
            'UPDATE perfiles_usuario SET activo = NOT activo WHERE id = $1 RETURNING id, email, nombre_completo, activo',
            [userId]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            })
        }

        const usuario = result.rows[0]

        res.json({
            success: true,
            message: `Usuario ${usuario.activo ? 'activado' : 'desactivado'} exitosamente`,
            data: { usuario }
        })

    } catch (error) {
        console.error('Error cambiando estado:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ESTADÍSTICAS DE USUARIOS
// =============================================
const getUserStats = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_usuarios,
                COUNT(CASE WHEN tipo_usuario = 'estudiante' THEN 1 END) as estudiantes,
                COUNT(CASE WHEN tipo_usuario = 'instructor' THEN 1 END) as instructores,
                COUNT(CASE WHEN tipo_usuario = 'admin' THEN 1 END) as admins,
                COUNT(CASE WHEN activo = true THEN 1 END) as activos,
                COUNT(CASE WHEN fecha_registro >= NOW() - INTERVAL '30 days' THEN 1 END) as nuevos_ultimo_mes,
                COUNT(CASE WHEN ultima_conexion >= NOW() - INTERVAL '7 days' THEN 1 END) as activos_ultima_semana
            FROM perfiles_usuario
        `)

        // Estadísticas de inscripciones
        const inscripcionesResult = await pool.query(`
            SELECT 
                COUNT(*) as total_inscripciones,
                COUNT(CASE WHEN estado_pago = 'habilitado' THEN 1 END) as inscripciones_activas,
                COUNT(CASE WHEN estado_pago = 'pendiente' THEN 1 END) as pagos_pendientes,
                COUNT(CASE WHEN fecha_inscripcion >= NOW() - INTERVAL '30 days' THEN 1 END) as inscripciones_ultimo_mes
            FROM inscripciones
        `)

        res.json({
            success: true,
            data: {
                usuarios: result.rows[0],
                inscripciones: inscripcionesResult.rows[0]
            }
        })

    } catch (error) {
        console.error('Error obteniendo estadísticas:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// OBTENER PROGRESO DE USUARIO (ADMIN VIEW) - NUEVO
// =============================================
const getUserProgress = async (req, res) => {
    try {
        const { userId } = req.params

        // Verificar que el usuario existe
        const userCheck = await pool.query('SELECT nombre_completo FROM perfiles_usuario WHERE id = $1', [userId])
        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            })
        }

        // Obtener progreso por curso
        const progressResult = await pool.query(
            `SELECT c.id as curso_id, c.titulo, c.slug,
                    COUNT(cl.id) as total_clases,
                    COUNT(CASE WHEN pc.completada = true THEN 1 END) as clases_completadas,
                    CASE 
                        WHEN COUNT(cl.id) > 0 THEN 
                            ROUND((COUNT(CASE WHEN pc.completada = true THEN 1 END)::float / COUNT(cl.id)::float) * 100, 2)
                        ELSE 0 
                    END as porcentaje_progreso,
                    i.fecha_inscripcion,
                    i.estado_pago,
                    MAX(pc.fecha_ultima_vista) as ultima_actividad
             FROM inscripciones i
             JOIN cursos c ON i.curso_id = c.id
             LEFT JOIN modulos m ON c.id = m.curso_id
             LEFT JOIN clases cl ON m.id = cl.modulo_id
             LEFT JOIN progreso_clases pc ON cl.id = pc.clase_id AND pc.usuario_id = $1
             WHERE i.usuario_id = $1
             GROUP BY c.id, c.titulo, c.slug, i.fecha_inscripcion, i.estado_pago
             ORDER BY i.fecha_inscripcion DESC`,
            [userId]
        )

        // Obtener simulacros realizados
        const simulacrosResult = await pool.query(
            `SELECT s.titulo as simulacro_titulo, c.titulo as curso_titulo,
                    isa.puntaje, isa.fecha_intento, isa.total_preguntas, isa.respuestas_correctas
             FROM intentos_simulacro isa
             JOIN simulacros s ON isa.simulacro_id = s.id
             JOIN cursos c ON s.curso_id = c.id
             WHERE isa.usuario_id = $1
             ORDER BY isa.fecha_intento DESC
             LIMIT 10`,
            [userId]
        )

        res.json({
            success: true,
            data: {
                usuario: userCheck.rows[0].nombre_completo,
                progreso_cursos: progressResult.rows,
                simulacros_recientes: simulacrosResult.rows
            }
        })

    } catch (error) {
        console.error('Error obteniendo progreso del usuario:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

module.exports = {
    getAllUsers,
    getUserById,        // NUEVO
    updateUser,         // NUEVO
    createUser,         // NUEVO
    resetUserPassword,  // NUEVO
    deleteUser,         // NUEVO
    changeUserRole,
    toggleUserStatus,
    getUserStats,
    getUserProgress     // NUEVO
}