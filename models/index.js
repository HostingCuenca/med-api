// models/index.js - Completo para Neon PostgreSQL
const pool = require('../config/database')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')

// =============================================
// MODELO BASE CON FUNCIONES COMUNES
// =============================================
class BaseModel {
    static async query(text, params) {
        try {
            const result = await pool.query(text, params)
            return result.rows
        } catch (error) {
            console.error('Database query error:', error)
            throw error
        }
    }

    static async queryOne(text, params) {
        const rows = await this.query(text, params)
        return rows[0] || null
    }
}

// =============================================
// USUARIOS
// =============================================
class User extends BaseModel {
    static async create({ email, password, nombreCompleto, nombreUsuario }) {
        const hashedPassword = await bcrypt.hash(password, 12)
        const id = uuidv4()

        return await this.queryOne(
            `INSERT INTO perfiles_usuario 
      (id, email, password_hash, nombre_completo, nombre_usuario, tipo_usuario) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING id, email, nombre_completo, nombre_usuario, tipo_usuario, fecha_registro`,
            [id, email, hashedPassword, nombreCompleto, nombreUsuario, 'estudiante']
        )
    }

    static async findByEmail(email) {
        return await this.queryOne(
            'SELECT * FROM perfiles_usuario WHERE email = $1',
            [email]
        )
    }

    static async findById(id) {
        return await this.queryOne(
            'SELECT id, email, nombre_completo, nombre_usuario, tipo_usuario, activo, fecha_registro FROM perfiles_usuario WHERE id = $1',
            [id]
        )
    }

    static async findByUsername(nombreUsuario) {
        return await this.queryOne(
            'SELECT id, email, nombre_completo, nombre_usuario, tipo_usuario FROM perfiles_usuario WHERE nombre_usuario = $1',
            [nombreUsuario]
        )
    }

    static async getAll(limit = 100, offset = 0) {
        return await this.query(
            `SELECT id, email, nombre_completo, nombre_usuario, tipo_usuario, activo, fecha_registro 
      FROM perfiles_usuario 
      ORDER BY fecha_registro DESC 
      LIMIT $1 OFFSET $2`,
            [limit, offset]
        )
    }

    static async updateRole(id, tipoUsuario) {
        return await this.queryOne(
            'UPDATE perfiles_usuario SET tipo_usuario = $1 WHERE id = $2 RETURNING id, tipo_usuario',
            [tipoUsuario, id]
        )
    }

    static async updateProfile(id, data) {
        const allowedFields = ['nombre_completo', 'nombre_usuario', 'telefono', 'avatar_url']
        const fields = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map((key, index) => `${key} = $${index + 2}`)
            .join(', ')

        if (fields.length === 0) return null

        const values = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map(key => data[key])

        return await this.queryOne(
            `UPDATE perfiles_usuario SET ${fields} WHERE id = $1 RETURNING id, email, nombre_completo, nombre_usuario, tipo_usuario`,
            [id, ...values]
        )
    }

    static async changePassword(id, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 12)
        return await this.queryOne(
            'UPDATE perfiles_usuario SET password_hash = $1 WHERE id = $2 RETURNING id',
            [hashedPassword, id]
        )
    }

    static async toggleActive(id) {
        return await this.queryOne(
            'UPDATE perfiles_usuario SET activo = NOT activo WHERE id = $1 RETURNING id, activo',
            [id]
        )
    }

    static async validatePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword)
    }

    static async getStats() {
        return await this.queryOne(
            `SELECT 
       COUNT(*) as total_usuarios,
       COUNT(CASE WHEN tipo_usuario = 'estudiante' THEN 1 END) as estudiantes,
       COUNT(CASE WHEN tipo_usuario = 'instructor' THEN 1 END) as instructores,
       COUNT(CASE WHEN tipo_usuario = 'admin' THEN 1 END) as admins,
       COUNT(CASE WHEN activo = true THEN 1 END) as activos
      FROM perfiles_usuario`
        )
    }
}

