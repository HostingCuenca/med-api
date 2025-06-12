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
// CREAR CURSO (ADMIN/INSTRUCTOR) - CORREGIDO
// =============================================
// controllers/courseController.js - MÉTODOS CORREGIDOS

// =============================================
// CREAR CURSO (ADMIN/INSTRUCTOR) - LÓGICA CORREGIDA
// =============================================
const createCourse = async (req, res) => {
    try {
        let {
            titulo,
            descripcion,
            slug,
            miniatura_url,
            precio = 0,
            descuento = 0,
            tipoExamen,
            esGratuito = false
        } = req.body

        if (!titulo || !descripcion || !slug) {
            return res.status(400).json({
                success: false,
                message: 'Título, descripción y slug son requeridos'
            })
        }

        // ✅ LÓGICA CORREGIDA DE GRATUITO
        // Validar y normalizar precio
        precio = parseFloat(precio) || 0

        // Si precio es 0 o negativo → automáticamente gratuito
        if (precio <= 0) {
            esGratuito = true
            precio = 0
        }

        // Si esGratuito es true → automáticamente precio 0
        if (esGratuito) {
            precio = 0
        }

        // Validaciones adicionales
        if (precio < 0) {
            return res.status(400).json({
                success: false,
                message: 'El precio no puede ser negativo'
            })
        }

        if (descuento < 0 || descuento > 100) {
            return res.status(400).json({
                success: false,
                message: 'El descuento debe estar entre 0 y 100'
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
            `INSERT INTO cursos (titulo, descripcion, slug, miniatura_url, precio, descuento, tipo_examen, es_gratuito, instructor_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
             RETURNING *`,
            [titulo, descripcion, slug, miniatura_url, precio, descuento, tipoExamen, esGratuito, req.user.id]
        )

        res.status(201).json({
            success: true,
            message: 'Curso creado exitosamente',
            data: {
                curso: result.rows[0],
                // Información adicional para debug
                logica_aplicada: {
                    precio_final: precio,
                    es_gratuito: esGratuito,
                    razon: precio === 0 ? 'Precio 0 → Automáticamente gratuito' : esGratuito ? 'Marcado como gratuito → Precio ajustado a 0' : 'Curso de pago'
                }
            }
        })

    } catch (error) {
        console.error('Error creando curso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ACTUALIZAR CURSO (ADMIN/INSTRUCTOR) - LÓGICA CORREGIDA
// =============================================
const updateCourse = async (req, res) => {
    try {
        const { id } = req.params
        let {
            titulo,
            descripcion,
            slug,
            miniatura_url,
            precio,
            descuento,
            tipo_examen,
            es_gratuito,
            activo
        } = req.body

        // Verificar que el curso existe
        const existingCourse = await pool.query(
            'SELECT * FROM cursos WHERE id = $1',
            [id]
        )

        if (existingCourse.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        // Verificar permisos (solo el instructor del curso o admin)
        const course = existingCourse.rows[0]
        if (req.user.tipo_usuario !== 'admin' && course.instructor_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para editar este curso'
            })
        }

        // Verificar slug único (si se está cambiando)
        if (slug && slug !== course.slug) {
            const slugExists = await pool.query(
                'SELECT id FROM cursos WHERE slug = $1 AND id != $2',
                [slug, id]
            )

            if (slugExists.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El slug ya existe'
                })
            }
        }

        // ✅ APLICAR LÓGICA CORREGIDA DE GRATUITO
        if (precio !== undefined || es_gratuito !== undefined) {
            // Obtener valores actuales si no se envían
            precio = precio !== undefined ? parseFloat(precio) || 0 : course.precio
            es_gratuito = es_gratuito !== undefined ? es_gratuito : course.es_gratuito

            // Aplicar lógica de consistencia
            if (precio <= 0) {
                es_gratuito = true
                precio = 0
            }

            if (es_gratuito) {
                precio = 0
            }

            // Validaciones
            if (precio < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El precio no puede ser negativo'
                })
            }
        }

        if (descuento !== undefined && (descuento < 0 || descuento > 100)) {
            return res.status(400).json({
                success: false,
                message: 'El descuento debe estar entre 0 y 100'
            })
        }

        // Construir query dinámico
        const fieldsToUpdate = []
        const params = []
        let paramCount = 0

        if (titulo !== undefined) {
            paramCount++
            fieldsToUpdate.push(`titulo = $${paramCount}`)
            params.push(titulo)
        }

        if (descripcion !== undefined) {
            paramCount++
            fieldsToUpdate.push(`descripcion = $${paramCount}`)
            params.push(descripcion)
        }

        if (slug !== undefined) {
            paramCount++
            fieldsToUpdate.push(`slug = $${paramCount}`)
            params.push(slug)
        }

        if (miniatura_url !== undefined) {
            paramCount++
            fieldsToUpdate.push(`miniatura_url = $${paramCount}`)
            params.push(miniatura_url)
        }

        if (precio !== undefined) {
            paramCount++
            fieldsToUpdate.push(`precio = $${paramCount}`)
            params.push(precio)
        }

        if (descuento !== undefined) {
            paramCount++
            fieldsToUpdate.push(`descuento = $${paramCount}`)
            params.push(descuento)
        }

        if (tipo_examen !== undefined) {
            paramCount++
            fieldsToUpdate.push(`tipo_examen = $${paramCount}`)
            params.push(tipo_examen)
        }

        if (es_gratuito !== undefined) {
            paramCount++
            fieldsToUpdate.push(`es_gratuito = $${paramCount}`)
            params.push(es_gratuito)
        }

        if (activo !== undefined) {
            paramCount++
            fieldsToUpdate.push(`activo = $${paramCount}`)
            params.push(activo)
        }

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionaron campos para actualizar'
            })
        }

        // Agregar ID al final
        paramCount++
        params.push(id)

        const query = `
            UPDATE cursos 
            SET ${fieldsToUpdate.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `

        const result = await pool.query(query, params)

        res.json({
            success: true,
            message: 'Curso actualizado exitosamente',
            data: {
                curso: result.rows[0],
                // Información adicional para debug
                cambios_aplicados: {
                    precio_final: result.rows[0].precio,
                    es_gratuito: result.rows[0].es_gratuito,
                    logica_aplicada: result.rows[0].precio === 0 ? 'Automáticamente gratuito' : 'Curso de pago'
                }
            }
        })

    } catch (error) {
        console.error('Error actualizando curso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}



// =============================================
// ELIMINAR/DESACTIVAR CURSO (ADMIN/INSTRUCTOR)
// =============================================
const deleteCourse = async (req, res) => {
    try {
        const { id } = req.params

        // Verificar que el curso existe
        const existingCourse = await pool.query(
            'SELECT * FROM cursos WHERE id = $1',
            [id]
        )

        if (existingCourse.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        const course = existingCourse.rows[0]

        // Verificar permisos
        if (req.user.tipo_usuario !== 'admin' && course.instructor_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para eliminar este curso'
            })
        }

        // Soft delete (desactivar)
        const result = await pool.query(
            'UPDATE cursos SET activo = false WHERE id = $1 RETURNING *',
            [id]
        )

        res.json({
            success: true,
            message: 'Curso desactivado exitosamente',
            data: { curso: result.rows[0] }
        })

    } catch (error) {
        console.error('Error eliminando curso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

module.exports = {
    getCourses,
    getCourseById,
    createCourse,
    updateCourse,
    deleteCourse
}