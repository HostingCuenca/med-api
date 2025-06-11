// controllers/courseManagementController.js - COMPLETO AL 100%
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
                            'orden', cl.orden,
                            'fecha_creacion', cl.fecha_creacion
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

// ==================== GESTIÓN DE MÓDULOS ====================

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
// ACTUALIZAR MÓDULO - NUEVO
// =============================================
const updateModule = async (req, res) => {
    try {
        const { id } = req.params
        const { titulo, descripcion, orden } = req.body

        // Verificar permisos del módulo
        const moduleCheck = await pool.query(
            `SELECT c.id as curso_id FROM modulos m 
             JOIN cursos c ON m.curso_id = c.id 
             WHERE m.id = $1`,
            [id]
        )

        if (moduleCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Módulo no encontrado'
            })
        }

        const cursoId = moduleCheck.rows[0].curso_id
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar este módulo'
            })
        }

        const result = await pool.query(
            'UPDATE modulos SET titulo = $1, descripcion = $2, orden = $3 WHERE id = $4 RETURNING *',
            [titulo, descripcion, orden, id]
        )

        res.json({
            success: true,
            message: 'Módulo actualizado exitosamente',
            data: { modulo: result.rows[0] }
        })

    } catch (error) {
        console.error('Error actualizando módulo:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ELIMINAR MÓDULO - NUEVO
// =============================================
const deleteModule = async (req, res) => {
    try {
        const { id } = req.params

        // Verificar permisos
        const moduleCheck = await pool.query(
            `SELECT c.id as curso_id FROM modulos m 
             JOIN cursos c ON m.curso_id = c.id 
             WHERE m.id = $1`,
            [id]
        )

        if (moduleCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Módulo no encontrado'
            })
        }

        const cursoId = moduleCheck.rows[0].curso_id
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para eliminar este módulo'
            })
        }

        // Eliminar módulo (cascada eliminará clases automáticamente)
        await pool.query('DELETE FROM modulos WHERE id = $1', [id])

        res.json({
            success: true,
            message: 'Módulo eliminado exitosamente'
        })

    } catch (error) {
        console.error('Error eliminando módulo:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// REORDENAR MÓDULOS - NUEVO
// =============================================
const reorderModules = async (req, res) => {
    try {
        const { cursoId, moduleOrders } = req.body

        if (!cursoId || !Array.isArray(moduleOrders)) {
            return res.status(400).json({
                success: false,
                message: 'cursoId y moduleOrders son requeridos'
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

        // Actualizar orden de cada módulo
        for (const moduleOrder of moduleOrders) {
            await pool.query(
                'UPDATE modulos SET orden = $1 WHERE id = $2 AND curso_id = $3',
                [moduleOrder.orden, moduleOrder.id, cursoId]
            )
        }

        res.json({
            success: true,
            message: 'Módulos reordenados exitosamente'
        })

    } catch (error) {
        console.error('Error reordenando módulos:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// ==================== GESTIÓN DE CLASES ====================

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
// ACTUALIZAR CLASE - NUEVO
// =============================================
const updateClass = async (req, res) => {
    try {
        const { id } = req.params
        const { titulo, descripcion, videoYoutubeUrl, duracionMinutos, esGratuita, orden } = req.body

        // Verificar permisos
        const classCheck = await pool.query(
            `SELECT c.id as curso_id FROM clases cl
             JOIN modulos m ON cl.modulo_id = m.id
             JOIN cursos c ON m.curso_id = c.id 
             WHERE cl.id = $1`,
            [id]
        )

        if (classCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Clase no encontrada'
            })
        }

        const cursoId = classCheck.rows[0].curso_id
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar esta clase'
            })
        }

        const result = await pool.query(
            `UPDATE clases 
             SET titulo = $1, descripcion = $2, video_youtube_url = $3, 
                 duracion_minutos = $4, es_gratuita = $5, orden = $6 
             WHERE id = $7 RETURNING *`,
            [titulo, descripcion, videoYoutubeUrl, duracionMinutos, esGratuita, orden, id]
        )

        res.json({
            success: true,
            message: 'Clase actualizada exitosamente',
            data: { clase: result.rows[0] }
        })

    } catch (error) {
        console.error('Error actualizando clase:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ELIMINAR CLASE - NUEVO
// =============================================
const deleteClass = async (req, res) => {
    try {
        const { id } = req.params

        // Verificar permisos
        const classCheck = await pool.query(
            `SELECT c.id as curso_id FROM clases cl
             JOIN modulos m ON cl.modulo_id = m.id
             JOIN cursos c ON m.curso_id = c.id 
             WHERE cl.id = $1`,
            [id]
        )

        if (classCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Clase no encontrada'
            })
        }

        const cursoId = classCheck.rows[0].curso_id
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para eliminar esta clase'
            })
        }

        await pool.query('DELETE FROM clases WHERE id = $1', [id])

        res.json({
            success: true,
            message: 'Clase eliminada exitosamente'
        })

    } catch (error) {
        console.error('Error eliminando clase:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// REORDENAR CLASES - NUEVO
// =============================================
const reorderClasses = async (req, res) => {
    try {
        const { moduloId, classOrders } = req.body

        if (!moduloId || !Array.isArray(classOrders)) {
            return res.status(400).json({
                success: false,
                message: 'moduloId y classOrders son requeridos'
            })
        }

        // Verificar permisos del módulo
        const moduleCheck = await pool.query(
            `SELECT c.id as curso_id FROM modulos m 
             JOIN cursos c ON m.curso_id = c.id 
             WHERE m.id = $1`,
            [moduloId]
        )

        if (moduleCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Módulo no encontrado'
            })
        }

        const cursoId = moduleCheck.rows[0].curso_id
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar este módulo'
            })
        }

        // Actualizar orden de cada clase
        for (const classOrder of classOrders) {
            await pool.query(
                'UPDATE clases SET orden = $1 WHERE id = $2 AND modulo_id = $3',
                [classOrder.orden, classOrder.id, moduloId]
            )
        }

        res.json({
            success: true,
            message: 'Clases reordenadas exitosamente'
        })

    } catch (error) {
        console.error('Error reordenando clases:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// ==================== GESTIÓN DE SIMULACROS ====================

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
// ACTUALIZAR SIMULACRO - NUEVO
// =============================================
const updateSimulacro = async (req, res) => {
    try {
        const { id } = req.params
        const {
            titulo, descripcion, modoEvaluacion, tiempoLimiteMinutos,
            tiempoPorPreguntaSegundos, numeroPreguntas, intentosPermitidos,
            randomizarPreguntas, randomizarOpciones, mostrarRespuestasDespues
        } = req.body

        // Verificar permisos
        const simulacroCheck = await pool.query(
            `SELECT curso_id FROM simulacros WHERE id = $1`,
            [id]
        )

        if (simulacroCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Simulacro no encontrado'
            })
        }

        const cursoId = simulacroCheck.rows[0].curso_id
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar este simulacro'
            })
        }

        const result = await pool.query(
            `UPDATE simulacros 
             SET titulo = $1, descripcion = $2, modo_evaluacion = $3, 
                 tiempo_limite_minutos = $4, tiempo_por_pregunta_segundos = $5,
                 numero_preguntas = $6, intentos_permitidos = $7,
                 randomizar_preguntas = $8, randomizar_opciones = $9,
                 mostrar_respuestas_despues = $10
             WHERE id = $11 RETURNING *`,
            [titulo, descripcion, modoEvaluacion, tiempoLimiteMinutos,
                tiempoPorPreguntaSegundos, numeroPreguntas, intentosPermitidos,
                randomizarPreguntas, randomizarOpciones, mostrarRespuestasDespues, id]
        )

        res.json({
            success: true,
            message: 'Simulacro actualizado exitosamente',
            data: { simulacro: result.rows[0] }
        })

    } catch (error) {
        console.error('Error actualizando simulacro:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ELIMINAR SIMULACRO - NUEVO
// =============================================
const deleteSimulacro = async (req, res) => {
    try {
        const { id } = req.params

        // Verificar permisos
        const simulacroCheck = await pool.query(
            `SELECT curso_id FROM simulacros WHERE id = $1`,
            [id]
        )

        if (simulacroCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Simulacro no encontrado'
            })
        }

        const cursoId = simulacroCheck.rows[0].curso_id
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para eliminar este simulacro'
            })
        }

        // Eliminar simulacro (cascada eliminará preguntas automáticamente)
        await pool.query('DELETE FROM simulacros WHERE id = $1', [id])

        res.json({
            success: true,
            message: 'Simulacro eliminado exitosamente'
        })

    } catch (error) {
        console.error('Error eliminando simulacro:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// OBTENER SIMULACRO CON PREGUNTAS - NUEVO
// =============================================
const getSimulacroWithQuestions = async (req, res) => {
    try {
        const { id } = req.params

        // Verificar permisos
        const simulacroCheck = await pool.query(
            `SELECT curso_id FROM simulacros WHERE id = $1`,
            [id]
        )

        if (simulacroCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Simulacro no encontrado'
            })
        }

        const cursoId = simulacroCheck.rows[0].curso_id
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver este simulacro'
            })
        }

        // Obtener simulacro
        const simulacroResult = await pool.query(
            'SELECT * FROM simulacros WHERE id = $1',
            [id]
        )

        // Obtener preguntas con opciones
        const preguntasResult = await pool.query(
            `SELECT p.*,
             COALESCE(
                 json_agg(
                     json_build_object(
                         'id', o.id,
                         'texto_opcion', o.texto_opcion,
                         'es_correcta', o.es_correcta,
                         'orden', o.orden
                     ) ORDER BY o.orden
                 ) FILTER (WHERE o.id IS NOT NULL), '[]'::json
             ) as opciones
             FROM preguntas p
             LEFT JOIN opciones_respuesta o ON p.id = o.pregunta_id
             WHERE p.simulacro_id = $1
             GROUP BY p.id
             ORDER BY p.fecha_creacion`,
            [id]
        )

        res.json({
            success: true,
            data: {
                simulacro: simulacroResult.rows[0],
                preguntas: preguntasResult.rows
            }
        })

    } catch (error) {
        console.error('Error obteniendo simulacro con preguntas:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// ==================== GESTIÓN DE PREGUNTAS ====================

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
// ACTUALIZAR PREGUNTA - NUEVO
// =============================================
const updateQuestion = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const { id } = req.params
        const { enunciado, tipoPregunta, explicacion, imagenUrl, opciones } = req.body

        // Verificar permisos
        const questionCheck = await client.query(
            `SELECT c.id as curso_id FROM preguntas p
             JOIN simulacros s ON p.simulacro_id = s.id
             JOIN cursos c ON s.curso_id = c.id
             WHERE p.id = $1`,
            [id]
        )

        if (questionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pregunta no encontrada'
            })
        }

        const cursoId = questionCheck.rows[0].curso_id
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar esta pregunta'
            })
        }

        // Actualizar pregunta
        const preguntaResult = await client.query(
            'UPDATE preguntas SET enunciado = $1, tipo_pregunta = $2, explicacion = $3, imagen_url = $4 WHERE id = $5 RETURNING *',
            [enunciado, tipoPregunta, explicacion, imagenUrl, id]
        )

        // Si se proporcionaron opciones, actualizar
        if (opciones && Array.isArray(opciones)) {
            // Eliminar opciones existentes
            await client.query('DELETE FROM opciones_respuesta WHERE pregunta_id = $1', [id])

            // Crear nuevas opciones
            const opcionesCreadas = []
            for (let i = 0; i < opciones.length; i++) {
                const { textoOpcion, esCorrecta } = opciones[i]

                const opcionResult = await client.query(
                    'INSERT INTO opciones_respuesta (pregunta_id, texto_opcion, es_correcta, orden) VALUES ($1, $2, $3, $4) RETURNING *',
                    [id, textoOpcion.trim(), esCorrecta === true, i + 1]
                )
                opcionesCreadas.push(opcionResult.rows[0])
            }

            await client.query('COMMIT')

            res.json({
                success: true,
                message: 'Pregunta actualizada exitosamente',
                data: {
                    pregunta: preguntaResult.rows[0],
                    opciones: opcionesCreadas
                }
            })
        } else {
            await client.query('COMMIT')

            res.json({
                success: true,
                message: 'Pregunta actualizada exitosamente',
                data: { pregunta: preguntaResult.rows[0] }
            })
        }

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Error actualizando pregunta:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    } finally {
        client.release()
    }
}