// =============================================
// CURSOS
// =============================================
class Course extends BaseModel {
    static async create({ titulo, descripcion, slug, precio = 0, descuento = 0, tipoExamen, esGratuito = false, instructorId, miniaturaUrl }) {
        const id = uuidv4()

        return await this.queryOne(
            `INSERT INTO cursos 
      (id, titulo, descripcion, slug, precio, descuento, tipo_examen, es_gratuito, instructor_id, miniatura_url) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *`,
            [id, titulo, descripcion, slug, precio, descuento, tipoExamen, esGratuito, instructorId, miniaturaUrl]
        )
    }

    static async getAll(filters = {}) {
        let whereClause = 'WHERE c.activo = true'
        let params = []
        let paramCount = 0

        if (filters.tipoExamen) {
            paramCount++
            whereClause += ` AND c.tipo_examen = $${paramCount}`
            params.push(filters.tipoExamen)
        }

        if (filters.esGratuito !== undefined) {
            paramCount++
            whereClause += ` AND c.es_gratuito = $${paramCount}`
            params.push(filters.esGratuito)
        }

        if (filters.search) {
            paramCount++
            whereClause += ` AND (c.titulo ILIKE $${paramCount} OR c.descripcion ILIKE $${paramCount})`
            params.push(`%${filters.search}%`)
        }

        return await this.query(
            `SELECT c.*, p.nombre_completo as instructor_nombre,
       (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_id = c.id AND i.estado_pago = 'habilitado') as estudiantes_inscritos
      FROM cursos c 
      LEFT JOIN perfiles_usuario p ON c.instructor_id = p.id 
      ${whereClause}
      ORDER BY c.fecha_creacion DESC`,
            params
        )
    }

    static async getById(id) {
        return await this.queryOne(
            `SELECT c.*, p.nombre_completo as instructor_nombre,
       (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_id = c.id AND i.estado_pago = 'habilitado') as estudiantes_inscritos
      FROM cursos c 
      LEFT JOIN perfiles_usuario p ON c.instructor_id = p.id 
      WHERE c.id = $1 AND c.activo = true`,
            [id]
        )
    }

    static async getBySlug(slug) {
        return await this.queryOne(
            `SELECT c.*, p.nombre_completo as instructor_nombre,
       (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_id = c.id AND i.estado_pago = 'habilitado') as estudiantes_inscritos
      FROM cursos c 
      LEFT JOIN perfiles_usuario p ON c.instructor_id = p.id 
      WHERE c.slug = $1 AND c.activo = true`,
            [slug]
        )
    }

    static async getByInstructor(instructorId) {
        return await this.query(
            `SELECT c.*,
       (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_id = c.id AND i.estado_pago = 'habilitado') as estudiantes_inscritos
      FROM cursos c 
      WHERE c.instructor_id = $1 AND c.activo = true
      ORDER BY c.fecha_creacion DESC`,
            [instructorId]
        )
    }

    static async getWithModules(cursoId) {
        const curso = await this.getById(cursoId)
        if (!curso) return null

        const modulos = await this.query(
            `SELECT m.*, 
      COALESCE(
        json_agg(
          CASE WHEN cl.id IS NOT NULL THEN
            json_build_object(
              'id', cl.id,
              'titulo', cl.titulo,
              'descripcion', cl.descripcion,
              'video_youtube_url', cl.video_youtube_url,
              'duracion_minutos', cl.duracion_minutos,
              'es_gratuita', cl.es_gratuita,
              'orden', cl.orden,
              'fecha_creacion', cl.fecha_creacion
            )
          END ORDER BY cl.orden
        ) FILTER (WHERE cl.id IS NOT NULL), '[]'::json
      ) as clases
      FROM modulos m
      LEFT JOIN clases cl ON m.id = cl.modulo_id
      WHERE m.curso_id = $1
      GROUP BY m.id, m.titulo, m.descripcion, m.orden, m.fecha_creacion
      ORDER BY m.orden`,
            [cursoId]
        )

        return { ...curso, modulos }
    }

