// controllers/authController.js
const pool = require('../config/database')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

// Generar JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// =============================================
// REGISTRO
// =============================================
const register = async (req, res) => {
    try {
        const { email, password, nombreCompleto, nombreUsuario, telefono } = req.body

        // Validaciones
        if (!email || !password || !nombreCompleto || !nombreUsuario) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos'
            })
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña debe tener al menos 6 caracteres'
            })
        }

        // Verificar si ya existe
        const existingUser = await pool.query(
            'SELECT id FROM perfiles_usuario WHERE email = $1 OR nombre_usuario = $2',
            [email, nombreUsuario]
        )

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El email o nombre de usuario ya existe'
            })
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12)

        // Crear usuario (telefono es opcional)
        const result = await pool.query(
            `INSERT INTO perfiles_usuario (email, password_hash, nombre_completo, nombre_usuario, telefono)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, nombre_completo, nombre_usuario, telefono, tipo_usuario, fecha_registro`,
            [email, hashedPassword, nombreCompleto, nombreUsuario, telefono || null]
        )

        const user = result.rows[0]
        const token = generateToken(user.id)

        res.status(201).json({
            success: true,
            message: 'Usuario creado exitosamente',
            data: { user, token }
        })

    } catch (error) {
        console.error('Error registro:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// LOGIN
// =============================================
const login = async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email y contraseña son requeridos'
            })
        }

        // Buscar usuario
        const result = await pool.query(
            'SELECT * FROM perfiles_usuario WHERE email = $1',
            [email]
        )

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            })
        }

        const user = result.rows[0]

        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, user.password_hash)
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            })
        }

        const token = generateToken(user.id)

        res.json({
            success: true,
            message: 'Login exitoso',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    nombreCompleto: user.nombre_completo,
                    nombreUsuario: user.nombre_usuario,
                    tipoUsuario: user.tipo_usuario,
                    telefono: user.telefono,
                },
                token
            }
        })

    } catch (error) {
        console.error('Error login:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

const updateProfile = async (req, res) => {
    try {
        const { nombreCompleto, nombreUsuario, telefono } = req.body
        const userId = req.user.id

        // Verificar si nombre de usuario ya existe (si se está cambiando)
        if (nombreUsuario) {
            const existingUser = await pool.query(
                'SELECT id FROM perfiles_usuario WHERE nombre_usuario = $1 AND id != $2',
                [nombreUsuario, userId]
            )

            if (existingUser.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre de usuario ya está en uso'
                })
            }
        }

        const result = await pool.query(
            `UPDATE perfiles_usuario 
             SET nombre_completo = COALESCE($1, nombre_completo),
                 nombre_usuario = COALESCE($2, nombre_usuario),
                 telefono = COALESCE($3, telefono)
             WHERE id = $4
             RETURNING id, email, nombre_completo, nombre_usuario, telefono, tipo_usuario, fecha_registro`,
            [nombreCompleto, nombreUsuario, telefono, userId]
        )

        res.json({
            success: true,
            message: 'Perfil actualizado exitosamente',
            data: { user: result.rows[0] }
        })

    } catch (error) {
        console.error('Error actualizando perfil:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CAMBIAR CONTRASEÑA
// =============================================
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body
        const userId = req.user.id

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Contraseña actual y nueva son requeridas'
            })
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'La nueva contraseña debe tener al menos 6 caracteres'
            })
        }

        // Obtener contraseña actual
        const userResult = await pool.query(
            'SELECT password_hash FROM perfiles_usuario WHERE id = $1',
            [userId]
        )

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            })
        }

        // Verificar contraseña actual
        const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash)
        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña actual es incorrecta'
            })
        }

        // Hash nueva contraseña y actualizar
        const hashedNewPassword = await bcrypt.hash(newPassword, 12)
        await pool.query(
            'UPDATE perfiles_usuario SET password_hash = $1 WHERE id = $2',
            [hashedNewPassword, userId]
        )

        res.json({
            success: true,
            message: 'Contraseña cambiada exitosamente'
        })

    } catch (error) {
        console.error('Error cambiando contraseña:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// PERFIL
// =============================================
const getProfile = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, nombre_completo, nombre_usuario, telefono, tipo_usuario, activo, fecha_registro FROM perfiles_usuario WHERE id = $1',
            //                                                    ^^^^^^^^ AGREGAR ESTE CAMPO
            [req.user.id]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            })
        }

        res.json({
            success: true,
            data: { user: result.rows[0] } // ✅ Ahora incluirá telefono
        })

    } catch (error) {
        console.error('Error obteniendo perfil:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

module.exports = { register, login, getProfile, updateProfile, changePassword }