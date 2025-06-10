// middleware/auth.js
const jwt = require('jsonwebtoken')
const pool = require('../config/database')

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization']
        const token = authHeader && authHeader.split(' ')[1]

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token requerido'
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const result = await pool.query(
            'SELECT id, email, nombre_completo, nombre_usuario, tipo_usuario, activo FROM perfiles_usuario WHERE id = $1',
            [decoded.userId]
        )

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no encontrado'
            })
        }

        const user = result.rows[0]

        if (!user.activo) {
            return res.status(401).json({
                success: false,
                message: 'Cuenta desactivada'
            })
        }

        req.user = user
        next()
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: 'Token inválido'
        })
    }
}

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.tipo_usuario)) {
            return res.status(403).json({
                success: false,
                message: 'Permisos insuficientes'
            })
        }
        next()
    }
}

module.exports = { authenticateToken, requireRole }