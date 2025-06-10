// controllers/courseController.js
const pool = require('../config/database')

// =============================================
// OBTENER TODOS LOS CURSOS
// =============================================
const getCourses = async (req, res) => {
    try {
        const { tipo, gratuito, search } = req.query

        let query = `
      SELECT c.*, p.nombre_completo as instructor_nombre,
      (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_id = c.id AND i.estado_pago = 'habilitado') as estudiantes_inscritos
      FROM cursos c 
      LEFT JOIN perfiles_usuario p ON c.instructor_id = p.id 
      WHERE c.activo = true
    `
        const params = []
        let paramCount = 0

        if (tipo) {
            paramCount++
            query += ` AND c.tipo_examen = $${paramCount}`
            params.push(tipo)
        }

        if (gratuito !== undefined) {
            paramCount++
            query += ` AND c.es_gratuito = $${paramCount}`
            params.push(gratuito === 'true')
        }

        if (search) {
            paramCount++
            query += ` AND (c.titulo ILIKE $${paramCount} OR c.descripcion ILIKE $${paramCount})`
            params.push(`%${search}%`)
        }

        query += ' ORDER BY c.fecha_creacion DESC'

        const result = await pool.query(query, params)

        res.json({
            success: true,
            data: {
                cursos: result.rows,
                total: result.rows.length
            }
        })

    } catch (error) {
        console.error('Error obteniendo cursos:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// OBTENER CURSO POR ID
// =============================================
const getCourseById = async (req, res) => {
    try {
        const { id } = req.params

        const result = await pool.query(
            `SELECT c.*, p.nombre_completo as instructor_nombre,
       (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_id = c.id AND i.estado_pago = 'habilitado') as estudiantes_inscritos
       FROM cursos c 
       LEFT JOIN perfiles_usuario p ON c.instructor_id = p.id 
       WHERE c.id = $1 AND c.activo = true`,
            [id]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        // Obtener módulos y clases
        const modulosResult = await pool.query(
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
               'orden', cl.orden
             )
           END ORDER BY cl.orden
         ) FILTER (WHERE cl.id IS NOT NULL), '[]'::json
       ) as clases
       FROM modulos m
       LEFT JOIN clases cl ON m.id = cl.modulo_id
       WHERE m.curso_id = $1
       GROUP BY m.id
       ORDER BY m.orden`,
            [id]
        )

        const curso = result.rows[0]
        curso.modulos = modulosResult.rows

        res.json({
            success: true,
            data: { curso }
        })

    } catch (error) {
        console.error('Error obteniendo curso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CREAR CURSO (ADMIN/INSTRUCTOR)
// =============================================
const createCourse = async (req, res) => {
    try {
        const { titulo, descripcion, slug, precio = 0, tipoExamen, esGratuito = false } = req.body

        if (!titulo || !descripcion || !slug) {
            return res.status(400).json({
                success: false,
                message: 'Título, descripción y slug son requeridos'
            })
        }

        // Verificar slug único
        const existingSlug = await pool.query(
            'SELECT id FROM cursos WHERE slug = $1',
            [slug]
        )

        if (existingSlug.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El slug ya existe'
            })
        }

        const result = await pool.query(
            `INSERT INTO cursos (titulo, descripcion, slug, precio, tipo_examen, es_gratuito, instructor_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
            [titulo, descripcion, slug, precio, tipoExamen, esGratuito, req.user.id]
        )

        res.status(201).json({
            success: true,
            message: 'Curso creado exitosamente',
            data: { curso: result.rows[0] }
        })

    } catch (error) {
        console.error('Error creando curso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

module.exports = { getCourses, getCourseById, createCourse }