// =============================================
// ELIMINAR PREGUNTA - NUEVO
// =============================================
const deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params

        // Verificar permisos
        const questionCheck = await pool.query(
            `SELECT c.id as curso_id FROM preguntas p
             JOIN simulacros s ON p.simulacro_id = s.id
             JOIN cursos c ON s.curso_id = c.id
             WHERE p.id = $1`,
            [id]
        )

        if (questionCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pregunta no encontrada'
            })
        }

        const cursoId = questionCheck.rows[0].curso_id
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para eliminar esta pregunta'
            })
        }

        // Eliminar pregunta (cascada eliminará opciones automáticamente)
        await pool.query('DELETE FROM preguntas WHERE id = $1', [id])

        res.json({
            success: true,
            message: 'Pregunta eliminada exitosamente'
        })

    } catch (error) {
        console.error('Error eliminando pregunta:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CREAR MÚLTIPLES PREGUNTAS - NUEVO
// =============================================
const createMultipleQuestions = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const { simulacroId, questions } = req.body

        if (!simulacroId || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'simulacroId y questions son requeridos'
            })
        }

        // Verificar permisos
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

        const preguntasCreadas = []

        for (const questionData of questions) {
            const { enunciado, tipoPregunta, explicacion, imagenUrl, opciones } = questionData

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

                const opcionResult = await client.query(
                    'INSERT INTO opciones_respuesta (pregunta_id, texto_opcion, es_correcta, orden) VALUES ($1, $2, $3, $4) RETURNING *',
                    [preguntaId, textoOpcion.trim(), esCorrecta === true, i + 1]
                )
                opcionesCreadas.push(opcionResult.rows[0])
            }

            preguntasCreadas.push({
                pregunta: preguntaResult.rows[0],
                opciones: opcionesCreadas
            })
        }

        await client.query('COMMIT')

        res.status(201).json({
            success: true,
            message: `${preguntasCreadas.length} preguntas creadas exitosamente`,
            data: { preguntas: preguntasCreadas }
        })

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Error creando múltiples preguntas:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    } finally {
        client.release()
    }
}

