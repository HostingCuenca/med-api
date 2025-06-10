// controllers/userManagementController.js
const pool = require('../config/database')

// =============================================
// OBTENER TODOS LOS USUARIOS
// =============================================
const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, tipo, search } = req.query

        let query = `
      SELECT id, email, nombre_completo, nombre_usuario, tipo_usuario, activo, fecha_registro,
        (SELECT COUNT(*) FROM inscripciones WHERE usuario_id = perfiles_usuario.id) as total_inscripciones
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

        if (search) {
            paramCount++
            query += ` AND (nombre_completo ILIKE $${paramCount} OR email ILIKE $${paramCount} OR nombre_usuario ILIKE $${paramCount})`
            params.push(`%${search}%`)
        }

        query += ` ORDER BY fecha_registro DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
        params.push(limit, (page - 1) * limit)

        const result = await pool.query(query, params)

        // Contar total
        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM perfiles_usuario WHERE 1=1' +
            (tipo ? ` AND tipo_usuario = '${tipo}'` : '') +
            (search ? ` AND (nombre_completo ILIKE '%${search}%' OR email ILIKE '%${search}%')` : '')
        )

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
        COUNT(CASE WHEN fecha_registro >= NOW() - INTERVAL '30 days' THEN 1 END) as nuevos_ultimo_mes
      FROM perfiles_usuario
    `)

        res.json({
            success: true,
            data: { estadisticas: result.rows[0] }
        })

    } catch (error) {
        console.error('Error obteniendo estadísticas:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

module.exports = { getAllUsers, changeUserRole, toggleUserStatus, getUserStats }