    static async update(id, data) {
        const allowedFields = ['titulo', 'descripcion', 'precio', 'descuento', 'tipo_examen', 'es_gratuito', 'miniatura_url']
        const fields = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map((key, index) => `${key} = $${index + 2}`)
            .join(', ')

        if (fields.length === 0) return null

        const values = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map(key => data[key])

        return await this.queryOne(
            `UPDATE cursos SET ${fields} WHERE id = $1 RETURNING *`,
            [id, ...values]
        )
    }

    static async delete(id) {
        return await this.queryOne(
            'UPDATE cursos SET activo = false WHERE id = $1 RETURNING id',
            [id]
        )
    }

    static async getStats() {
        return await this.queryOne(
            `SELECT 
       COUNT(*) as total_cursos,
       COUNT(CASE WHEN es_gratuito = true THEN 1 END) as cursos_gratuitos,
       COUNT(CASE WHEN es_gratuito = false THEN 1 END) as cursos_pagos,
       AVG(precio) as precio_promedio,
       COUNT(CASE WHEN activo = true THEN 1 END) as cursos_activos
      FROM cursos`
        )
    }
}

// =============================================
// MÓDULOS
// =============================================
class Module extends BaseModel {
    static async create({ cursoId, titulo, descripcion, orden }) {
        const id = uuidv4()

        return await this.queryOne(
            'INSERT INTO modulos (id, curso_id, titulo, descripcion, orden) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [id, cursoId, titulo, descripcion, orden]
        )
    }

    static async getByCourse(cursoId) {
        return await this.query(
            'SELECT * FROM modulos WHERE curso_id = $1 ORDER BY orden',
            [cursoId]
        )
    }

    static async getById(id) {
        return await this.queryOne(
            'SELECT * FROM modulos WHERE id = $1',
            [id]
        )
    }

    static async update(id, data) {
        const allowedFields = ['titulo', 'descripcion', 'orden']
        const fields = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map((key, index) => `${key} = $${index + 2}`)
            .join(', ')

        if (fields.length === 0) return null

        const values = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map(key => data[key])

        return await this.queryOne(
            `UPDATE modulos SET ${fields} WHERE id = $1 RETURNING *`,
            [id, ...values]
        )
    }

    static async delete(id) {
        return await this.queryOne(
            'DELETE FROM modulos WHERE id = $1 RETURNING id',
            [id]
        )
    }
}

