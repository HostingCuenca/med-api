// controllers/courseManagementController.js
const pool = require('../config/database')

// =============================================
// VERIFICAR PERMISOS DE CURSO
// =============================================
const checkCoursePermission = async (userId, userRole, cursoId) => {
    if (userRole === 'admin') return true

    const result = await pool.query(
        'SELECT id FROM cursos WHERE id = $1 AND instructor_id = $2',
        [cursoId, userId]
    )

    return result.rows.length > 0
}

// =============================================
// CREAR MÓDULO
// =============================================
const createModule = async (req, res) => {
    try {
        const { cursoId, titulo, descripcion, orden } = req.body

        if (!cursoId || !titulo || orden === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Curso ID, título y orden son requeridos'
            })
        }

        // Verificar permisos
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar este curso'
            })
        }

        // Verificar que el curso existe
        const cursoCheck = await pool.query(
            'SELECT titulo FROM cursos WHERE id = $1 AND activo = true',
            [cursoId]
        )

        if (cursoCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        const result = await pool.query(
            'INSERT INTO modulos (curso_id, titulo, descripcion, orden) VALUES ($1, $2, $3, $4) RETURNING *',
            [cursoId, titulo, descripcion, orden]
        )

        res.status(201).json({
            success: true,
            message: 'Módulo creado exitosamente',
            data: { modulo: result.rows[0] }
        })

    } catch (error) {
        console.error('Error creando módulo:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CREAR CLASE
// =============================================
const createClass = async (req, res) => {
    try {
        const {
            moduloId, titulo, descripcion, videoYoutubeUrl,
            duracionMinutos, esGratuita = false, orden
        } = req.body

        if (!moduloId || !titulo || orden === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Módulo ID, título y orden son requeridos'
            })
        }

        // Verificar permisos del módulo
        const permisoCheck = await pool.query(
            `SELECT c.id, c.titulo FROM modulos m 
       JOIN cursos c ON m.curso_id = c.id 
       WHERE m.id = $1`,
            [moduloId]
        )

        if (permisoCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Módulo no encontrado'
            })
        }

        const curso = permisoCheck.rows[0]
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, curso.id)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar este curso'
            })
        }

        const result = await pool.query(
            `INSERT INTO clases (modulo_id, titulo, descripcion, video_youtube_url, duracion_minutos, es_gratuita, orden) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [moduloId, titulo, descripcion, videoYoutubeUrl, duracionMinutos, esGratuita, orden]
        )

        res.status(201).json({
            success: true,
            message: 'Clase creada exitosamente',
            data: { clase: result.rows[0] }
        })

    } catch (error) {
        console.error('Error creando clase:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CREAR SIMULACRO
// =============================================
const createSimulacro = async (req, res) => {
    try {
        const {
            cursoId, titulo, descripcion, modoEvaluacion,
            tiempoLimiteMinutos, tiempoPorPreguntaSegundos,
            numeroPreguntas, intentosPermitidos = -1,
            randomizarPreguntas = true, randomizarOpciones = true,
            mostrarRespuestasDespues = 1
        } = req.body

        if (!cursoId || !titulo || !modoEvaluacion || !numeroPreguntas) {
            return res.status(400).json({
                success: false,
                message: 'Campos requeridos: cursoId, titulo, modoEvaluacion, numeroPreguntas'
            })
        }

        if (!['practica', 'realista', 'examen'].includes(modoEvaluacion)) {
            return res.status(400).json({
                success: false,
                message: 'Modo de evaluación inválido. Opciones: practica, realista, examen'
            })
        }

        // Verificar permisos
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar este curso'
            })
        }

        const result = await pool.query(
            `INSERT INTO simulacros 
       (curso_id, titulo, descripcion, modo_evaluacion, tiempo_limite_minutos, 
        tiempo_por_pregunta_segundos, numero_preguntas, intentos_permitidos,
        randomizar_preguntas, randomizar_opciones, mostrar_respuestas_despues) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [cursoId, titulo, descripcion, modoEvaluacion, tiempoLimiteMinutos,
                tiempoPorPreguntaSegundos, numeroPreguntas, intentosPermitidos,
                randomizarPreguntas, randomizarOpciones, mostrarRespuestasDespues]
        )

        res.status(201).json({
            success: true,
            message: 'Simulacro creado exitosamente',
            data: { simulacro: result.rows[0] }
        })

    } catch (error) {
        console.error('Error creando simulacro:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CREAR PREGUNTA CON OPCIONES
// =============================================
const createQuestion = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const { simulacroId, enunciado, tipoPregunta, explicacion, imagenUrl, opciones } = req.body

        if (!simulacroId || !enunciado || !tipoPregunta || !opciones || !Array.isArray(opciones)) {
            return res.status(400).json({
                success: false,
                message: 'simulacroId, enunciado, tipoPregunta y opciones son requeridos'
            })
        }

        if (!['multiple', 'multiple_respuesta', 'completar', 'unir', 'rellenar'].includes(tipoPregunta)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de pregunta inválido'
            })
        }

        if (opciones.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Debe haber al menos 2 opciones'
            })
        }

        // Verificar que hay al menos una respuesta correcta
        const hasCorrectAnswer = opciones.some(opcion => opcion.esCorrecta === true)
        if (!hasCorrectAnswer) {
            return res.status(400).json({
                success: false,
                message: 'Debe haber al menos una respuesta correcta'
            })
        }

        // Verificar permisos del simulacro
        const simulacroCheck = await client.query(
            `SELECT c.id FROM simulacros s 
       JOIN cursos c ON s.curso_id = c.id 
       WHERE s.id = $1`,
            [simulacroId]
        )

        if (simulacroCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Simulacro no encontrado'
            })
        }

        const cursoId = simulacroCheck.rows[0].id
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar este simulacro'
            })
        }

        // Crear pregunta
        const preguntaResult = await client.query(
            'INSERT INTO preguntas (simulacro_id, enunciado, tipo_pregunta, explicacion, imagen_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [simulacroId, enunciado, tipoPregunta, explicacion, imagenUrl]
        )

        const preguntaId = preguntaResult.rows[0].id

        // Crear opciones
        const opcionesCreadas = []
        for (let i = 0; i < opciones.length; i++) {
            const { textoOpcion, esCorrecta } = opciones[i]

            if (!textoOpcion || textoOpcion.trim() === '') {
                await client.query('ROLLBACK')
                return res.status(400).json({
                    success: false,
                    message: `La opción ${i + 1} no puede estar vacía`
                })
            }

            const opcionResult = await client.query(
                'INSERT INTO opciones_respuesta (pregunta_id, texto_opcion, es_correcta, orden) VALUES ($1, $2, $3, $4) RETURNING *',
                [preguntaId, textoOpcion.trim(), esCorrecta === true, i + 1]
            )
            opcionesCreadas.push(opcionResult.rows[0])
        }

        await client.query('COMMIT')

        res.status(201).json({
            success: true,
            message: 'Pregunta creada exitosamente',
            data: {
                pregunta: preguntaResult.rows[0],
                opciones: opcionesCreadas
            }
        })

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Error creando pregunta:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    } finally {
        client.release()
    }
}

// =============================================
// OBTENER CONTENIDO DEL CURSO PARA EDICIÓN
// =============================================
const getCourseContent = async (req, res) => {
    try {
        const { cursoId } = req.params

        // Verificar permisos
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver este curso'
            })
        }

        // Obtener curso
        const cursoResult = await pool.query(
            'SELECT * FROM cursos WHERE id = $1',
            [cursoId]
        )

        if (cursoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        // Obtener módulos con clases
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
            [cursoId]
        )

        // Obtener simulacros
        const simulacrosResult = await pool.query(
            `SELECT s.*,
       (SELECT COUNT(*) FROM preguntas p WHERE p.simulacro_id = s.id) as total_preguntas
       FROM simulacros s 
       WHERE s.curso_id = $1 AND s.activo = true 
       ORDER BY s.fecha_creacion`,
            [cursoId]
        )

        res.json({
            success: true,
            data: {
                curso: cursoResult.rows[0],
                modulos: modulosResult.rows,
                simulacros: simulacrosResult.rows
            }
        })

    } catch (error) {
        console.error('Error obteniendo contenido del curso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

module.exports = {
    createModule,
    createClass,
    createSimulacro,
    createQuestion,
    getCourseContent
}