// models/User.js
const pool = require('../config/database')
const bcrypt = require('bcryptjs')

class User {
    static async create({ email, password, nombreCompleto, nombreUsuario }) {
        try {
            const hashedPassword = await bcrypt.hash(password, 12)

            const result = await pool.query(
                `INSERT INTO perfiles_usuario 
         (email, password_hash, nombre_completo, nombre_usuario, tipo_usuario) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, email, nombre_completo, nombre_usuario, tipo_usuario, fecha_registro`,
                [email, hashedPassword, nombreCompleto, nombreUsuario, 'estudiante']
            )

            return result.rows[0]
        } catch (error) {
            throw error
        }
    }

    static async findByEmail(email) {
        try {
            const result = await pool.query(
                'SELECT * FROM perfiles_usuario WHERE email = $1',
                [email]
            )
            return result.rows[0]
        } catch (error) {
            throw error
        }
    }

    static async findById(id) {
        try {
            const result = await pool.query(
                'SELECT id, email, nombre_completo, nombre_usuario, tipo_usuario, activo, fecha_registro FROM perfiles_usuario WHERE id = $1',
                [id]
            )
            return result.rows[0]
        } catch (error) {
            throw error
        }
    }

    static async findByUsername(nombreUsuario) {
        try {
            const result = await pool.query(
                'SELECT id, email, nombre_completo, nombre_usuario, tipo_usuario FROM perfiles_usuario WHERE nombre_usuario = $1',
                [nombreUsuario]
            )
            return result.rows[0]
        } catch (error) {
            throw error
        }
    }

    static async checkEmailExists(email) {
        try {
            const result = await pool.query(
                'SELECT id FROM perfiles_usuario WHERE email = $1',
                [email]
            )
            return result.rows.length > 0
        } catch (error) {
            throw error
        }
    }

    static async checkUsernameExists(nombreUsuario) {
        try {
            const result = await pool.query(
                'SELECT id FROM perfiles_usuario WHERE nombre_usuario = $1',
                [nombreUsuario]
            )
            return result.rows.length > 0
        } catch (error) {
            throw error
        }
    }

    static async validatePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword)
    }

    static async updateLastLogin(id) {
        try {
            await pool.query(
                'UPDATE perfiles_usuario SET ultima_conexion = NOW() WHERE id = $1',
                [id]
            )
        } catch (error) {
            console.error('Error updating last login:', error)
        }
    }

    static async getStats() {
        try {
            const result = await pool.query(
                `SELECT 
          COUNT(*) as total_usuarios,
          COUNT(CASE WHEN tipo_usuario = 'estudiante' THEN 1 END) as estudiantes,
          COUNT(CASE WHEN tipo_usuario = 'instructor' THEN 1 END) as instructores,
          COUNT(CASE WHEN tipo_usuario = 'admin' THEN 1 END) as admins,
          COUNT(CASE WHEN activo = true THEN 1 END) as activos
         FROM perfiles_usuario`
            )
            return result.rows[0]
        } catch (error) {
            throw error
        }
    }
}

module.exports = User