// =============================================
// CLASES
// =============================================
class Lesson extends BaseModel {
    static async create({ moduloId, titulo, descripcion, videoYoutubeUrl, duracionMinutos, esGratuita = false, orden }) {
        const id = uuidv4()

        return await this.queryOne(
            `INSERT INTO clases 
      (id, modulo_id, titulo, descripcion, video_youtube_url, duracion_minutos, es_gratuita, orden) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [id, moduloId, titulo, descripcion, videoYoutubeUrl, duracionMinutos, esGratuita, orden]
        )
    }

    static async getByModule(moduloId) {
        return await this.query(
            'SELECT * FROM clases WHERE modulo_id = $1 ORDER BY orden',
            [moduloId]
        )
    }

    static async getById(id) {
        return await this.queryOne(
            'SELECT * FROM clases WHERE id = $1',
            [id]
        )
    }

    static async update(id, data) {
        const allowedFields = ['titulo', 'descripcion', 'video_youtube_url', 'duracion_minutos', 'es_gratuita', 'orden']
        const fields = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map((key, index) => `${key} = $${index + 2}`)
            .join(', ')

        if (fields.length === 0) return null

        const values = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map(key => data[key])

        return await this.queryOne(
            `UPDATE clases SET ${fields} WHERE id = $1 RETURNING *`,
            [id, ...values]
        )
    }

    static async delete(id) {
        return await this.queryOne(
            'DELETE FROM clases WHERE id = $1 RETURNING id',
            [id]
        )
    }
}

// =============================================
// INSCRIPCIONES
// =============================================
class Enrollment extends BaseModel {
    static async create({ usuarioId, cursoId }) {
        const id = uuidv4()

        return await this.queryOne(
            'INSERT INTO inscripciones (id, usuario_id, curso_id) VALUES ($1, $2, $3) RETURNING *',
            [id, usuarioId, cursoId]
        )
    }

    static async getByUser(usuarioId) {
        return await this.query(
            `SELECT i.*, c.titulo as curso_titulo, c.slug as curso_slug, c.miniatura_url, c.precio,
       p.nombre_completo as instructor_nombre
      FROM inscripciones i
      JOIN cursos c ON i.curso_id = c.id
      LEFT JOIN perfiles_usuario p ON c.instructor_id = p.id
      WHERE i.usuario_id = $1
      ORDER BY i.fecha_inscripcion DESC`,
            [usuarioId]
        )
    }

    static async getByUserAndCourse(usuarioId, cursoId) {
        return await this.queryOne(
            'SELECT * FROM inscripciones WHERE usuario_id = $1 AND curso_id = $2',
            [usuarioId, cursoId]
        )
    }

    static async checkAccess(usuarioId, cursoId) {
        return await this.queryOne(
            `SELECT i.*, c.es_gratuito FROM inscripciones i
      JOIN cursos c ON i.curso_id = c.id
      WHERE i.usuario_id = $1 AND i.curso_id = $2 
      AND (i.estado_pago = 'habilitado' OR c.es_gratuito = true)`,
            [usuarioId, cursoId]
        )
    }

    static async getPendingPayments() {
        return await this.query(
            `SELECT i.*, u.nombre_completo, u.email, u.nombre_usuario, c.titulo as curso_titulo, c.precio
      FROM inscripciones i
      JOIN perfiles_usuario u ON i.usuario_id = u.id
      JOIN cursos c ON i.curso_id = c.id
      WHERE i.estado_pago = 'pendiente'
      ORDER BY i.fecha_inscripcion DESC`
        )
    }

    static async approvePayment(id, adminId) {
        return await this.queryOne(
            `UPDATE inscripciones 
      SET estado_pago = 'habilitado', fecha_habilitacion = NOW(), habilitado_por = $1 
      WHERE id = $2 RETURNING *`,
            [adminId, id]
        )
    }

    static async updateStatus(id, estado) {
        return await this.queryOne(
            'UPDATE inscripciones SET estado_pago = $1 WHERE id = $2 RETURNING *',
            [estado, id]
        )
    }

    static async getStats() {
        return await this.queryOne(
            `SELECT 
       COUNT(*) as total_inscripciones,
       COUNT(CASE WHEN estado_pago = 'habilitado' THEN 1 END) as habilitadas,
       COUNT(CASE WHEN estado_pago = 'pendiente' THEN 1 END) as pendientes,
       COUNT(CASE WHEN estado_pago = 'pagado' THEN 1 END) as pagadas
      FROM inscripciones`
        )
    }
}

// =============================================
// SIMULACROS
// =============================================
class Simulacro extends BaseModel {
    static async create({ cursoId, titulo, descripcion, modoEvaluacion, tiempoLimiteMinutos, tiempoPorPreguntaSegundos, numeroPreguntas, intentosPermitidos = -1, randomizarPreguntas = true, randomizarOpciones = true, mostrarRespuestasDespues = 1 }) {
        const id = uuidv4()

        return await this.queryOne(
            `INSERT INTO simulacros 
      (id, curso_id, titulo, descripcion, modo_evaluacion, tiempo_limite_minutos, tiempo_por_pregunta_segundos, numero_preguntas, intentos_permitidos, randomizar_preguntas, randomizar_opciones, mostrar_respuestas_despues) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [id, cursoId, titulo, descripcion, modoEvaluacion, tiempoLimiteMinutos, tiempoPorPreguntaSegundos, numeroPreguntas, intentosPermitidos, randomizarPreguntas, randomizarOpciones, mostrarRespuestasDespues]
        )
    }

    static async getByCourse(cursoId) {
        return await this.query(
            `SELECT s.*,
       (SELECT COUNT(*) FROM preguntas p WHERE p.simulacro_id = s.id) as total_preguntas_creadas
      FROM simulacros s 
      WHERE s.curso_id = $1 AND s.activo = true 
      ORDER BY s.fecha_creacion`,
            [cursoId]
        )
    }

