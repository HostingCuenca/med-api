// controllers/simulacroController.js
const pool = require('../config/database')

// =============================================
// OBTENER SIMULACROS POR CURSO
// =============================================
const getSimulacrosByCourse = async (req, res) => {
    try {
        const { cursoId } = req.params
        const userId = req.user?.id

        // Verificar que el curso existe
        const cursoCheck = await pool.query(
            'SELECT titulo, es_gratuito FROM cursos WHERE id = $1 AND activo = true',
            [cursoId]
        )

        if (cursoCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        const result = await pool.query(
            `SELECT s.*,
        (SELECT COUNT(*) FROM preguntas p WHERE p.simulacro_id = s.id) as total_preguntas_disponibles,
        CASE 
          WHEN $1 IS NOT NULL THEN 
            (SELECT COUNT(*) FROM intentos_simulacro i WHERE i.simulacro_id = s.id AND i.usuario_id = $1)
          ELSE 0 
        END as mis_intentos,
        CASE 
          WHEN $1 IS NOT NULL THEN 
            (SELECT MAX(puntaje) FROM intentos_simulacro i WHERE i.simulacro_id = s.id AND i.usuario_id = $1)
          ELSE NULL 
        END as mejor_puntaje
       FROM simulacros s 
       WHERE s.curso_id = $2 AND s.activo = true 
       ORDER BY s.fecha_creacion`,
            [userId, cursoId]
        )

        res.json({
            success: true,
            data: {
                simulacros: result.rows,
                curso: cursoCheck.rows[0]
            }
        })

    } catch (error) {
        console.error('Error obteniendo simulacros:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// OBTENER PREGUNTAS DEL SIMULACRO
// =============================================
const getSimulacroQuestions = async (req, res) => {
    try {
        const { simulacroId } = req.params
        const userId = req.user.id

        // Verificar acceso al simulacro
        const accessCheck = await pool.query(
            `SELECT s.*, c.es_gratuito, c.titulo as curso_titulo,
        CASE 
          WHEN c.es_gratuito = true THEN 'habilitado'
          ELSE COALESCE(i.estado_pago, 'no_inscrito')
        END as estado_acceso
       FROM simulacros s
       JOIN cursos c ON s.curso_id = c.id
       LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
       WHERE s.id = $2 AND s.activo = true`,
            [userId, simulacroId]
        )

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Simulacro no encontrado'
            })
        }

        const simulacro = accessCheck.rows[0]

        // Verificar si tiene acceso
        if (simulacro.estado_acceso !== 'habilitado') {
            return res.status(403).json({
                success: false,
                message: simulacro.estado_acceso === 'no_inscrito'
                    ? 'Debes inscribirte en el curso para acceder a este simulacro'
                    : 'Tu inscripción está pendiente de aprobación. Contacta al administrador.',
                estadoAcceso: simulacro.estado_acceso
            })
        }

        // Verificar intentos permitidos
        if (simulacro.intentos_permitidos > 0) {
            const intentosResult = await pool.query(
                'SELECT COUNT(*) as intentos FROM intentos_simulacro WHERE usuario_id = $1 AND simulacro_id = $2',
                [userId, simulacroId]
            )

            const intentosRealizados = parseInt(intentosResult.rows[0].intentos)

            if (intentosRealizados >= simulacro.intentos_permitidos) {
                return res.status(403).json({
                    success: false,
                    message: `Has agotado tus ${simulacro.intentos_permitidos} intentos permitidos`,
                    intentosRealizados,
                    intentosPermitidos: simulacro.intentos_permitidos
                })
            }
        }

        // Obtener preguntas con randomización
        const orderClause = simulacro.randomizar_preguntas ? 'ORDER BY RANDOM()' : 'ORDER BY p.fecha_creacion'
        const limitClause = simulacro.numero_preguntas > 0 ? `LIMIT ${simulacro.numero_preguntas}` : ''

        const preguntasResult = await pool.query(
            `SELECT p.id, p.enunciado, p.tipo_pregunta, p.imagen_url,
       json_agg(
         json_build_object(
           'id', o.id,
           'texto_opcion', o.texto_opcion,
           'orden', o.orden
         ) ORDER BY ${simulacro.randomizar_opciones ? 'RANDOM()' : 'o.orden'}
       ) as opciones
       FROM preguntas p
       JOIN opciones_respuesta o ON p.id = o.pregunta_id
       WHERE p.simulacro_id = $1
       GROUP BY p.id, p.enunciado, p.tipo_pregunta, p.imagen_url, p.fecha_creacion
       ${orderClause} ${limitClause}`,
            [simulacroId]
        )

        if (preguntasResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Este simulacro no tiene preguntas configuradas'
            })
        }

        res.json({
            success: true,
            data: {
                simulacro: {
                    id: simulacro.id,
                    titulo: simulacro.titulo,
                    descripcion: simulacro.descripcion,
                    modo_evaluacion: simulacro.modo_evaluacion,
                    tiempo_limite_minutos: simulacro.tiempo_limite_minutos,
                    tiempo_por_pregunta_segundos: simulacro.tiempo_por_pregunta_segundos,
                    curso_titulo: simulacro.curso_titulo
                },
                preguntas: preguntasResult.rows,
                configuracion: {
                    intentosPermitidos: simulacro.intentos_permitidos,
                    mostrarRespuestasDespues: simulacro.mostrar_respuestas_despues
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo preguntas:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ENVIAR RESPUESTAS Y CALIFICAR
// =============================================
const submitSimulacro = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const { simulacroId } = req.params
        const { respuestas, tiempoEmpleadoMinutos } = req.body
        const userId = req.user.id

        if (!respuestas || !Array.isArray(respuestas) || respuestas.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Respuestas son requeridas'
            })
        }

        // Verificar que el simulacro existe y tiene acceso
        const simulacroCheck = await client.query(
            `SELECT s.*, c.es_gratuito, i.estado_pago
      FROM simulacros s
      JOIN cursos c ON s.curso_id = c.id
      LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
      WHERE s.id = $2 AND s.activo = true`,
            [userId, simulacroId]
        )

        if (simulacroCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Simulacro no encontrado'
            })
        }

        const simulacro = simulacroCheck.rows[0]

        // Verificar acceso
        if (!simulacro.es_gratuito && simulacro.estado_pago !== 'habilitado') {
            return res.status(403).json({
                success: false,
                message: 'No tienes acceso a este simulacro'
            })
        }

        // Crear intento
        const intentoResult = await client.query(
            `INSERT INTO intentos_simulacro (usuario_id, simulacro_id, tiempo_empleado_minutos, total_preguntas) 
      VALUES ($1, $2, $3, $4) 
      RETURNING id`,
            [userId, simulacroId, tiempoEmpleadoMinutos || null, respuestas.length]
        )

        const intentoId = intentoResult.rows[0].id
        let respuestasCorrectas = 0
        const detalleRespuestas = []

        // Procesar cada respuesta
        for (const respuesta of respuestas) {
            const { preguntaId, opcionSeleccionadaId } = respuesta

            if (!preguntaId || !opcionSeleccionadaId) {
                await client.query('ROLLBACK')
                return res.status(400).json({
                    success: false,
                    message: 'Datos de respuesta incompletos'
                })
            }

            // Verificar si la respuesta es correcta y obtener detalles
            const opcionResult = await client.query(
                `SELECT o.es_correcta, o.texto_opcion, p.enunciado, p.explicacion
        FROM opciones_respuesta o
        JOIN preguntas p ON o.pregunta_id = p.id
        WHERE o.id = $1 AND p.id = $2`,
                [opcionSeleccionadaId, preguntaId]
            )

            if (opcionResult.rows.length === 0) {
                await client.query('ROLLBACK')
                return res.status(400).json({
                    success: false,
                    message: 'Respuesta inválida'
                })
            }

            const opcion = opcionResult.rows[0]
            const esCorrecta = opcion.es_correcta

            if (esCorrecta) respuestasCorrectas++

            // Guardar respuesta del usuario
            await client.query(
                `INSERT INTO respuestas_usuario (intento_simulacro_id, pregunta_id, opcion_seleccionada_id, es_correcta) 
        VALUES ($1, $2, $3, $4)`,
                [intentoId, preguntaId, opcionSeleccionadaId, esCorrecta]
            )

            // Agregar al detalle (para mostrar después según configuración)
            detalleRespuestas.push({
                preguntaId,
                enunciado: opcion.enunciado,
                respuestaSeleccionada: opcion.texto_opcion,
                esCorrecta,
                explicacion: opcion.explicacion
            })
        }

        // Calcular puntaje
        const puntaje = (respuestasCorrectas / respuestas.length) * 100

        // Actualizar intento con resultados
        await client.query(
            `UPDATE intentos_simulacro 
      SET puntaje = $1, respuestas_correctas = $2 
      WHERE id = $3`,
            [puntaje, respuestasCorrectas, intentoId]
        )

        await client.query('COMMIT')

        // Determinar qué mostrar según el modo de evaluación
        const mostrarDetalle = simulacro.modo_evaluacion === 'practica'
        const mostrarRespuestasCorrectas = simulacro.modo_evaluacion !== 'examen'

        res.json({
            success: true,
            message: 'Simulacro completado exitosamente',
            data: {
                intentoId,
                puntaje: parseFloat(puntaje.toFixed(2)),
                respuestasCorrectas,
                totalPreguntas: respuestas.length,
                tiempoEmpleado: tiempoEmpleadoMinutos,
                modoEvaluacion: simulacro.modo_evaluacion,
                ...(mostrarDetalle && { detalle: detalleRespuestas }),
                ...(mostrarRespuestasCorrectas && !mostrarDetalle && {
                    resumen: `${respuestasCorrectas}/${respuestas.length} correctas`
                })
            }
        })

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Error enviando simulacro:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    } finally {
        client.release()
    }
}