// ==================== UTILIDADES AVANZADAS ====================

// =============================================
// VALIDAR URL DE YOUTUBE - NUEVO
// =============================================
const validateYouTubeUrl = async (req, res) => {
    try {
        const { url } = req.body

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL es requerida'
            })
        }

        const patterns = [
            /^https?:\/\/(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
            /^https?:\/\/(www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
            /^https?:\/\/(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/
        ]

        const isValid = patterns.some(pattern => pattern.test(url))

        if (isValid) {
            // Extraer ID del video
            let videoId = null
            for (const pattern of patterns) {
                const match = url.match(pattern)
                if (match) {
                    videoId = match[2]
                    break
                }
            }

            res.json({
                success: true,
                data: {
                    isValid: true,
                    videoId,
                    embedUrl: `https://www.youtube.com/embed/${videoId}`
                }
            })
        } else {
            res.status(400).json({
                success: false,
                message: 'URL de YouTube inválida'
            })
        }

    } catch (error) {
        console.error('Error validando URL de YouTube:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// DUPLICAR CURSO - NUEVO
// =============================================
const duplicateCourse = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const { cursoId } = req.params
        const { titulo } = req.body

        if (!titulo) {
            return res.status(400).json({
                success: false,
                message: 'Título es requerido'
            })
        }

        // Verificar permisos del curso original
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para duplicar este curso'
            })
        }

        // Obtener curso original
        const cursoOriginal = await client.query(
            'SELECT * FROM cursos WHERE id = $1',
            [cursoId]
        )

        if (cursoOriginal.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        const curso = cursoOriginal.rows[0]

        // Generar slug único
        const slug = titulo
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .replace(/(^-|-$)/g, '') + '-copia'

        // Crear curso duplicado
        const nuevoCurso = await client.query(
            `INSERT INTO cursos (titulo, descripcion, slug, miniatura_url, precio, descuento, tipo_examen, es_gratuito, instructor_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [titulo, curso.descripcion, slug, curso.miniatura_url, curso.precio, curso.descuento,
                curso.tipo_examen, curso.es_gratuito, req.user.id]
        )

        const nuevoCursoId = nuevoCurso.rows[0].id

        // Duplicar módulos
        const modulos = await client.query(
            'SELECT * FROM modulos WHERE curso_id = $1 ORDER BY orden',
            [cursoId]
        )

        for (const modulo of modulos.rows) {
            const nuevoModulo = await client.query(
                'INSERT INTO modulos (curso_id, titulo, descripcion, orden) VALUES ($1, $2, $3, $4) RETURNING *',
                [nuevoCursoId, modulo.titulo, modulo.descripcion, modulo.orden]
            )

            const nuevoModuloId = nuevoModulo.rows[0].id

            // Duplicar clases del módulo
            const clases = await client.query(
                'SELECT * FROM clases WHERE modulo_id = $1 ORDER BY orden',
                [modulo.id]
            )

            for (const clase of clases.rows) {
                await client.query(
                    `INSERT INTO clases (modulo_id, titulo, descripcion, video_youtube_url, duracion_minutos, es_gratuita, orden)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [nuevoModuloId, clase.titulo, clase.descripcion, clase.video_youtube_url,
                        clase.duracion_minutos, clase.es_gratuita, clase.orden]
                )
            }
        }

        // Duplicar simulacros
        const simulacros = await client.query(
            'SELECT * FROM simulacros WHERE curso_id = $1',
            [cursoId]
        )

        for (const simulacro of simulacros.rows) {
            const nuevoSimulacro = await client.query(
                `INSERT INTO simulacros (curso_id, titulo, descripcion, modo_evaluacion, tiempo_limite_minutos,
                 tiempo_por_pregunta_segundos, numero_preguntas, intentos_permitidos, randomizar_preguntas,
                 randomizar_opciones, mostrar_respuestas_despues)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                [nuevoCursoId, simulacro.titulo, simulacro.descripcion, simulacro.modo_evaluacion,
                    simulacro.tiempo_limite_minutos, simulacro.tiempo_por_pregunta_segundos, simulacro.numero_preguntas,
                    simulacro.intentos_permitidos, simulacro.randomizar_preguntas, simulacro.randomizar_opciones,
                    simulacro.mostrar_respuestas_despues]
            )

            const nuevoSimulacroId = nuevoSimulacro.rows[0].id

            // Duplicar preguntas del simulacro
            const preguntas = await client.query(
                'SELECT * FROM preguntas WHERE simulacro_id = $1',
                [simulacro.id]
            )

            for (const pregunta of preguntas.rows) {
                const nuevaPregunta = await client.query(
                    'INSERT INTO preguntas (simulacro_id, enunciado, tipo_pregunta, explicacion, imagen_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                    [nuevoSimulacroId, pregunta.enunciado, pregunta.tipo_pregunta, pregunta.explicacion, pregunta.imagen_url]
                )

                const nuevaPreguntaId = nuevaPregunta.rows[0].id

                // Duplicar opciones de la pregunta
                const opciones = await client.query(
                    'SELECT * FROM opciones_respuesta WHERE pregunta_id = $1 ORDER BY orden',
                    [pregunta.id]
                )

                for (const opcion of opciones.rows) {
                    await client.query(
                        'INSERT INTO opciones_respuesta (pregunta_id, texto_opcion, es_correcta, orden) VALUES ($1, $2, $3, $4)',
                        [nuevaPreguntaId, opcion.texto_opcion, opcion.es_correcta, opcion.orden]
                    )
                }
            }
        }

        await client.query('COMMIT')

        res.status(201).json({
            success: true,
            message: 'Curso duplicado exitosamente',
            data: { curso: nuevoCurso.rows[0] }
        })

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Error duplicando curso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    } finally {
        client.release()
    }
}

// =============================================
// EXPORTAR TODAS LAS FUNCIONES
// =============================================
module.exports = {
    // Gestión de cursos
    getCourseContent,

    // Gestión de módulos
    createModule,
    updateModule,        // NUEVO
    deleteModule,        // NUEVO
    reorderModules,      // NUEVO

    // Gestión de clases
    createClass,
    updateClass,         // NUEVO
    deleteClass,         // NUEVO
    reorderClasses,      // NUEVO

    // Gestión de simulacros
    createSimulacro,
    updateSimulacro,     // NUEVO
    deleteSimulacro,     // NUEVO
    getSimulacroWithQuestions, // NUEVO

    // Gestión de preguntas
    createQuestion,
    updateQuestion,      // NUEVO
    deleteQuestion,      // NUEVO
    createMultipleQuestions, // NUEVO

    // Utilidades
    validateYouTubeUrl,  // NUEVO
    duplicateCourse      // NUEVO
}