    static async getById(id) {
        return await this.queryOne(
            'SELECT * FROM simulacros WHERE id = $1 AND activo = true',
            [id]
        )
    }

    static async getWithQuestions(simulacroId, randomize = false) {
        const simulacro = await this.queryOne(
            'SELECT * FROM simulacros WHERE id = $1 AND activo = true',
            [simulacroId]
        )

        if (!simulacro) return null

        const orderClause = randomize && simulacro.randomizar_preguntas ? 'ORDER BY RANDOM()' : 'ORDER BY p.fecha_creacion'
        const limitClause = simulacro.numero_preguntas > 0 ? `LIMIT ${simulacro.numero_preguntas}` : ''

        const preguntas = await this.query(
            `SELECT p.*, 
      COALESCE(
        json_agg(
          CASE WHEN o.id IS NOT NULL THEN
            json_build_object(
              'id', o.id,
              'texto_opcion', o.texto_opcion,
              'es_correcta', o.es_correcta,
              'orden', o.orden
            )
          END ORDER BY ${randomize && simulacro.randomizar_opciones ? 'RANDOM()' : 'o.orden'}
        ) FILTER (WHERE o.id IS NOT NULL), '[]'::json
      ) as opciones
      FROM preguntas p
      LEFT JOIN opciones_respuesta o ON p.id = o.pregunta_id
      WHERE p.simulacro_id = $1
      GROUP BY p.id, p.enunciado, p.tipo_pregunta, p.explicacion, p.imagen_url, p.fecha_creacion
      ${orderClause} ${limitClause}`,
            [simulacroId]
        )

        return { ...simulacro, preguntas }
    }

    static async update(id, data) {
        const allowedFields = ['titulo', 'descripcion', 'modo_evaluacion', 'tiempo_limite_minutos', 'tiempo_por_pregunta_segundos', 'numero_preguntas', 'intentos_permitidos', 'randomizar_preguntas', 'randomizar_opciones', 'mostrar_respuestas_despues']
        const fields = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map((key, index) => `${key} = $${index + 2}`)
            .join(', ')

        if (fields.length === 0) return null

        const values = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map(key => data[key])

        return await this.queryOne(
            `UPDATE simulacros SET ${fields} WHERE id = $1 RETURNING *`,
            [id, ...values]
        )
    }

    static async delete(id) {
        return await this.queryOne(
            'UPDATE simulacros SET activo = false WHERE id = $1 RETURNING id',
            [id]
        )
    }
}