// =============================================
// MIS INTENTOS DE SIMULACRO
// =============================================
const getMyAttempts = async (req, res) => {
    try {
        const userId = req.user.id
        const { simulacroId, cursoId } = req.query

        let query = `
     SELECT ia.*, s.titulo as simulacro_titulo, s.modo_evaluacion,
       c.titulo as curso_titulo, c.id as curso_id
     FROM intentos_simulacro ia
     JOIN simulacros s ON ia.simulacro_id = s.id
     JOIN cursos c ON s.curso_id = c.id
     WHERE ia.usuario_id = $1
   `
        const params = [userId]
        let paramCount = 1

        if (simulacroId) {
            paramCount++
            query += ` AND ia.simulacro_id = $${paramCount}`
            params.push(simulacroId)
        }

        if (cursoId) {
            paramCount++
            query += ` AND c.id = $${paramCount}`
            params.push(cursoId)
        }

        query += ' ORDER BY ia.fecha_intento DESC'

        const result = await pool.query(query, params)

        res.json({
            success: true,
            data: { intentos: result.rows }
        })

    } catch (error) {
        console.error('Error obteniendo intentos:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// VER DETALLE DE INTENTO ESPECÍFICO
// =============================================
const getAttemptDetail = async (req, res) => {
    try {
        const { intentoId } = req.params
        const userId = req.user.id

        // Obtener intento con información del simulacro
        const intentoResult = await pool.query(
            `SELECT ia.*, s.titulo as simulacro_titulo, s.modo_evaluacion, s.mostrar_respuestas_despues,
       c.titulo as curso_titulo
      FROM intentos_simulacro ia
      JOIN simulacros s ON ia.simulacro_id = s.id
      JOIN cursos c ON s.curso_id = c.id
      WHERE ia.id = $1 AND ia.usuario_id = $2`,
            [intentoId, userId]
        )

        if (intentoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Intento no encontrado'
            })
        }

        const intento = intentoResult.rows[0]

        // Verificar si puede ver el detalle según la configuración
        const puedeVerDetalle = intento.modo_evaluacion === 'practica'

        let detalle = null
        if (puedeVerDetalle) {
            // Obtener respuestas detalladas
            const detalleResult = await pool.query(
                `SELECT ru.*, p.enunciado, p.explicacion, p.imagen_url,
         o.texto_opcion as respuesta_seleccionada,
         oc.texto_opcion as respuesta_correcta
        FROM respuestas_usuario ru
        JOIN preguntas p ON ru.pregunta_id = p.id
        JOIN opciones_respuesta o ON ru.opcion_seleccionada_id = o.id
        JOIN opciones_respuesta oc ON p.id = oc.pregunta_id AND oc.es_correcta = true
        WHERE ru.intento_simulacro_id = $1
        ORDER BY ru.fecha_respuesta`,
                [intentoId]
            )

            detalle = detalleResult.rows
        }

        res.json({
            success: true,
            data: {
                intento,
                ...(puedeVerDetalle && { detalle }),
                ...(intento.modo_evaluacion === 'examen' && {
                    mensaje: 'Detalle no disponible para exámenes'
                })
            }
        })

    } catch (error) {
        console.error('Error obteniendo detalle del intento:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

module.exports = {
    getSimulacrosByCourse,
    getSimulacroQuestions,
    submitSimulacro,
    getMyAttempts,
    getAttemptDetail
}