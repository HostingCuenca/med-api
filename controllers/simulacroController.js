// controllers/simulacroController.js
const pool = require('../config/database')

// =============================================
// OBTENER SIMULACROS POR CURSO
// =============================================
const getSimulacrosByCourse = async (req, res) => {
    try {
        const { cursoId } = req.params
        const userId = req.user?.id || null // ✅ CORREGIDO: Asegurar que no sea undefined

        console.log('Debug - userId:', userId, 'cursoId:', cursoId) // Para debugging

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

        // ✅ CORREGIDO: Query simplificada para evitar problemas de tipo
        const result = await pool.query(
            `SELECT s.*,
                (SELECT COUNT(*) FROM preguntas p WHERE p.simulacro_id = s.id) as total_preguntas_disponibles,
                COALESCE(
                    (SELECT COUNT(*) FROM intentos_simulacro i WHERE i.simulacro_id = s.id AND i.usuario_id = $1),
                    0
                ) as mis_intentos,
                (SELECT MAX(puntaje) FROM intentos_simulacro i WHERE i.simulacro_id = s.id AND i.usuario_id = $1) as mejor_puntaje
            FROM simulacros s 
            WHERE s.curso_id = $2 AND s.activo = true 
            ORDER BY s.fecha_creacion`,
            [userId, cursoId]
        )

        // ✅ MEJORADO: Formatear respuesta con valores por defecto
        const simulacros = result.rows.map(row => ({
            ...row,
            mis_intentos: parseInt(row.mis_intentos) || 0,
            mejor_puntaje: row.mejor_puntaje ? parseFloat(row.mejor_puntaje) : null,
            total_preguntas_disponibles: parseInt(row.total_preguntas_disponibles) || 0
        }))

        res.json({
            success: true,
            data: {
                simulacros,
                curso: cursoCheck.rows[0],
                estadisticas: {
                    total_simulacros: simulacros.length,
                    completados: simulacros.filter(s => s.mis_intentos > 0).length,
                    promedio_puntaje: simulacros.length > 0
                        ? simulacros.reduce((acc, s) => acc + (s.mejor_puntaje || 0), 0) / simulacros.length
                        : 0
                }
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
        const userId = req.user?.id

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        // ✅ MEJORADO: Query más robusta para verificar acceso
        const accessCheck = await pool.query(
            `SELECT s.*, c.es_gratuito, c.titulo as curso_titulo,
                    CASE
                        WHEN c.es_gratuito = true THEN 'habilitado'
                        WHEN i.estado_pago IS NULL THEN 'no_inscrito'
                        ELSE i.estado_pago
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

        // ✅ MEJORADO: Query más eficiente para obtener preguntas
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
                    numero_preguntas: simulacro.numero_preguntas,
                    intentos_permitidos: simulacro.intentos_permitidos,
                    randomizar_preguntas: simulacro.randomizar_preguntas,
                    randomizar_opciones: simulacro.randomizar_opciones,
                    mostrar_respuestas_despues: simulacro.mostrar_respuestas_despues,
                    curso_titulo: simulacro.curso_titulo
                },
                preguntas: preguntasResult.rows,
                configuracion: {
                    intentosPermitidos: simulacro.intentos_permitidos,
                    mostrarRespuestasDespues: simulacro.mostrar_respuestas_despues,
                    tiempoPorPregunta: simulacro.tiempo_por_pregunta_segundos
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
        const userId = req.user?.id

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        if (!respuestas || !Array.isArray(respuestas) || respuestas.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Respuestas son requeridas'
            })
        }

        // Verificar que el simulacro existe y tiene acceso
        const simulacroCheck = await client.query(
            `SELECT s.*, c.es_gratuito, c.titulo as curso_titulo,
                    COALESCE(i.estado_pago, 'no_inscrito') as estado_pago
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

        // ✅ MEJORADO: Crear intento con timestamp
        const intentoResult = await client.query(
            `INSERT INTO intentos_simulacro (usuario_id, simulacro_id, tiempo_empleado_minutos, total_preguntas, fecha_intento)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                 RETURNING id`,
            [userId, simulacroId, tiempoEmpleadoMinutos || 0, respuestas.length]
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

            // ✅ MEJORADO: Query más robusta para verificar respuesta
            const opcionResult = await client.query(
                `SELECT o.es_correcta, o.texto_opcion, p.enunciado, p.explicacion,
                        oc.texto_opcion as respuesta_correcta
                 FROM opciones_respuesta o
                          JOIN preguntas p ON o.pregunta_id = p.id
                          LEFT JOIN opciones_respuesta oc ON p.id = oc.pregunta_id AND oc.es_correcta = true
                 WHERE o.id = $1 AND p.id = $2 AND p.simulacro_id = $3`,
                [opcionSeleccionadaId, preguntaId, simulacroId]
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
                `INSERT INTO respuestas_usuario (intento_simulacro_id, pregunta_id, opcion_seleccionada_id, es_correcta, fecha_respuesta)
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
                [intentoId, preguntaId, opcionSeleccionadaId, esCorrecta]
            )

            // Agregar al detalle
            detalleRespuestas.push({
                preguntaId,
                enunciado: opcion.enunciado,
                respuestaSeleccionada: opcion.texto_opcion,
                respuestaCorrecta: opcion.respuesta_correcta,
                esCorrecta,
                explicacion: opcion.explicacion
            })
        }

        // Calcular puntaje
        const puntaje = Math.round((respuestasCorrectas / respuestas.length) * 100)

        // Actualizar intento con resultados
        await client.query(
            `UPDATE intentos_simulacro
             SET puntaje = $1, respuestas_correctas = $2, completado = true
             WHERE id = $3`,
            [puntaje, respuestasCorrectas, intentoId]
        )

        await client.query('COMMIT')

        // ✅ MEJORADO: Determinar qué mostrar según el modo
        const response = {
            intentoId,
            puntaje,
            respuestasCorrectas,
            totalPreguntas: respuestas.length,
            tiempoEmpleado: tiempoEmpleadoMinutos,
            modoEvaluacion: simulacro.modo_evaluacion,
            estadisticas: {
                porcentajeAprobacion: puntaje >= 70 ? 'Aprobado' : 'Reprobado',
                calificacion: puntaje >= 90 ? 'Excelente' : puntaje >= 80 ? 'Muy Bueno' : puntaje >= 70 ? 'Bueno' : puntaje >= 60 ? 'Regular' : 'Necesita Mejorar'
            }
        }

        // Agregar detalle según el modo
        if (simulacro.modo_evaluacion === 'practica') {
            response.detalle = detalleRespuestas
        } else if (simulacro.modo_evaluacion === 'realista') {
            response.resumen = `${respuestasCorrectas}/${respuestas.length} correctas`
        }

        res.json({
            success: true,
            message: 'Simulacro completado exitosamente',
            data: response
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

const getMyAttempts = async (req, res) => {
    try {
        const userId = req.user?.id

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            })
        }

        const { simulacroId, cursoId, page = 1, limit = 20 } = req.query

        // ✅ CORREGIDO: Usar puntaje IS NOT NULL en lugar de completado = true
        let query = `
            SELECT ia.*, s.titulo as simulacro_titulo, s.modo_evaluacion,
                   c.titulo as curso_titulo, c.id as curso_id
            FROM intentos_simulacro ia
                     JOIN simulacros s ON ia.simulacro_id = s.id
                     JOIN cursos c ON s.curso_id = c.id
            WHERE ia.usuario_id = $1 AND ia.puntaje IS NOT NULL
        `
        const params = [userId]
        let paramCount = 1

        // Agregar filtros opcionales
        if (simulacroId && simulacroId.trim() !== '') {
            paramCount++
            query += ` AND ia.simulacro_id = $${paramCount}`
            params.push(simulacroId)
        }

        if (cursoId && cursoId.trim() !== '') {
            paramCount++
            query += ` AND c.id = $${paramCount}`
            params.push(cursoId)
        }

        query += ' ORDER BY ia.fecha_intento DESC'

        // Paginación
        const pageNum = Math.max(1, parseInt(page) || 1)
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
        const offset = (pageNum - 1) * limitNum

        query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
        params.push(limitNum, offset)

        console.log('Query ejecutándose:', query)
        console.log('Params:', params)

        const result = await pool.query(query, params)

        // ✅ CORREGIDO: Query de estadísticas también sin completado
        let statsQuery = `
            SELECT 
                COUNT(*) as total_intentos,
                COALESCE(AVG(puntaje), 0) as promedio_puntaje,
                COALESCE(MAX(puntaje), 0) as mejor_puntaje,
                COALESCE(MIN(puntaje), 0) as peor_puntaje,
                COALESCE(AVG(tiempo_empleado_minutos), 0) as tiempo_promedio
            FROM intentos_simulacro ia
            JOIN simulacros s ON ia.simulacro_id = s.id
            JOIN cursos c ON s.curso_id = c.id
            WHERE ia.usuario_id = $1 AND ia.puntaje IS NOT NULL
        `
        const statsParams = [userId]
        let statsParamCount = 1

        if (simulacroId && simulacroId.trim() !== '') {
            statsParamCount++
            statsQuery += ` AND ia.simulacro_id = $${statsParamCount}`
            statsParams.push(simulacroId)
        }

        if (cursoId && cursoId.trim() !== '') {
            statsParamCount++
            statsQuery += ` AND c.id = $${statsParamCount}`
            statsParams.push(cursoId)
        }

        const statsResult = await pool.query(statsQuery, statsParams)
        const stats = statsResult.rows[0]

        // Query para contar total (para paginación correcta)
        let countQuery = `
            SELECT COUNT(*) as total_records
            FROM intentos_simulacro ia
                     JOIN simulacros s ON ia.simulacro_id = s.id
                     JOIN cursos c ON s.curso_id = c.id
            WHERE ia.usuario_id = $1 AND ia.puntaje IS NOT NULL
        `
        const countParams = [userId]
        let countParamCount = 1

        if (simulacroId && simulacroId.trim() !== '') {
            countParamCount++
            countQuery += ` AND ia.simulacro_id = $${countParamCount}`
            countParams.push(simulacroId)
        }

        if (cursoId && cursoId.trim() !== '') {
            countParamCount++
            countQuery += ` AND c.id = $${countParamCount}`
            countParams.push(cursoId)
        }

        const countResult = await pool.query(countQuery, countParams)
        const totalRecords = parseInt(countResult.rows[0].total_records) || 0

        // Formatear datos de respuesta con valores seguros
        const intentos = result.rows.map(row => ({
            id: row.id,
            usuario_id: row.usuario_id,
            simulacro_id: row.simulacro_id,
            puntaje: row.puntaje ? parseFloat(row.puntaje) : 0,
            total_preguntas: parseInt(row.total_preguntas) || 0,
            respuestas_correctas: parseInt(row.respuestas_correctas) || 0,
            tiempo_empleado_minutos: parseInt(row.tiempo_empleado_minutos) || 0,
            fecha_intento: row.fecha_intento,
            simulacro_titulo: row.simulacro_titulo,
            modo_evaluacion: row.modo_evaluacion,
            curso_titulo: row.curso_titulo,
            curso_id: row.curso_id
        }))

        res.json({
            success: true,
            data: {
                intentos,
                estadisticas: {
                    total_intentos: parseInt(stats.total_intentos) || 0,
                    promedio_puntaje: stats.promedio_puntaje ? parseFloat(stats.promedio_puntaje).toFixed(1) : '0.0',
                    mejor_puntaje: stats.mejor_puntaje ? parseFloat(stats.mejor_puntaje) : 0,
                    peor_puntaje: stats.peor_puntaje ? parseFloat(stats.peor_puntaje) : 0,
                    tiempo_promedio: stats.tiempo_promedio ? Math.round(parseFloat(stats.tiempo_promedio)) : 0
                },
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total_records: totalRecords,
                    total_pages: Math.ceil(totalRecords / limitNum),
                    has_next: pageNum < Math.ceil(totalRecords / limitNum),
                    has_prev: pageNum > 1
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo intentos:', error)
        console.error('Error stack:', error.stack)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            ...(process.env.NODE_ENV === 'development' && {
                error: error.message,
                stack: error.stack
            })
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

        // ✅ CORREGIDO: Usar puntaje IS NOT NULL
        const intentoResult = await pool.query(
            `SELECT ia.*, s.titulo as simulacro_titulo, s.modo_evaluacion, s.mostrar_respuestas_despues,
                    c.titulo as curso_titulo
             FROM intentos_simulacro ia
                      JOIN simulacros s ON ia.simulacro_id = s.id
                      JOIN cursos c ON s.curso_id = c.id
             WHERE ia.id = $1 AND ia.usuario_id = $2 AND ia.puntaje IS NOT NULL`,
            [intentoId, userId]
        )

        if (intentoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Intento no encontrado o no completado'
            })
        }

        const intento = intentoResult.rows[0]

        // Verificar si puede ver el detalle según la configuración
        const puedeVerDetalle = intento.modo_evaluacion === 'practica'

        let respuestas = null
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

            respuestas = detalleResult.rows
        }

        res.json({
            success: true,
            data: {
                intento,
                respuestas,
                analisis: {
                    comentario: `Has obtenido un ${intento.puntaje}% en este simulacro.`
                },
                recomendaciones: intento.puntaje < 70 ? [
                    'Revisa los temas donde tuviste más errores',
                    'Practica más simulacros del mismo tipo',
                    'Consulta el material de estudio del curso'
                ] : []
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