// =============================================
// PREGUNTAS
// =============================================
class Question extends BaseModel {
    static async create({ simulacroId, enunciado, tipoPregunta, explicacion, imagenUrl }) {
        const id = uuidv4()

        return await this.queryOne(
            `INSERT INTO preguntas 
      (id, simulacro_id, enunciado, tipo_pregunta, explicacion, imagen_url) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [id, simulacroId, enunciado, tipoPregunta, explicacion, imagenUrl]
        )
    }

    static async getBySimulacro(simulacroId) {
        return await this.query(
            'SELECT * FROM preguntas WHERE simulacro_id = $1 ORDER BY fecha_creacion',
            [simulacroId]
        )
    }

    static async getById(id) {
        return await this.queryOne(
            'SELECT * FROM preguntas WHERE id = $1',
            [id]
        )
    }

    static async update(id, data) {
        const allowedFields = ['enunciado', 'tipo_pregunta', 'explicacion', 'imagen_url']
        const fields = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map((key, index) => `${key} = $${index + 2}`)
            .join(', ')

        if (fields.length === 0) return null

        const values = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map(key => data[key])

        return await this.queryOne(
            `UPDATE preguntas SET ${fields} WHERE id = $1 RETURNING *`,
            [id, ...values]
        )
    }

    static async delete(id) {
        return await this.queryOne(
            'DELETE FROM preguntas WHERE id = $1 RETURNING id',
            [id]
        )
    }
}

// =============================================
// OPCIONES DE RESPUESTA
// =============================================
class QuestionOption extends BaseModel {
    static async create({ preguntaId, textoOpcion, esCorrecta, orden }) {
        const id = uuidv4()

        return await this.queryOne(
            'INSERT INTO opciones_respuesta (id, pregunta_id, texto_opcion, es_correcta, orden) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [id, preguntaId, textoOpcion, esCorrecta, orden]
        )
    }

    static async getByQuestion(preguntaId) {
        return await this.query(
            'SELECT * FROM opciones_respuesta WHERE pregunta_id = $1 ORDER BY orden',
            [preguntaId]
        )
    }

    static async update(id, data) {
        const allowedFields = ['texto_opcion', 'es_correcta', 'orden']
        const fields = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map((key, index) => `${key} = $${index + 2}`)
            .join(', ')

        if (fields.length === 0) return null

        const values = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map(key => data[key])

        return await this.queryOne(
            `UPDATE opciones_respuesta SET ${fields} WHERE id = $1 RETURNING *`,
            [id, ...values]
        )
    }

    static async delete(id) {
        return await this.queryOne(
            'DELETE FROM opciones_respuesta WHERE id = $1 RETURNING id',
            [id]
        )
    }
}

// =============================================
// PROGRESO Y ESTADÍSTICAS
// =============================================
class Progress extends BaseModel {
    static async updateClassProgress(usuarioId, claseId, porcentajeVisto, completada = false) {
        const id = uuidv4()

        return await this.queryOne(
            `INSERT INTO progreso_clases (id, usuario_id, clase_id, porcentaje_visto, completada)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (usuario_id, clase_id)
      DO UPDATE SET porcentaje_visto = $4, completada = $5, fecha_ultima_vista = NOW()
      RETURNING *`,
            [id, usuarioId, claseId, porcentajeVisto, completada]
        )
    }

    static async getCourseProgress(usuarioId, cursoId) {
        return await this.queryOne(
            `SELECT 
        COUNT(cl.id) as total_clases,
        COUNT(CASE WHEN pc.completada = true THEN 1 END) as clases_completadas,
        COALESCE(AVG(pc.porcentaje_visto), 0) as progreso_promedio
      FROM clases cl
      JOIN modulos m ON cl.modulo_id = m.id
      LEFT JOIN progreso_clases pc ON cl.id = pc.clase_id AND pc.usuario_id = $1
      WHERE m.curso_id = $2`,
            [usuarioId, cursoId]
        )
    }

    static async getUserProgress(usuarioId) {
        return await this.query(
            `SELECT c.id as curso_id, c.titulo, c.slug,
        COUNT(cl.id) as total_clases,
        COUNT(CASE WHEN pc.completada = true THEN 1 END) as clases_completadas,
        COALESCE(AVG(pc.porcentaje_visto), 0) as progreso_promedio
      FROM inscripciones i
      JOIN cursos c ON i.curso_id = c.id
      JOIN modulos m ON c.id = m.curso_id
      JOIN clases cl ON m.id = cl.modulo_id
      LEFT JOIN progreso_clases pc ON cl.id = pc.clase_id AND pc.usuario_id = $1
      WHERE i.usuario_id = $1 AND i.estado_pago = 'habilitado'
      GROUP BY c.id, c.titulo, c.slug
      ORDER BY progreso_promedio DESC`,
            [usuarioId]
        )
    }
}

// =============================================
// INTENTOS DE SIMULACRO
// =============================================
class SimulacroAttempt extends BaseModel {
    static async create({ usuarioId, simulacroId, puntaje, totalPreguntas, respuestasCorrectas, tiempoEmpleadoMinutos }) {
        const id = uuidv4()

        return await this.queryOne(
            `INSERT INTO intentos_simulacro 
      (id, usuario_id, simulacro_id, puntaje, total_preguntas, respuestas_correctas, tiempo_empleado_minutos) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [id, usuarioId, simulacroId, puntaje, totalPreguntas, respuestasCorrectas, tiempoEmpleadoMinutos]
        )
    }

