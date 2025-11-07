
// controllers/simulacroController.js
const pool = require('../config/database')
const { QuestionEvaluationService, QUESTION_TYPES } = require('./courseManagementController')

// =============================================
// OBTENER SIMULACROS POR CURSO
// =============================================
const getSimulacrosByCourse = async (req, res) => {
    try {
        const { cursoId } = req.params
        const userId = req.user?.id || null

        console.log('Debug - userId:', userId, 'cursoId:', cursoId)

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

        // ✅ ACTUALIZADO: Query con campos nuevos y compatibilidad
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

        // ✅ ACTUALIZADO: Formatear con compatibilidad entre modos
        const simulacros = result.rows.map(row => ({
            ...row,
            mis_intentos: parseInt(row.mis_intentos) || 0,
            mejor_puntaje: row.mejor_puntaje ? parseFloat(row.mejor_puntaje) : null,
            total_preguntas_disponibles: parseInt(row.total_preguntas_disponibles) || 0,
            // 🆕 COMPATIBILIDAD: Mapear campos nuevos y antiguos
            modo_evaluacion_display: getModoDisplay(row.modo_estudio || row.modo_evaluacion),
            tiempo_display: getTiempoDisplay(row),
            navegacion_display: getNavegacionDisplay(row.tipo_navegacion)
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
// OBTENER PREGUNTAS DEL SIMULACRO - ACTUALIZADO
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

        // ✅ ACTUALIZADO: Query con todos los campos nuevos
        const accessCheck = await pool.query(
            `SELECT s.*, c.es_gratuito, c.titulo as curso_titulo,
                    i.acceso_activo,
                    CASE
                        WHEN c.es_gratuito = true THEN 'habilitado'
                        WHEN i.estado_pago IS NULL THEN 'no_inscrito'
                        WHEN i.estado_pago = 'habilitado' AND i.acceso_activo = true THEN 'habilitado'
                        WHEN i.estado_pago = 'habilitado' AND i.acceso_activo = false THEN 'acceso_expirado'
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

        // Verificar acceso
        if (simulacro.estado_acceso !== 'habilitado') {
            let mensaje = 'Tu inscripción está pendiente de aprobación. Contacta al administrador.'
            if (simulacro.estado_acceso === 'no_inscrito') {
                mensaje = 'Debes inscribirte en el curso para acceder a este simulacro'
            } else if (simulacro.estado_acceso === 'acceso_expirado') {
                mensaje = 'Tu acceso al curso ha expirado. Solicita renovación para continuar'
            }
            return res.status(403).json({
                success: false,
                message: mensaje,
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

        // ✅ ACTUALIZADO: Query con soporte para tipos de pregunta avanzados
        const orderClause = simulacro.randomizar_preguntas ? 'ORDER BY RANDOM()' : 'ORDER BY p.fecha_creacion'
        const limitClause = simulacro.numero_preguntas > 0 ? `LIMIT ${simulacro.numero_preguntas}` : ''

        const preguntasResult = await pool.query(
            `SELECT p.id, p.enunciado, p.tipo_pregunta, p.imagen_url, p.explicacion,
                    json_agg(
                            json_build_object(
                                    'id', o.id,
                                    'texto_opcion', o.texto_opcion,
                                    'es_correcta', o.es_correcta,
                                    'orden', o.orden
                            ) ORDER BY ${simulacro.randomizar_opciones ? 'RANDOM()' : 'o.orden'}
                    ) as opciones
             FROM preguntas p
                      LEFT JOIN opciones_respuesta o ON p.id = o.pregunta_id
             WHERE p.simulacro_id = $1
             GROUP BY p.id, p.enunciado, p.tipo_pregunta, p.imagen_url, p.explicacion, p.fecha_creacion
                 ${orderClause} ${limitClause}`,
            [simulacroId]
        )

        if (preguntasResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Este simulacro no tiene preguntas configuradas'
            })
        }

        // ✅ ACTUALIZADO: Respuesta con campos nuevos y compatibilidad
        res.json({
            success: true,
            data: {
                simulacro: {
                    id: simulacro.id,
                    titulo: simulacro.titulo,
                    descripcion: simulacro.descripcion,
                    // 🆕 CAMPOS NUEVOS
                    modo_estudio: simulacro.modo_estudio,
                    tipo_tiempo: simulacro.tipo_tiempo,
                    tipo_navegacion: simulacro.tipo_navegacion,
                    configuracion_avanzada: simulacro.configuracion_avanzada,
                    // 📱 COMPATIBILIDAD CON FRONTEND ANTIGUO
                    modo_evaluacion: simulacro.modo_evaluacion || mapModoEstudioToEvaluacion(simulacro.modo_estudio),
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
                    tiempoPorPregunta: simulacro.tiempo_por_pregunta_segundos,
                    // 🆕 CONFIGURACIONES NUEVAS
                    modoEstudio: simulacro.modo_estudio,
                    tipoTiempo: simulacro.tipo_tiempo,
                    tipoNavegacion: simulacro.tipo_navegacion
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
// ENVIAR RESPUESTAS Y CALIFICAR - ACTUALIZADO
// =============================================

// const submitSimulacro = async (req, res) => {
//     console.log('🔥 INICIO submitSimulacro - simulacroId:', req.params.simulacroId)
//     console.log('🔥 userId:', req.user?.id)
//     console.log('🔥 Body recibido:', JSON.stringify(req.body, null, 2))
//
//     const client = await pool.connect()
//
//     try {
//         await client.query('BEGIN')
//         console.log('✅ Transaction iniciada')
//
//         const { simulacroId } = req.params
//         const { respuestas, tiempoEmpleadoMinutos } = req.body
//         const userId = req.user?.id
//
//         console.log('🔍 Variables extraídas:', {
//             simulacroId,
//             userId,
//             respuestasLength: respuestas?.length,
//             tiempoEmpleado: tiempoEmpleadoMinutos
//         })
//
//         if (!userId) {
//             console.log('❌ Usuario no autenticado')
//             return res.status(401).json({
//                 success: false,
//                 message: 'Usuario no autenticado'
//             })
//         }
//
//         if (!respuestas || !Array.isArray(respuestas) || respuestas.length === 0) {
//             console.log('❌ Respuestas inválidas:', {
//                 respuestas,
//                 isArray: Array.isArray(respuestas),
//                 length: respuestas?.length
//             })
//             return res.status(400).json({
//                 success: false,
//                 message: 'Respuestas son requeridas'
//             })
//         }
//
//         console.log('✅ Validaciones básicas pasadas')
//
//         // ✅ VERIFICAR SIMULACRO CON LOGS DETALLADOS
//         console.log('🔍 Verificando simulacro...')
//         const simulacroCheck = await client.query(
//             `SELECT s.*, c.es_gratuito, c.titulo as curso_titulo,
//                     COALESCE(i.estado_pago, 'no_inscrito') as estado_pago
//              FROM simulacros s
//                       JOIN cursos c ON s.curso_id = c.id
//                       LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
//              WHERE s.id = $2 AND s.activo = true`,
//             [userId, simulacroId]
//         )
//
//         console.log('🔍 Resultado simulacroCheck:', {
//             rowCount: simulacroCheck.rows.length,
//             simulacro: simulacroCheck.rows[0] ? {
//                 id: simulacroCheck.rows[0].id,
//                 titulo: simulacroCheck.rows[0].titulo,
//                 es_gratuito: simulacroCheck.rows[0].es_gratuito,
//                 estado_pago: simulacroCheck.rows[0].estado_pago
//             } : null
//         })
//
//         if (simulacroCheck.rows.length === 0) {
//             console.log('❌ Simulacro no encontrado')
//             await client.query('ROLLBACK')
//             return res.status(404).json({
//                 success: false,
//                 message: 'Simulacro no encontrado'
//             })
//         }
//
//         const simulacro = simulacroCheck.rows[0]
//         console.log('✅ Simulacro encontrado:', simulacro.titulo)
//
//         // Verificar acceso
//         if (!simulacro.es_gratuito && simulacro.estado_pago !== 'habilitado') {
//             console.log('❌ Sin acceso al simulacro:', {
//                 es_gratuito: simulacro.es_gratuito,
//                 estado_pago: simulacro.estado_pago
//             })
//             await client.query('ROLLBACK')
//             return res.status(403).json({
//                 success: false,
//                 message: 'No tienes acceso a este simulacro'
//             })
//         }
//
//         console.log('✅ Acceso verificado')
//
//         // ✅ CREAR INTENTO CON LOGS
//         console.log('🔍 Creando intento...')
//         const intentoResult = await client.query(
//             `INSERT INTO intentos_simulacro (usuario_id, simulacro_id, tiempo_empleado_minutos, total_preguntas, fecha_intento)
//              VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
//                  RETURNING id`,
//             [userId, simulacroId, tiempoEmpleadoMinutos || 0, respuestas.length]
//         )
//
//         const intentoId = intentoResult.rows[0].id
//         console.log('✅ Intento creado con ID:', intentoId)
//
//         let respuestasCorrectas = 0
//         let puntajeTotal = 0
//         const detalleRespuestas = []
//
//         console.log('🔍 Procesando respuestas...')
//
//         // ✅ PROCESAMIENTO DE RESPUESTAS CON LOGS DETALLADOS
//         for (const [index, respuesta] of respuestas.entries()) {
//             console.log(`🔍 Procesando respuesta ${index + 1}/${respuestas.length}:`, {
//                 preguntaId: respuesta.preguntaId,
//                 opcionSeleccionada: respuesta.opcionSeleccionadaId,
//                 respuestaTexto: respuesta.respuestaTexto
//             })
//
//             const { preguntaId, opcionSeleccionadaId, respuestaTexto } = respuesta
//
//             if (!preguntaId) {
//                 console.log('❌ ID de pregunta faltante en respuesta:', index)
//                 await client.query('ROLLBACK')
//                 return res.status(400).json({
//                     success: false,
//                     message: 'ID de pregunta requerido'
//                 })
//             }
//
//             // ✅ OBTENER PREGUNTA CON LOGS
//             try {
//                 console.log(`🔍 Buscando pregunta ID: ${preguntaId}`)
//                 const preguntaResult = await client.query(
//                     `SELECT p.*,
//                             json_agg(
//                                 json_build_object(
//                                     'id', o.id,
//                                     'texto_opcion', o.texto_opcion,
//                                     'es_correcta', o.es_correcta,
//                                     'orden', o.orden
//                                 ) ORDER BY o.orden
//                             ) as opciones
//                      FROM preguntas p
//                      LEFT JOIN opciones_respuesta o ON p.id = o.pregunta_id
//                      WHERE p.id = $1 AND p.simulacro_id = $2
//                      GROUP BY p.id`,
//                     [preguntaId, simulacroId]
//                 )
//
//                 console.log(`🔍 Pregunta encontrada:`, {
//                     found: preguntaResult.rows.length > 0,
//                     tipoPregunta: preguntaResult.rows[0]?.tipo_pregunta,
//                     opcionesCount: preguntaResult.rows[0]?.opciones?.length
//                 })
//
//                 if (preguntaResult.rows.length === 0) {
//                     console.log('❌ Pregunta no encontrada:', preguntaId)
//                     await client.query('ROLLBACK')
//                     return res.status(400).json({
//                         success: false,
//                         message: 'Pregunta inválida'
//                     })
//                 }
//
//                 const pregunta = preguntaResult.rows[0]
//                 const opciones = pregunta.opciones || []
//
//                 // ✅ EVALUACIÓN CON LOGS DETALLADOS
//                 console.log(`🔍 Evaluando respuesta para pregunta tipo: ${pregunta.tipo_pregunta}`)
//
//                 let evaluationResult
//                 try {
//                     if (QUESTION_TYPES[pregunta.tipo_pregunta]) {
//                         console.log(`🔍 Usando evaluación avanzada para: ${pregunta.tipo_pregunta}`)
//                         const respuestaUsuario = {
//                             opcion_seleccionada_id: opcionSeleccionadaId,
//                             respuesta_texto: respuestaTexto
//                         }
//                         evaluationResult = await QuestionEvaluationService.evaluateAnswer(
//                             pregunta, respuestaUsuario, opciones
//                         )
//                         console.log(`✅ Evaluación avanzada completada:`, {
//                             esCorrecta: evaluationResult.esCorrecta,
//                             puntaje: evaluationResult.puntaje
//                         })
//                     } else {
//                         console.log(`🔍 Usando evaluación básica para: ${pregunta.tipo_pregunta}`)
//                         const opcionSeleccionada = opciones.find(op => op.id === opcionSeleccionadaId)
//                         evaluationResult = {
//                             esCorrecta: opcionSeleccionada?.es_correcta || false,
//                             puntaje: opcionSeleccionada?.es_correcta ? 1.0 : 0.0,
//                             feedback: opcionSeleccionada?.es_correcta ? 'Respuesta correcta' : 'Respuesta incorrecta'
//                         }
//                         console.log(`✅ Evaluación básica completada:`, {
//                             esCorrecta: evaluationResult.esCorrecta,
//                             puntaje: evaluationResult.puntaje
//                         })
//                     }
//                 } catch (evalError) {
//                     console.error('❌ Error en evaluación, usando fallback:', evalError)
//                     const opcionSeleccionada = opciones.find(op => op.id === opcionSeleccionadaId)
//                     evaluationResult = {
//                         esCorrecta: opcionSeleccionada?.es_correcta || false,
//                         puntaje: opcionSeleccionada?.es_correcta ? 1.0 : 0.0,
//                         feedback: 'Evaluado con método básico (error en evaluación avanzada)'
//                     }
//                 }
//
//                 const esCorrecta = evaluationResult.esCorrecta
//                 const puntajePregunta = evaluationResult.puntaje || 0
//
//                 if (esCorrecta) respuestasCorrectas++
//                 puntajeTotal += puntajePregunta
//
//                 console.log(`✅ Respuesta ${index + 1} procesada:`, {
//                     esCorrecta,
//                     puntajePregunta,
//                     respuestasCorrectasTotal: respuestasCorrectas,
//                     puntajeTotalAcumulado: puntajeTotal
//                 })
//
//                 // ✅ GUARDAR RESPUESTA CON LOGS
//                 console.log(`🔍 Guardando respuesta en BD...`)
//                 await client.query(
//                     `INSERT INTO respuestas_usuario (intento_simulacro_id, pregunta_id, opcion_seleccionada_id, respuesta_texto, es_correcta, fecha_respuesta)
//                      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
//                     [intentoId, preguntaId, opcionSeleccionadaId, respuestaTexto, esCorrecta]
//                 )
//                 console.log(`✅ Respuesta guardada en BD`)
//
//                 // Agregar al detalle
//                 detalleRespuestas.push({
//                     preguntaId,
//                     enunciado: pregunta.enunciado,
//                     tipoPregunta: pregunta.tipo_pregunta,
//                     respuestaSeleccionada: opciones.find(op => op.id === opcionSeleccionadaId)?.texto_opcion || respuestaTexto,
//                     respuestaCorrecta: opciones.find(op => op.es_correcta)?.texto_opcion,
//                     esCorrecta,
//                     puntajePregunta,
//                     explicacion: pregunta.explicacion,
//                     feedback: evaluationResult.feedback
//                 })
//
//             } catch (preguntaError) {
//                 console.error(`❌ Error procesando pregunta ${index + 1}:`, preguntaError)
//                 await client.query('ROLLBACK')
//                 return res.status(500).json({
//                     success: false,
//                     message: `Error procesando pregunta ${index + 1}: ${preguntaError.message}`
//                 })
//             }
//         }
//
//         console.log('✅ Todas las respuestas procesadas')
//
//         // ✅ CALCULAR PUNTAJE FINAL
//         const puntajeFinal = Math.round((puntajeTotal / respuestas.length) * 100)
//         console.log('🔍 Calculando puntaje final:', {
//             puntajeTotal,
//             totalPreguntas: respuestas.length,
//             puntajeFinal
//         })
//
//         // ✅ ACTUALIZAR INTENTO
//         console.log('🔍 Actualizando intento con resultados...')
//         await client.query(
//             `UPDATE intentos_simulacro
//              SET puntaje = $1, respuestas_correctas = $2, completado = true
//              WHERE id = $3`,
//             [puntajeFinal, respuestasCorrectas, intentoId]
//         )
//         console.log('✅ Intento actualizado')
//
//         await client.query('COMMIT')
//         console.log('✅ Transaction committed')
//
//         // ✅ PREPARAR RESPUESTA
//         const modoEvaluacion = simulacro.modo_evaluacion || mapModoEstudioToEvaluacion(simulacro.modo_estudio)
//         const modoEstudio = simulacro.modo_estudio || mapModoEvaluacionToEstudio(simulacro.modo_evaluacion)
//
//         const response = {
//             intentoId,
//             puntaje: puntajeFinal,
//             respuestasCorrectas,
//             totalPreguntas: respuestas.length,
//             tiempoEmpleado: tiempoEmpleadoMinutos,
//             modoEvaluacion,
//             modoEstudio,
//             estadisticas: {
//                 porcentajeAprobacion: puntajeFinal >= 70 ? 'Aprobado' : 'Reprobado',
//                 calificacion: getCalificacionLabel(puntajeFinal)
//             }
//         }
//
//         // Agregar detalle según configuración
//         const mostrarDetalle = simulacro.mostrar_respuestas_despues === 1 ||
//             modoEvaluacion === 'practica' ||
//             modoEstudio === 'estudio'
//
//         if (mostrarDetalle) {
//             response.detalle = detalleRespuestas
//         } else if (modoEvaluacion === 'realista' || modoEstudio === 'revision') {
//             response.resumen = `${respuestasCorrectas}/${respuestas.length} correctas`
//         }
//
//         console.log('✅ Respuesta preparada:', {
//             intentoId,
//             puntaje: puntajeFinal,
//             respuestasCorrectas,
//             totalPreguntas: respuestas.length,
//             tieneDetalle: !!response.detalle,
//             tieneResumen: !!response.resumen
//         })
//
//         console.log('🎉 ENVIANDO RESPUESTA EXITOSA')
//         res.json({
//             success: true,
//             message: 'Simulacro completado exitosamente',
//             data: response
//         })
//
//     } catch (error) {
//         await client.query('ROLLBACK')
//         console.error('💥 ERROR CRÍTICO en submitSimulacro:', {
//             message: error.message,
//             stack: error.stack,
//             sqlState: error.code,
//             detail: error.detail
//         })
//
//         res.status(500).json({
//             success: false,
//             message: 'Error interno del servidor',
//             error: process.env.NODE_ENV === 'development' ? error.message : undefined
//         })
//     } finally {
//         client.release()
//         console.log('🔧 Cliente de BD liberado')
//     }
// }

const submitSimulacro = async (req, res) => {
    console.log('🔥 INICIO submitSimulacro OPTIMIZADO')
    const startTime = Date.now()

    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const { simulacroId } = req.params
        const { respuestas, tiempoEmpleadoMinutos } = req.body
        const userId = req.user?.id

        console.log(`📊 Procesando ${respuestas.length} respuestas para usuario ${userId}`)

        // ✅ PASO 1: Validaciones básicas (igual que antes)
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
        }

        if (!respuestas || !Array.isArray(respuestas) || respuestas.length === 0) {
            return res.status(400).json({ success: false, message: 'Respuestas son requeridas' })
        }

        // ✅ PASO 2: Verificar simulacro (igual que antes)
        const simulacroCheck = await client.query(
            `SELECT s.*, c.es_gratuito, c.titulo as curso_titulo,
                    i.acceso_activo,
                    COALESCE(i.estado_pago, 'no_inscrito') as estado_pago
             FROM simulacros s
                      JOIN cursos c ON s.curso_id = c.id
                      LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
             WHERE s.id = $2 AND s.activo = true`,
            [userId, simulacroId]
        )

        if (simulacroCheck.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ success: false, message: 'Simulacro no encontrado' })
        }

        const simulacro = simulacroCheck.rows[0]

        // Verificar acceso (ahora valida acceso_activo)
        if (!simulacro.es_gratuito && (simulacro.estado_pago !== 'habilitado' || simulacro.acceso_activo !== true)) {
            await client.query('ROLLBACK')
            return res.status(403).json({ success: false, message: 'No tienes acceso a este simulacro' })
        }

        // ✅ PASO 3: Crear intento (igual que antes)
        const intentoResult = await client.query(
            `INSERT INTO intentos_simulacro (usuario_id, simulacro_id, tiempo_empleado_minutos, total_preguntas, fecha_intento)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id`,
            [userId, simulacroId, tiempoEmpleadoMinutos || 0, respuestas.length]
        )

        const intentoId = intentoResult.rows[0].id
        console.log('✅ Intento creado:', intentoId)

        // ✅ PASO 4: OPTIMIZACIÓN - Obtener TODAS las preguntas de una vez
        console.log('🚀 OPTIMIZACIÓN: Obteniendo todas las preguntas en 1 query...')
        const preguntasIds = respuestas.map(r => r.preguntaId)

        const todasPreguntasResult = await client.query(
            `SELECT p.id, p.enunciado, p.tipo_pregunta, p.explicacion,
                    json_agg(
                        json_build_object(
                            'id', o.id,
                            'texto_opcion', o.texto_opcion,
                            'es_correcta', o.es_correcta,
                            'orden', o.orden
                        ) ORDER BY o.orden
                    ) as opciones
             FROM preguntas p
             LEFT JOIN opciones_respuesta o ON p.id = o.pregunta_id
             WHERE p.id = ANY($1) AND p.simulacro_id = $2
             GROUP BY p.id, p.enunciado, p.tipo_pregunta, p.explicacion`,
            [preguntasIds, simulacroId]
        )

        // Crear mapa para acceso O(1)
        const preguntasMap = new Map()
        todasPreguntasResult.rows.forEach(pregunta => {
            preguntasMap.set(pregunta.id, pregunta)
        })

        console.log(`✅ Obtenidas ${todasPreguntasResult.rows.length} preguntas en 1 query`)

        // ✅ PASO 5: OPTIMIZACIÓN - Procesar todas las respuestas en memoria
        console.log('🧮 Procesando respuestas en memoria...')

        let respuestasCorrectas = 0
        let puntajeTotal = 0
        const detalleRespuestas = []
        const batchInserts = []

        for (const [index, respuesta] of respuestas.entries()) {
            const { preguntaId, opcionSeleccionadaId, respuestaTexto } = respuesta

            const pregunta = preguntasMap.get(preguntaId)
            if (!pregunta) {
                await client.query('ROLLBACK')
                return res.status(400).json({
                    success: false,
                    message: `Pregunta inválida: ${preguntaId}`
                })
            }

            const opciones = pregunta.opciones || []

            // ✅ EVALUACIÓN RÁPIDA (solo básica para optimizar)
            let evaluationResult
            if (pregunta.tipo_pregunta === 'multiple' || pregunta.tipo_pregunta === 'true_false') {
                const opcionSeleccionada = opciones.find(op => op.id === opcionSeleccionadaId)
                evaluationResult = {
                    esCorrecta: opcionSeleccionada?.es_correcta || false,
                    puntaje: opcionSeleccionada?.es_correcta ? 1.0 : 0.0,
                    feedback: opcionSeleccionada?.es_correcta ? 'Respuesta correcta' : 'Respuesta incorrecta'
                }
            } else {
                // Para otros tipos también evaluación básica (más rápido)
                const opcionSeleccionada = opciones.find(op => op.id === opcionSeleccionadaId)
                evaluationResult = {
                    esCorrecta: opcionSeleccionada?.es_correcta || false,
                    puntaje: opcionSeleccionada?.es_correcta ? 1.0 : 0.0,
                    feedback: 'Evaluación básica optimizada'
                }
            }

            const esCorrecta = evaluationResult.esCorrecta
            const puntajePregunta = evaluationResult.puntaje || 0

            if (esCorrecta) respuestasCorrectas++
            puntajeTotal += puntajePregunta

            // Preparar para insert masivo
            batchInserts.push([
                intentoId,
                preguntaId,
                opcionSeleccionadaId,
                respuestaTexto,
                esCorrecta
            ])

            // Preparar detalle para respuesta
            detalleRespuestas.push({
                preguntaId,
                enunciado: pregunta.enunciado,
                tipoPregunta: pregunta.tipo_pregunta,
                respuestaSeleccionada: opciones.find(op => op.id === opcionSeleccionadaId)?.texto_opcion || respuestaTexto,
                respuestaCorrecta: opciones.find(op => op.es_correcta)?.texto_opcion,
                esCorrecta,
                puntajePregunta,
                explicacion: pregunta.explicacion,
                feedback: evaluationResult.feedback
            })

            // Log de progreso cada 25 respuestas
            if ((index + 1) % 25 === 0) {
                console.log(`📝 Procesadas ${index + 1}/${respuestas.length} respuestas`)
            }
        }

        console.log('✅ Todas las respuestas procesadas en memoria')

        // ✅ PASO 6: OPTIMIZACIÓN - INSERT MASIVO en una sola query
        console.log('💾 Guardando todas las respuestas en 1 query...')

        if (batchInserts.length > 0) {
            // Construir query con múltiples VALUES
            const values = []
            const params = []
            let paramIndex = 1

            batchInserts.forEach((insert) => {
                values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, CURRENT_TIMESTAMP)`)
                params.push(...insert)
                paramIndex += 5
            })

            const massiveInsertQuery = `
                INSERT INTO respuestas_usuario 
                (intento_simulacro_id, pregunta_id, opcion_seleccionada_id, respuesta_texto, es_correcta, fecha_respuesta)
                VALUES ${values.join(', ')}
            `

            await client.query(massiveInsertQuery, params)
            console.log(`✅ Insertadas ${batchInserts.length} respuestas en 1 operación masiva`)
        }

        // ✅ PASO 7: Actualizar intento con resultados finales
        const puntajeFinal = Math.round((puntajeTotal / respuestas.length) * 100)

        await client.query(
            `UPDATE intentos_simulacro
             SET puntaje = $1, respuestas_correctas = $2, completado = true
             WHERE id = $3`,
            [puntajeFinal, respuestasCorrectas, intentoId]
        )

        await client.query('COMMIT')

        const endTime = Date.now()
        const processingTime = endTime - startTime
        console.log(`🎉 PROCESO OPTIMIZADO COMPLETADO en ${processingTime}ms`)

        // ✅ PASO 8: Respuesta (IGUAL QUE ANTES - Frontend no cambia)
        const modoEvaluacion = simulacro.modo_evaluacion || mapModoEstudioToEvaluacion(simulacro.modo_estudio)
        const modoEstudio = simulacro.modo_estudio || mapModoEvaluacionToEstudio(simulacro.modo_evaluacion)

        const response = {
            intentoId,
            puntaje: puntajeFinal,
            respuestasCorrectas,
            totalPreguntas: respuestas.length,
            tiempoEmpleado: tiempoEmpleadoMinutos,
            modoEvaluacion,
            modoEstudio,
            estadisticas: {
                porcentajeAprobacion: puntajeFinal >= 70 ? 'Aprobado' : 'Reprobado',
                calificacion: getCalificacionLabel(puntajeFinal)
            }
        }

        // Agregar detalle según configuración
        const mostrarDetalle = simulacro.mostrar_respuestas_despues === 1 ||
            modoEvaluacion === 'practica' ||
            modoEstudio === 'estudio'

        if (mostrarDetalle) {
            response.detalle = detalleRespuestas
        } else if (modoEvaluacion === 'realista' || modoEstudio === 'revision') {
            response.resumen = `${respuestasCorrectas}/${respuestas.length} correctas`
        }

        // ✅ MISMA RESPUESTA QUE ANTES - Frontend funciona igual
        res.json({
            success: true,
            message: 'Simulacro completado exitosamente',
            data: response
        })

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('💥 ERROR en submitSimulacro optimizado:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    } finally {
        client.release()
    }
}

// const submitSimulacro = async (req, res) => {
//     const client = await pool.connect()
//
//     try {
//         await client.query('BEGIN')
//
//         const { simulacroId } = req.params
//         const { respuestas, tiempoEmpleadoMinutos } = req.body
//         const userId = req.user?.id
//
//         if (!userId) {
//             return res.status(401).json({
//                 success: false,
//                 message: 'Usuario no autenticado'
//             })
//         }
//
//         if (!respuestas || !Array.isArray(respuestas) || respuestas.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Respuestas son requeridas'
//             })
//         }
//
//         // ✅ ACTUALIZADO: Verificar simulacro con campos nuevos
//         const simulacroCheck = await client.query(
//             `SELECT s.*, c.es_gratuito, c.titulo as curso_titulo,
//                     COALESCE(i.estado_pago, 'no_inscrito') as estado_pago
//              FROM simulacros s
//                       JOIN cursos c ON s.curso_id = c.id
//                       LEFT JOIN inscripciones i ON c.id = i.curso_id AND i.usuario_id = $1
//              WHERE s.id = $2 AND s.activo = true`,
//             [userId, simulacroId]
//         )
//
//         if (simulacroCheck.rows.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Simulacro no encontrado'
//             })
//         }
//
//         const simulacro = simulacroCheck.rows[0]
//
//         // Verificar acceso
//         if (!simulacro.es_gratuito && simulacro.estado_pago !== 'habilitado') {
//             return res.status(403).json({
//                 success: false,
//                 message: 'No tienes acceso a este simulacro'
//             })
//         }
//
//         // Crear intento
//         const intentoResult = await client.query(
//             `INSERT INTO intentos_simulacro (usuario_id, simulacro_id, tiempo_empleado_minutos, total_preguntas, fecha_intento)
//              VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
//                  RETURNING id`,
//             [userId, simulacroId, tiempoEmpleadoMinutos || 0, respuestas.length]
//         )
//
//         const intentoId = intentoResult.rows[0].id
//         let respuestasCorrectas = 0
//         let puntajeTotal = 0
//         const detalleRespuestas = []
//
//         // ✅ ACTUALIZADO: Procesamiento avanzado por tipo de pregunta
//         for (const respuesta of respuestas) {
//             const { preguntaId, opcionSeleccionadaId, respuestaTexto } = respuesta
//
//             if (!preguntaId) {
//                 await client.query('ROLLBACK')
//                 return res.status(400).json({
//                     success: false,
//                     message: 'ID de pregunta requerido'
//                 })
//             }
//
//             // Obtener pregunta con todas las opciones
//             const preguntaResult = await client.query(
//                 `SELECT p.*,
//                         json_agg(
//                             json_build_object(
//                                 'id', o.id,
//                                 'texto_opcion', o.texto_opcion,
//                                 'es_correcta', o.es_correcta,
//                                 'orden', o.orden
//                             ) ORDER BY o.orden
//                         ) as opciones
//                  FROM preguntas p
//                  LEFT JOIN opciones_respuesta o ON p.id = o.pregunta_id
//                  WHERE p.id = $1 AND p.simulacro_id = $2
//                  GROUP BY p.id`,
//                 [preguntaId, simulacroId]
//             )
//
//             if (preguntaResult.rows.length === 0) {
//                 await client.query('ROLLBACK')
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Pregunta inválida'
//                 })
//             }
//
//             const pregunta = preguntaResult.rows[0]
//             const opciones = pregunta.opciones || []
//
//             // 🆕 EVALUACIÓN AVANZADA POR TIPO
//             let evaluationResult
//             try {
//                 if (QUESTION_TYPES[pregunta.tipo_pregunta]) {
//                     // Usar servicio de evaluación avanzado
//                     const respuestaUsuario = {
//                         opcion_seleccionada_id: opcionSeleccionadaId,
//                         respuesta_texto: respuestaTexto
//                     }
//                     evaluationResult = await QuestionEvaluationService.evaluateAnswer(
//                         pregunta, respuestaUsuario, opciones
//                     )
//                 } else {
//                     // Evaluación básica para compatibilidad
//                     const opcionSeleccionada = opciones.find(op => op.id === opcionSeleccionadaId)
//                     evaluationResult = {
//                         esCorrecta: opcionSeleccionada?.es_correcta || false,
//                         puntaje: opcionSeleccionada?.es_correcta ? 1.0 : 0.0,
//                         feedback: opcionSeleccionada?.es_correcta ? 'Respuesta correcta' : 'Respuesta incorrecta'
//                     }
//                 }
//             } catch (error) {
//                 console.error('Error evaluando pregunta:', error)
//                 // Fallback a evaluación básica
//                 const opcionSeleccionada = opciones.find(op => op.id === opcionSeleccionadaId)
//                 evaluationResult = {
//                     esCorrecta: opcionSeleccionada?.es_correcta || false,
//                     puntaje: opcionSeleccionada?.es_correcta ? 1.0 : 0.0,
//                     feedback: 'Evaluado con método básico'
//                 }
//             }
//
//             const esCorrecta = evaluationResult.esCorrecta
//             const puntajePregunta = evaluationResult.puntaje || 0
//
//             if (esCorrecta) respuestasCorrectas++
//             puntajeTotal += puntajePregunta
//
//             // Guardar respuesta del usuario
//             await client.query(
//                 `INSERT INTO respuestas_usuario (intento_simulacro_id, pregunta_id, opcion_seleccionada_id, respuesta_texto, es_correcta, fecha_respuesta)
//                  VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
//                 [intentoId, preguntaId, opcionSeleccionadaId, respuestaTexto, esCorrecta]
//             )
//
//             // Agregar al detalle
//             detalleRespuestas.push({
//                 preguntaId,
//                 enunciado: pregunta.enunciado,
//                 tipoPregunta: pregunta.tipo_pregunta,
//                 respuestaSeleccionada: opciones.find(op => op.id === opcionSeleccionadaId)?.texto_opcion || respuestaTexto,
//                 respuestaCorrecta: opciones.find(op => op.es_correcta)?.texto_opcion,
//                 esCorrecta,
//                 puntajePregunta,
//                 explicacion: pregunta.explicacion,
//                 feedback: evaluationResult.feedback
//             })
//         }
//
//         // Calcular puntaje final
//         const puntajeFinal = Math.round((puntajeTotal / respuestas.length) * 100)
//
//         // Actualizar intento con resultados
//         await client.query(
//             `UPDATE intentos_simulacro
//              SET puntaje = $1, respuestas_correctas = $2, completado = true
//              WHERE id = $3`,
//             [puntajeFinal, respuestasCorrectas, intentoId]
//         )
//
//         await client.query('COMMIT')
//
//         // ✅ ACTUALIZADO: Respuesta según modo (nuevo y antiguo)
//         const modoEvaluacion = simulacro.modo_evaluacion || mapModoEstudioToEvaluacion(simulacro.modo_estudio)
//         const modoEstudio = simulacro.modo_estudio || mapModoEvaluacionToEstudio(simulacro.modo_evaluacion)
//
//         const response = {
//             intentoId,
//             puntaje: puntajeFinal,
//             respuestasCorrectas,
//             totalPreguntas: respuestas.length,
//             tiempoEmpleado: tiempoEmpleadoMinutos,
//             // 📱 COMPATIBILIDAD
//             modoEvaluacion,
//             modoEstudio,
//             estadisticas: {
//                 porcentajeAprobacion: puntajeFinal >= 70 ? 'Aprobado' : 'Reprobado',
//                 calificacion: getCalificacionLabel(puntajeFinal)
//             }
//         }
//
//         // Agregar detalle según configuración
//         const mostrarDetalle = simulacro.mostrar_respuestas_despues === 1 ||
//             modoEvaluacion === 'practica' ||
//             modoEstudio === 'estudio'
//
//         if (mostrarDetalle) {
//             response.detalle = detalleRespuestas
//         } else if (modoEvaluacion === 'realista' || modoEstudio === 'revision') {
//             response.resumen = `${respuestasCorrectas}/${respuestas.length} correctas`
//         }
//
//         res.json({
//             success: true,
//             message: 'Simulacro completado exitosamente',
//             data: response
//         })
//
//     } catch (error) {
//         await client.query('ROLLBACK')
//         console.error('Error enviando simulacro:', error)
//         res.status(500).json({
//             success: false,
//             message: 'Error interno del servidor'
//         })
//     } finally {
//         client.release()
//     }
// }





// =============================================
// INTENTOS DEL USUARIO - SIN CAMBIOS NECESARIOS
// =============================================
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

        let query = `
            SELECT ia.*, s.titulo as simulacro_titulo, 
                   COALESCE(s.modo_estudio, s.modo_evaluacion) as modo_evaluacion,
                   c.titulo as curso_titulo, c.id as curso_id
            FROM intentos_simulacro ia
                     JOIN simulacros s ON ia.simulacro_id = s.id
                     JOIN cursos c ON s.curso_id = c.id
            WHERE ia.usuario_id = $1 AND ia.puntaje IS NOT NULL
        `
        const params = [userId]
        let paramCount = 1

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

        const pageNum = Math.max(1, parseInt(page) || 1)
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
        const offset = (pageNum - 1) * limitNum

        query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
        params.push(limitNum, offset)

        const result = await pool.query(query, params)

        // Query de estadísticas
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

        // Query para contar total
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
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// DETALLE DE INTENTO - SIN CAMBIOS NECESARIOS
// =============================================
const getAttemptDetail = async (req, res) => {
    try {
        const { intentoId } = req.params
        const userId = req.user.id

        const intentoResult = await pool.query(
            `SELECT ia.*, s.titulo as simulacro_titulo, 
                    COALESCE(s.modo_estudio, s.modo_evaluacion) as modo_evaluacion, 
                    s.mostrar_respuestas_despues,
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
        const puedeVerDetalle = intento.modo_evaluacion === 'practica' || intento.modo_evaluacion === 'estudio'

        let respuestas = null
        if (puedeVerDetalle) {
            const detalleResult = await pool.query(
                `SELECT ru.*, p.enunciado, p.explicacion, p.imagen_url, p.tipo_pregunta,
                        o.texto_opcion as respuesta_seleccionada,
                        oc.texto_opcion as respuesta_correcta
                 FROM respuestas_usuario ru
                          JOIN preguntas p ON ru.pregunta_id = p.id
                          LEFT JOIN opciones_respuesta o ON ru.opcion_seleccionada_id = o.id
                          LEFT JOIN opciones_respuesta oc ON p.id = oc.pregunta_id AND oc.es_correcta = true
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
                    comentario: `Has obtenido un ${intento.puntaje}% en este simulacro.`,
                    calificacion: getCalificacionLabel(intento.puntaje)
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

// =============================================
// FUNCIONES DE UTILIDAD PARA COMPATIBILIDAD
// =============================================
const getModoDisplay = (modo) => {
    const modos = {
        // Nuevos modos
        'estudio': { name: 'Estudio', color: 'bg-green-100 text-green-800' },
        'revision': { name: 'Revisión', color: 'bg-blue-100 text-blue-800' },
        'evaluacion': { name: 'Evaluación', color: 'bg-yellow-100 text-yellow-800' },
        'examen_real': { name: 'Examen Real', color: 'bg-red-100 text-red-800' },
        // Modos antiguos
        'practica': { name: 'Práctica', color: 'bg-green-100 text-green-800' },
        'realista': { name: 'Realista', color: 'bg-yellow-100 text-yellow-800' },
        'examen': { name: 'Examen', color: 'bg-red-100 text-red-800' }
    }
    return modos[modo] || { name: modo, color: 'bg-gray-100 text-gray-800' }
}

const getTiempoDisplay = (simulacro) => {
    if (simulacro.tipo_tiempo === 'sin_limite') return 'Sin límite'
    if (simulacro.tipo_tiempo === 'por_pregunta' && simulacro.tiempo_por_pregunta_segundos) {
        return `${simulacro.tiempo_por_pregunta_segundos}s/pregunta`
    }
    if (simulacro.tiempo_limite_minutos) {
        const horas = Math.floor(simulacro.tiempo_limite_minutos / 60)
        const minutos = simulacro.tiempo_limite_minutos % 60
        if (horas > 0) {
            return `${horas}h ${minutos}min`
        }
        return `${minutos} min`
    }
    return 'No definido'
}

const getNavegacionDisplay = (tipoNavegacion) => {
    const tipos = {
        'libre': 'Navegación libre',
        'secuencial': 'Navegación secuencial'
    }
    return tipos[tipoNavegacion] || 'Libre'
}

const mapModoEstudioToEvaluacion = (modoEstudio) => {
    const mapeo = {
        'estudio': 'practica',
        'revision': 'realista',
        'evaluacion': 'realista',
        'examen_real': 'examen'
    }
    return mapeo[modoEstudio] || 'practica'
}

const mapModoEvaluacionToEstudio = (modoEvaluacion) => {
    const mapeo = {
        'practica': 'estudio',
        'realista': 'revision',
        'examen': 'examen_real'
    }
    return mapeo[modoEvaluacion] || 'estudio'
}

const getCalificacionLabel = (puntaje) => {
    if (puntaje >= 90) return 'Excelente'
    if (puntaje >= 80) return 'Muy Bueno'
    if (puntaje >= 70) return 'Bueno'
    if (puntaje >= 60) return 'Regular'
    return 'Necesita Mejorar'
}

// =============================================
// ADMIN: OBTENER TODOS LOS SIMULACROS
// =============================================
const getAllSimulacros = async (req, res) => {
    try {
        const { cursoId, activo, modoEstudio, page = 1, limit = 50 } = req.query
        const offset = (parseInt(page) - 1) * parseInt(limit)

        // Construir query dinámicamente
        let whereConditions = []
        let queryParams = []
        let paramIndex = 1

        if (cursoId) {
            whereConditions.push(`s.curso_id = $${paramIndex}`)
            queryParams.push(cursoId)
            paramIndex++
        }

        if (activo !== undefined) {
            whereConditions.push(`s.activo = $${paramIndex}`)
            queryParams.push(activo === 'true')
            paramIndex++
        }

        if (modoEstudio) {
            whereConditions.push(`s.modo_estudio = $${paramIndex}`)
            queryParams.push(modoEstudio)
            paramIndex++
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : ''

        // Query principal
        const result = await pool.query(
            `SELECT
                s.*,
                c.titulo as curso_titulo,
                c.slug as curso_slug,
                c.activo as curso_activo,
                (SELECT COUNT(*) FROM preguntas p WHERE p.simulacro_id = s.id) as total_preguntas,
                (SELECT COUNT(*) FROM intentos_simulacro i WHERE i.simulacro_id = s.id) as total_intentos,
                (SELECT COUNT(DISTINCT i.usuario_id) FROM intentos_simulacro i WHERE i.simulacro_id = s.id) as usuarios_unicos,
                (SELECT COALESCE(AVG(i.puntaje), 0) FROM intentos_simulacro i WHERE i.simulacro_id = s.id) as puntaje_promedio
             FROM simulacros s
             JOIN cursos c ON s.curso_id = c.id
             ${whereClause}
             ORDER BY s.fecha_creacion DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...queryParams, parseInt(limit), offset]
        )

        // Contar total para paginación
        const countResult = await pool.query(
            `SELECT COUNT(*) as total
             FROM simulacros s
             JOIN cursos c ON s.curso_id = c.id
             ${whereClause}`,
            queryParams
        )

        const totalSimulacros = parseInt(countResult.rows[0].total)
        const totalPages = Math.ceil(totalSimulacros / parseInt(limit))

        // Formatear respuesta
        const simulacros = result.rows.map(row => ({
            id: row.id,
            titulo: row.titulo,
            descripcion: row.descripcion,
            activo: row.activo,
            curso: {
                id: row.curso_id,
                titulo: row.curso_titulo,
                slug: row.curso_slug,
                activo: row.curso_activo
            },
            configuracion: {
                modo_evaluacion: row.modo_evaluacion,
                modo_estudio: row.modo_estudio,
                numero_preguntas: row.numero_preguntas,
                intentos_permitidos: row.intentos_permitidos,
                tiempo_limite_minutos: row.tiempo_limite_minutos,
                tiempo_por_pregunta_segundos: row.tiempo_por_pregunta_segundos,
                tipo_tiempo: row.tipo_tiempo,
                tipo_navegacion: row.tipo_navegacion,
                randomizar_preguntas: row.randomizar_preguntas,
                randomizar_opciones: row.randomizar_opciones,
                mostrar_respuestas_despues: row.mostrar_respuestas_despues,
                configuracion_avanzada: row.configuracion_avanzada
            },
            estadisticas: {
                total_preguntas: parseInt(row.total_preguntas) || 0,
                total_intentos: parseInt(row.total_intentos) || 0,
                usuarios_unicos: parseInt(row.usuarios_unicos) || 0,
                puntaje_promedio: parseFloat(row.puntaje_promedio) || 0
            },
            fecha_creacion: row.fecha_creacion
        }))

        // Estadísticas generales
        const statsResult = await pool.query(
            `SELECT
                COUNT(*) as total_simulacros,
                COUNT(CASE WHEN s.activo = true THEN 1 END) as simulacros_activos,
                COUNT(CASE WHEN s.activo = false THEN 1 END) as simulacros_inactivos,
                COUNT(DISTINCT s.curso_id) as cursos_con_simulacros,
                (SELECT COUNT(*) FROM preguntas p
                 JOIN simulacros sim ON p.simulacro_id = sim.id
                 ${whereClause.replace('s.', 'sim.')}) as total_preguntas_global,
                (SELECT COUNT(*) FROM intentos_simulacro i
                 JOIN simulacros sim ON i.simulacro_id = sim.id
                 ${whereClause.replace('s.', 'sim.')}) as total_intentos_global
             FROM simulacros s
             JOIN cursos c ON s.curso_id = c.id
             ${whereClause}`,
            queryParams
        )

        res.json({
            success: true,
            data: {
                simulacros,
                paginacion: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalSimulacros,
                    totalPages,
                    hasNext: parseInt(page) < totalPages,
                    hasPrev: parseInt(page) > 1
                },
                estadisticas: {
                    total_simulacros: parseInt(statsResult.rows[0].total_simulacros),
                    simulacros_activos: parseInt(statsResult.rows[0].simulacros_activos),
                    simulacros_inactivos: parseInt(statsResult.rows[0].simulacros_inactivos),
                    cursos_con_simulacros: parseInt(statsResult.rows[0].cursos_con_simulacros),
                    total_preguntas_global: parseInt(statsResult.rows[0].total_preguntas_global),
                    total_intentos_global: parseInt(statsResult.rows[0].total_intentos_global)
                },
                filtros_aplicados: {
                    cursoId: cursoId || null,
                    activo: activo !== undefined ? (activo === 'true') : null,
                    modoEstudio: modoEstudio || null
                }
            }
        })

    } catch (error) {
        console.error('Error obteniendo todos los simulacros:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ADMIN: OBTENER TODOS LOS INTENTOS (PARA PURIFICACIÓN)
// =============================================
const getAllIntentos = async (req, res) => {
    try {
        const { simulacroId, usuarioId, cursoId, fechaDesde, fechaHasta, puntajeMin, puntajeMax, page = 1, limit = 100 } = req.query
        const offset = (parseInt(page) - 1) * parseInt(limit)

        // Construir query dinámicamente
        let whereConditions = []
        let queryParams = []
        let paramIndex = 1

        if (simulacroId) {
            whereConditions.push(`i.simulacro_id = $${paramIndex}`)
            queryParams.push(simulacroId)
            paramIndex++
        }

        if (usuarioId) {
            whereConditions.push(`i.usuario_id = $${paramIndex}`)
            queryParams.push(usuarioId)
            paramIndex++
        }

        if (cursoId) {
            whereConditions.push(`c.id = $${paramIndex}`)
            queryParams.push(cursoId)
            paramIndex++
        }

        if (fechaDesde) {
            whereConditions.push(`i.fecha_intento >= $${paramIndex}`)
            queryParams.push(fechaDesde)
            paramIndex++
        }

        if (fechaHasta) {
            whereConditions.push(`i.fecha_intento <= $${paramIndex}`)
            queryParams.push(fechaHasta)
            paramIndex++
        }

        if (puntajeMin) {
            whereConditions.push(`i.puntaje >= $${paramIndex}`)
            queryParams.push(parseFloat(puntajeMin))
            paramIndex++
        }

        if (puntajeMax) {
            whereConditions.push(`i.puntaje <= $${paramIndex}`)
            queryParams.push(parseFloat(puntajeMax))
            paramIndex++
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : ''

        // Query principal con información completa
        const result = await pool.query(
            `SELECT
                i.*,
                u.nombre_completo as usuario_nombre,
                u.email as usuario_email,
                s.titulo as simulacro_titulo,
                c.titulo as curso_titulo,
                c.id as curso_id,
                (SELECT COUNT(*) FROM respuestas_usuario ru WHERE ru.intento_simulacro_id = i.id) as total_respuestas_guardadas
             FROM intentos_simulacro i
             JOIN perfiles_usuario u ON i.usuario_id = u.id
             JOIN simulacros s ON i.simulacro_id = s.id
             JOIN cursos c ON s.curso_id = c.id
             ${whereClause}
             ORDER BY i.fecha_intento DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...queryParams, parseInt(limit), offset]
        )

        // Contar total
        const countResult = await pool.query(
            `SELECT COUNT(*) as total
             FROM intentos_simulacro i
             JOIN perfiles_usuario u ON i.usuario_id = u.id
             JOIN simulacros s ON i.simulacro_id = s.id
             JOIN cursos c ON s.curso_id = c.id
             ${whereClause}`,
            queryParams
        )

        const totalIntentos = parseInt(countResult.rows[0].total)
        const totalPages = Math.ceil(totalIntentos / parseInt(limit))

        // Estadísticas de almacenamiento
        const storageStats = await pool.query(
            `SELECT
                COUNT(i.id) as total_intentos,
                SUM((SELECT COUNT(*) FROM respuestas_usuario ru WHERE ru.intento_simulacro_id = i.id)) as total_respuestas_almacenadas,
                AVG(i.puntaje) as puntaje_promedio,
                MIN(i.fecha_intento) as fecha_intento_mas_antiguo,
                MAX(i.fecha_intento) as fecha_intento_mas_reciente
             FROM intentos_simulacro i
             JOIN simulacros s ON i.simulacro_id = s.id
             JOIN cursos c ON s.curso_id = c.id
             ${whereClause}`,
            queryParams
        )

        const intentos = result.rows.map(row => ({
            id: row.id,
            fecha_intento: row.fecha_intento,
            completado: row.completado,
            usuario: {
                id: row.usuario_id,
                nombre: row.usuario_nombre,
                email: row.usuario_email
            },
            simulacro: {
                id: row.simulacro_id,
                titulo: row.simulacro_titulo
            },
            curso: {
                id: row.curso_id,
                titulo: row.curso_titulo
            },
            resultados: {
                puntaje: parseFloat(row.puntaje) || 0,
                total_preguntas: row.total_preguntas,
                respuestas_correctas: row.respuestas_correctas,
                tiempo_empleado_minutos: row.tiempo_empleado_minutos
            },
            almacenamiento: {
                respuestas_guardadas: parseInt(row.total_respuestas_guardadas)
            }
        }))

        res.json({
            success: true,
            data: {
                intentos,
                paginacion: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalIntentos,
                    totalPages,
                    hasNext: parseInt(page) < totalPages,
                    hasPrev: parseInt(page) > 1
                },
                estadisticas_almacenamiento: {
                    total_intentos: parseInt(storageStats.rows[0].total_intentos),
                    total_respuestas_almacenadas: parseInt(storageStats.rows[0].total_respuestas_almacenadas) || 0,
                    puntaje_promedio: parseFloat(storageStats.rows[0].puntaje_promedio) || 0,
                    fecha_mas_antigua: storageStats.rows[0].fecha_intento_mas_antiguo,
                    fecha_mas_reciente: storageStats.rows[0].fecha_intento_mas_reciente,
                    espacio_estimado_mb: ((parseInt(storageStats.rows[0].total_respuestas_almacenadas) || 0) * 0.5) / 1024 // Estimación: 0.5KB por respuesta
                },
                filtros_aplicados: {
                    simulacroId: simulacroId || null,
                    usuarioId: usuarioId || null,
                    cursoId: cursoId || null,
                    fechaDesde: fechaDesde || null,
                    fechaHasta: fechaHasta || null,
                    puntajeMin: puntajeMin || null,
                    puntajeMax: puntajeMax || null
                }
            }
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
// ADMIN: ELIMINAR INTENTOS (HARD DELETE - PURIFICACIÓN)
// =============================================
const deleteIntentos = async (req, res) => {
    try {
        const { intentoIds } = req.body

        if (!intentoIds || !Array.isArray(intentoIds) || intentoIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un array de intentoIds'
            })
        }

        // Obtener información antes de eliminar
        const infoResult = await pool.query(
            `SELECT
                i.id,
                i.usuario_id,
                u.nombre_completo,
                s.titulo as simulacro_titulo,
                (SELECT COUNT(*) FROM respuestas_usuario ru WHERE ru.intento_simulacro_id = i.id) as respuestas_count
             FROM intentos_simulacro i
             JOIN perfiles_usuario u ON i.usuario_id = u.id
             JOIN simulacros s ON i.simulacro_id = s.id
             WHERE i.id = ANY($1)`,
            [intentoIds]
        )

        if (infoResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron intentos con los IDs proporcionados'
            })
        }

        const totalRespuestas = infoResult.rows.reduce((sum, row) => sum + parseInt(row.respuestas_count), 0)

        // HARD DELETE - Eliminar intentos (CASCADE eliminará respuestas_usuario automáticamente)
        const deleteResult = await pool.query(
            `DELETE FROM intentos_simulacro
             WHERE id = ANY($1)
             RETURNING id`,
            [intentoIds]
        )

        res.json({
            success: true,
            message: `${deleteResult.rows.length} intentos eliminados exitosamente`,
            data: {
                intentos_eliminados: deleteResult.rows.length,
                respuestas_eliminadas: totalRespuestas,
                espacio_liberado_estimado_mb: (totalRespuestas * 0.5) / 1024,
                detalles: infoResult.rows.map(row => ({
                    intento_id: row.id,
                    usuario: row.nombre_completo,
                    simulacro: row.simulacro_titulo,
                    respuestas_eliminadas: parseInt(row.respuestas_count)
                })),
                advertencia: 'Esta acción es IRREVERSIBLE. Los datos han sido eliminados permanentemente.'
            }
        })

    } catch (error) {
        console.error('Error eliminando intentos:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ADMIN: OBTENER ESTADÍSTICAS DE INTENTOS POR CURSO
// =============================================
const getIntentosStats = async (req, res) => {
    try {
        const { cursoId } = req.params

        if (!cursoId) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere el ID del curso'
            })
        }

        // Estadísticas generales del curso
        const statsResult = await pool.query(
            `SELECT
                c.id as curso_id,
                c.titulo as curso_titulo,
                COUNT(DISTINCT i.id) as total_intentos,
                COUNT(DISTINCT i.usuario_id) as usuarios_unicos,
                SUM((SELECT COUNT(*) FROM respuestas_usuario ru WHERE ru.intento_simulacro_id = i.id)) as total_respuestas_almacenadas,
                AVG(i.puntaje) as puntaje_promedio,
                MIN(i.fecha_intento) as fecha_intento_mas_antiguo,
                MAX(i.fecha_intento) as fecha_intento_mas_reciente,
                COUNT(DISTINCT s.id) as simulacros_en_curso
             FROM cursos c
             LEFT JOIN simulacros s ON c.id = s.curso_id
             LEFT JOIN intentos_simulacro i ON s.id = i.simulacro_id
             WHERE c.id = $1
             GROUP BY c.id, c.titulo`,
            [cursoId]
        )

        if (statsResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        const stats = statsResult.rows[0]

        // Desglose por simulacro
        const simulacrosResult = await pool.query(
            `SELECT
                s.id as simulacro_id,
                s.titulo as simulacro_titulo,
                s.activo,
                COUNT(i.id) as intentos,
                COUNT(DISTINCT i.usuario_id) as usuarios_unicos,
                SUM((SELECT COUNT(*) FROM respuestas_usuario ru WHERE ru.intento_simulacro_id = i.id)) as respuestas_almacenadas,
                AVG(i.puntaje) as puntaje_promedio
             FROM simulacros s
             LEFT JOIN intentos_simulacro i ON s.id = i.simulacro_id
             WHERE s.curso_id = $1
             GROUP BY s.id, s.titulo, s.activo
             ORDER BY intentos DESC`,
            [cursoId]
        )

        // Desglose por fecha (últimos 12 meses)
        const timelineResult = await pool.query(
            `SELECT
                TO_CHAR(i.fecha_intento, 'YYYY-MM') as mes,
                COUNT(i.id) as intentos,
                SUM((SELECT COUNT(*) FROM respuestas_usuario ru WHERE ru.intento_simulacro_id = i.id)) as respuestas
             FROM intentos_simulacro i
             JOIN simulacros s ON i.simulacro_id = s.id
             WHERE s.curso_id = $1
               AND i.fecha_intento >= NOW() - INTERVAL '12 months'
             GROUP BY TO_CHAR(i.fecha_intento, 'YYYY-MM')
             ORDER BY mes DESC`,
            [cursoId]
        )

        const totalRespuestas = parseInt(stats.total_respuestas_almacenadas) || 0

        res.json({
            success: true,
            data: {
                curso: {
                    id: stats.curso_id,
                    titulo: stats.curso_titulo
                },
                resumen: {
                    total_intentos: parseInt(stats.total_intentos) || 0,
                    usuarios_unicos: parseInt(stats.usuarios_unicos) || 0,
                    simulacros_en_curso: parseInt(stats.simulacros_en_curso) || 0,
                    total_respuestas_almacenadas: totalRespuestas,
                    puntaje_promedio: parseFloat(stats.puntaje_promedio) || 0,
                    fecha_mas_antigua: stats.fecha_intento_mas_antiguo,
                    fecha_mas_reciente: stats.fecha_intento_mas_reciente
                },
                almacenamiento: {
                    respuestas_totales: totalRespuestas,
                    espacio_estimado_mb: parseFloat(((totalRespuestas * 0.5) / 1024).toFixed(2)),
                    espacio_estimado_gb: parseFloat(((totalRespuestas * 0.5) / 1024 / 1024).toFixed(3))
                },
                por_simulacro: simulacrosResult.rows.map(row => ({
                    simulacro_id: row.simulacro_id,
                    titulo: row.simulacro_titulo,
                    activo: row.activo,
                    intentos: parseInt(row.intentos) || 0,
                    usuarios_unicos: parseInt(row.usuarios_unicos) || 0,
                    respuestas_almacenadas: parseInt(row.respuestas_almacenadas) || 0,
                    puntaje_promedio: parseFloat(row.puntaje_promedio) || 0,
                    espacio_mb: parseFloat((((parseInt(row.respuestas_almacenadas) || 0) * 0.5) / 1024).toFixed(2))
                })),
                timeline_ultimos_12_meses: timelineResult.rows.map(row => ({
                    mes: row.mes,
                    intentos: parseInt(row.intentos),
                    respuestas: parseInt(row.respuestas)
                }))
            }
        })

    } catch (error) {
        console.error('Error obteniendo estadísticas de intentos:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ADMIN: ELIMINAR SIMULACRO (SAFE DELETE)
// =============================================
const deleteSimulacro = async (req, res) => {
    try {
        const { simulacroId } = req.params

        // Verificar que el simulacro existe
        const checkResult = await pool.query(
            `SELECT s.id, s.titulo, s.activo, c.titulo as curso_titulo,
                    (SELECT COUNT(*) FROM preguntas p WHERE p.simulacro_id = s.id) as total_preguntas,
                    (SELECT COUNT(*) FROM intentos_simulacro i WHERE i.simulacro_id = s.id) as total_intentos
             FROM simulacros s
             JOIN cursos c ON s.curso_id = c.id
             WHERE s.id = $1`,
            [simulacroId]
        )

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Simulacro no encontrado'
            })
        }

        const simulacro = checkResult.rows[0]

        // Safe delete - marcar como inactivo
        const result = await pool.query(
            `UPDATE simulacros
             SET activo = false
             WHERE id = $1
             RETURNING *`,
            [simulacroId]
        )

        res.json({
            success: true,
            message: 'Simulacro desactivado exitosamente (safe delete)',
            data: {
                simulacro: {
                    id: simulacro.id,
                    titulo: simulacro.titulo,
                    curso_titulo: simulacro.curso_titulo,
                    activo: false,
                    estado_anterior: simulacro.activo
                },
                info: {
                    preguntas_preservadas: parseInt(simulacro.total_preguntas),
                    intentos_preservados: parseInt(simulacro.total_intentos),
                    nota: 'El simulacro fue desactivado pero todos sus datos fueron preservados. Puede reactivarse en cualquier momento.'
                }
            }
        })

    } catch (error) {
        console.error('Error eliminando simulacro:', error)
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
    getAttemptDetail,
    getAllSimulacros,
    deleteSimulacro,
    getAllIntentos,
    deleteIntentos,
    getIntentosStats
}