    static async getByUser(usuarioId, simulacroId = null) {
        const whereClause = simulacroId ? 'WHERE ia.usuario_id = $1 AND ia.simulacro_id = $2' : 'WHERE ia.usuario_id = $1'
        const params = simulacroId ? [usuarioId, simulacroId] : [usuarioId]

        return await this.query(
            `SELECT ia.*, s.titulo as simulacro_titulo, c.titulo as curso_titulo
      FROM intentos_simulacro ia
      JOIN simulacros s ON ia.simulacro_id = s.id
      JOIN cursos c ON s.curso_id = c.id
      ${whereClause}
      ORDER BY ia.fecha_intento DESC`,
            params
        )
    }

    static async getById(id) {
        return await this.queryOne(
            'SELECT * FROM intentos_simulacro WHERE id = $1',
            [id]
        )
    }

    static async getUserAttemptCount(usuarioId, simulacroId) {
        const result = await this.queryOne(
            'SELECT COUNT(*) as intentos FROM intentos_simulacro WHERE usuario_id = $1 AND simulacro_id = $2',
            [usuarioId, simulacroId]
        )
        return parseInt(result.intentos)
    }

    static async getBestScore(usuarioId, simulacroId) {
        return await this.queryOne(
            'SELECT MAX(puntaje) as mejor_puntaje FROM intentos_simulacro WHERE usuario_id = $1 AND simulacro_id = $2',
            [usuarioId, simulacroId]
        )
    }

    static async getStats(simulacroId = null) {
        const whereClause = simulacroId ? 'WHERE simulacro_id = $1' : ''
        const params = simulacroId ? [simulacroId] : []

        return await this.queryOne(
            `SELECT 
       COUNT(*) as total_intentos,
       AVG(puntaje) as puntaje_promedio,
       MAX(puntaje) as puntaje_maximo,
       MIN(puntaje) as puntaje_minimo,
       AVG(tiempo_empleado_minutos) as tiempo_promedio
      FROM intentos_simulacro ${whereClause}`,
            params
        )
    }
}

// =============================================
// RESPUESTAS DE USUARIO
// =============================================
class UserAnswer extends BaseModel {
    static async create({ intentoSimulacroId, preguntaId, opcionSeleccionadaId, esCorrecta }) {
        const id = uuidv4()

        return await this.queryOne(
            `INSERT INTO respuestas_usuario 
      (id, intento_simulacro_id, pregunta_id, opcion_seleccionada_id, es_correcta) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [id, intentoSimulacroId, preguntaId, opcionSeleccionadaId, esCorrecta]
        )
    }

    static async getByAttempt(intentoSimulacroId) {
        return await this.query(
            `SELECT ru.*, p.enunciado, p.explicacion, o.texto_opcion
      FROM respuestas_usuario ru
      JOIN preguntas p ON ru.pregunta_id = p.id
      JOIN opciones_respuesta o ON ru.opcion_seleccionada_id = o.id
      WHERE ru.intento_simulacro_id = $1
      ORDER BY ru.fecha_respuesta`,
            [intentoSimulacroId]
        )
    }

    static async bulkCreate(respuestas) {
        if (!respuestas.length) return []

        const values = respuestas.map(r => `('${uuidv4()}', '${r.intentoSimulacroId}', '${r.preguntaId}', '${r.opcionSeleccionadaId}', ${r.esCorrecta}, NOW())`).join(', ')

        return await this.query(
            `INSERT INTO respuestas_usuario 
      (id, intento_simulacro_id, pregunta_id, opcion_seleccionada_id, es_correcta, fecha_respuesta) 
      VALUES ${values} RETURNING *`
        )
    }
}

// =============================================
// MATERIALES DESCARGABLES
// =============================================
class Material extends BaseModel {
    static async create({ titulo, descripcion, archivoUrl, tipoArchivo, precio = 0, esGratuito = false, cursoId }) {
        const id = uuidv4()

        return await this.queryOne(
            `INSERT INTO materiales 
      (id, titulo, descripcion, archivo_url, tipo_archivo, precio, es_gratuito, curso_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [id, titulo, descripcion, archivoUrl, tipoArchivo, precio, esGratuito, cursoId]
        )
    }

    static async getByCourse(cursoId) {
        return await this.query(
            'SELECT * FROM materiales WHERE curso_id = $1 ORDER BY fecha_creacion DESC',
            [cursoId]
        )
    }

    static async getAll() {
        return await this.query(
            `SELECT m.*, c.titulo as curso_titulo 
      FROM materiales m 
      LEFT JOIN cursos c ON m.curso_id = c.id 
      ORDER BY m.fecha_creacion DESC`
        )
    }

    static async getById(id) {
        return await this.queryOne(
            'SELECT * FROM materiales WHERE id = $1',
            [id]
        )
    }

    static async update(id, data) {
        const allowedFields = ['titulo', 'descripcion', 'archivo_url', 'tipo_archivo', 'precio', 'es_gratuito']
        const fields = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map((key, index) => `${key} = $${index + 2}`)
            .join(', ')

        if (fields.length === 0) return null

        const values = Object.keys(data)
            .filter(key => allowedFields.includes(key))
            .map(key => data[key])

        return await this.queryOne(
            `UPDATE materiales SET ${fields} WHERE id = $1 RETURNING *`,
            [id, ...values]
        )
    }

    static async delete(id) {
        return await this.queryOne(
            'DELETE FROM materiales WHERE id = $1 RETURNING id',
            [id]
        )
    }
}

// =============================================
// UTILIDADES Y HELPERS
// =============================================
class Utils extends BaseModel {
    static async getDashboardStats() {
        const [userStats, courseStats, enrollmentStats] = await Promise.all([
            User.getStats(),
            Course.getStats(),
            Enrollment.getStats()
        ])

        return {
            usuarios: userStats,
            cursos: courseStats,
            inscripciones: enrollmentStats
        }
    }

    static async searchGlobal(query, limit = 10) {
        const searchTerm = `%${query}%`

        const [cursos, usuarios] = await Promise.all([
            this.query(
                `SELECT 'curso' as tipo, id, titulo as nombre, descripcion 
        FROM cursos 
        WHERE (titulo ILIKE $1 OR descripcion ILIKE $1) AND activo = true
        LIMIT $2`,
                [searchTerm, limit]
            ),
            this.query(
                `SELECT 'usuario' as tipo, id, nombre_completo as nombre, email as descripcion 
        FROM perfiles_usuario 
        WHERE (nombre_completo ILIKE $1 OR email ILIKE $1 OR nombre_usuario ILIKE $1) AND activo = true
        LIMIT $2`,
                [searchTerm, limit]
            )
        ])

        return [...cursos, ...usuarios]
    }

    static generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remover caracteres especiales
            .replace(/[\s_-]+/g, '-') // Reemplazar espacios con guiones
            .replace(/^-+|-+$/g, '') // Remover guiones al inicio/final
    }

    static async checkSlugUnique(slug, excludeId = null) {
        const whereClause = excludeId ? 'WHERE slug = $1 AND id != $2' : 'WHERE slug = $1'
        const params = excludeId ? [slug, excludeId] : [slug]

        const result = await this.queryOne(
            `SELECT id FROM cursos ${whereClause}`,
            params
        )

        return !result
    }

    static async generateUniqueSlug(title, excludeId = null) {
        let baseSlug = this.generateSlug(title)
        let slug = baseSlug
        let counter = 1

        while (!(await this.checkSlugUnique(slug, excludeId))) {
            slug = `${baseSlug}-${counter}`
            counter++
        }

        return slug
    }
}

// =============================================
// EXPORTAR TODOS LOS MODELOS
// =============================================
module.exports = {
    User,
    Course,
    Module,
    Lesson,
    Enrollment,
    Simulacro,
    Question,
    QuestionOption,
    Progress,
    SimulacroAttempt,
    UserAnswer,
    Material,
    Utils,
    BaseModel
}