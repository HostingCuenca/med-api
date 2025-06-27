
const pool = require('../config/database')
// =============================================
// CONFIGURACIÓN DE TIPOS DE PREGUNTA SOPORTADOS
// =============================================
const QUESTION_TYPES = {
    // Tipos básicos (100% funcionales)
    'multiple': {
        name: 'Opción Múltiple',
        description: 'Una sola respuesta correcta',
        requiresOptions: true,
        maxCorrectAnswers: 1,
        evaluation: 'automatic',
        category: 'basicos'
    },
    'true_false': {
        name: 'Verdadero/Falso',
        description: 'Dos opciones únicamente',
        requiresOptions: true,
        maxCorrectAnswers: 1,
        evaluation: 'automatic',
        fixedOptions: ['Verdadero', 'Falso'],
        category: 'basicos'
    },
    'multiple_respuesta': {
        name: 'Respuesta Múltiple',
        description: 'Múltiples respuestas correctas',
        requiresOptions: true,
        maxCorrectAnswers: -1, // ilimitado
        evaluation: 'automatic_partial',
        category: 'basicos'
    },

    // Tipos de texto (implementables con estructura actual)
    'short_answer': {
        name: 'Respuesta Corta',
        description: 'Texto libre corto',
        requiresOptions: true, // para almacenar respuestas correctas
        maxCorrectAnswers: -1, // múltiples respuestas aceptadas
        evaluation: 'text_comparison',
        category: 'texto'
    },
    'essay': {
        name: 'Ensayo',
        description: 'Texto libre largo',
        requiresOptions: false,
        maxCorrectAnswers: 0,
        evaluation: 'manual',
        category: 'texto'
    },
    'fill_blanks': {
        name: 'Completar Espacios',
        description: 'Espacios en blanco en el texto',
        requiresOptions: true,
        maxCorrectAnswers: -1,
        evaluation: 'text_parsing',
        category: 'texto'
    },

    // Tipos numéricos
    'numerical': {
        name: 'Numérica',
        description: 'Respuesta numérica con tolerancia',
        requiresOptions: true,
        maxCorrectAnswers: 1,
        evaluation: 'numerical_tolerance',
        category: 'numericos'
    },

    // Tipos interactivos (usando estructura creativa)
    'matching': {
        name: 'Emparejamiento',
        description: 'Unir conceptos con definiciones',
        requiresOptions: true,
        maxCorrectAnswers: -1,
        evaluation: 'matching_pairs',
        category: 'interactivos'
    },
    'ordering': {
        name: 'Ordenamiento',
        description: 'Ordenar elementos en secuencia',
        requiresOptions: true,
        maxCorrectAnswers: -1,
        evaluation: 'sequence_order',
        category: 'interactivos'
    }
}

const SIMULACRO_MODES = {
    'estudio': {
        name: 'Modo Estudio',
        description: 'Aprendizaje con retroalimentación inmediata',
        features: ['retroalimentacion_inmediata', 'intentos_ilimitados', 'navegacion_libre'],
        defaultConfig: {
            tipo_tiempo: 'sin_limite',
            tipo_navegacion: 'libre',
            intentos_permitidos: -1,
            mostrar_respuestas_despues: 1,
            randomizar_preguntas: false,
            randomizar_opciones: false
        }
    },
    'revision': {
        name: 'Modo Revisión',
        description: 'Práctica con revisión completa al final',
        features: ['revision_completa', 'navegacion_libre', 'marca_preguntas'],
        defaultConfig: {
            tipo_tiempo: 'global',
            tipo_navegacion: 'libre',
            intentos_permitidos: 3,
            mostrar_respuestas_despues: 1,
            randomizar_preguntas: true,
            randomizar_opciones: true
        }
    },
    'evaluacion': {
        name: 'Modo Evaluación',
        description: 'Evaluación con feedback limitado',
        features: ['feedback_parcial', 'intentos_limitados', 'tiempo_sugerido'],
        defaultConfig: {
            tipo_tiempo: 'global',
            tipo_navegacion: 'libre',
            intentos_permitidos: 2,
            mostrar_respuestas_despues: 0,
            randomizar_preguntas: true,
            randomizar_opciones: true
        }
    },
    'examen_real': {
        name: 'Modo Examen Real',
        description: 'Simulación exacta de examen oficial',
        features: ['navegacion_secuencial', 'tiempo_estricto', 'intento_unico'],
        defaultConfig: {
            tipo_tiempo: 'global',
            tipo_navegacion: 'secuencial',
            intentos_permitidos: 1,
            mostrar_respuestas_despues: 0,
            randomizar_preguntas: true,
            randomizar_opciones: true
        }
    }
}

const TIEMPO_TYPES = {
    'sin_limite': {
        name: 'Sin Límite de Tiempo',
        description: 'Usuario puede tomar el tiempo que necesite'
    },
    'global': {
        name: 'Tiempo Global',
        description: 'Tiempo total para todo el simulacro'
    },
    'por_pregunta': {
        name: 'Tiempo por Pregunta',
        description: 'Tiempo específico para cada pregunta'
    }
}

const NAVEGACION_TYPES = {
    'libre': {
        name: 'Navegación Libre',
        description: 'Puede ir hacia adelante y atrás entre preguntas'
    },
    'secuencial': {
        name: 'Navegación Secuencial',
        description: 'Solo puede avanzar, no retroceder'
    }
}

const validateSimulacroConfig = (simulacroData) => {
    const errors = []
    const {
        modoEstudio, tipoTiempo, tipoNavegacion,
        tiempoLimiteMinutos, tiempoPorPreguntaSegundos,
        numeroPreguntas, intentosPermitidos
    } = simulacroData

    // Validar modo de estudio
    if (modoEstudio && !SIMULACRO_MODES[modoEstudio]) {
        errors.push(`Modo de estudio inválido. Opciones: ${Object.keys(SIMULACRO_MODES).join(', ')}`)
    }

    // Validar tipo de tiempo
    if (tipoTiempo && !TIEMPO_TYPES[tipoTiempo]) {
        errors.push(`Tipo de tiempo inválido. Opciones: ${Object.keys(TIEMPO_TYPES).join(', ')}`)
    }

    // Validar tipo de navegación
    if (tipoNavegacion && !NAVEGACION_TYPES[tipoNavegacion]) {
        errors.push(`Tipo de navegación inválido. Opciones: ${Object.keys(NAVEGACION_TYPES).join(', ')}`)
    }

    // Validar coherencia entre configuraciones
    if (tipoTiempo === 'por_pregunta' && !tiempoPorPreguntaSegundos) {
        errors.push('Tiempo por pregunta es requerido cuando tipo_tiempo es "por_pregunta"')
    }

    if (tipoTiempo === 'global' && !tiempoLimiteMinutos) {
        errors.push('Tiempo límite es requerido cuando tipo_tiempo es "global"')
    }

    if (tipoTiempo === 'por_pregunta' && tiempoLimiteMinutos && numeroPreguntas) {
        const tiempoCalculado = Math.ceil((tiempoPorPreguntaSegundos * numeroPreguntas) / 60)
        if (Math.abs(tiempoCalculado - tiempoLimiteMinutos) > 1) {
            errors.push(`Inconsistencia en tiempos: ${tiempoPorPreguntaSegundos}s × ${numeroPreguntas} preguntas = ${tiempoCalculado}min, pero tiempo_limite es ${tiempoLimiteMinutos}min`)
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        modeConfig: SIMULACRO_MODES[modoEstudio] || null
    }
}

// =============================================
// APLICAR CONFIGURACIÓN POR DEFECTO SEGÚN MODO
// =============================================
const applyDefaultConfig = (simulacroData) => {
    const { modoEstudio } = simulacroData
    const modeConfig = SIMULACRO_MODES[modoEstudio]

    if (!modeConfig) return simulacroData

    // Aplicar valores por defecto del modo
    const defaultConfig = modeConfig.defaultConfig

    return {
        ...simulacroData,
        // Solo aplicar defaults si no están definidos
        tipoTiempo: simulacroData.tipoTiempo || defaultConfig.tipo_tiempo,
        tipoNavegacion: simulacroData.tipoNavegacion || defaultConfig.tipo_navegacion,
        intentosPermitidos: simulacroData.intentosPermitidos !== undefined ? simulacroData.intentosPermitidos : defaultConfig.intentos_permitidos,
        mostrarRespuestasDespues: simulacroData.mostrarRespuestasDespues !== undefined ? simulacroData.mostrarRespuestasDespues : defaultConfig.mostrar_respuestas_despues,
        randomizarPreguntas: simulacroData.randomizarPreguntas !== undefined ? simulacroData.randomizarPreguntas : defaultConfig.randomizar_preguntas,
        randomizarOpciones: simulacroData.randomizarOpciones !== undefined ? simulacroData.randomizarOpciones : defaultConfig.randomizar_opciones
    }
}

// =============================================
// SERVICIO DE EVALUACIÓN MODULAR
// =============================================
class QuestionEvaluationService {
    static async evaluateAnswer(pregunta, respuestaUsuario, opcionesRespuesta) {
        const tipoConfig = QUESTION_TYPES[pregunta.tipo_pregunta]

        if (!tipoConfig) {
            throw new Error(`Tipo de pregunta no soportado: ${pregunta.tipo_pregunta}`)
        }

        switch (tipoConfig.evaluation) {
            case 'automatic':
                return this.evaluateAutomatic(pregunta, respuestaUsuario, opcionesRespuesta)
            case 'automatic_partial':
                return this.evaluateAutomaticPartial(pregunta, respuestaUsuario, opcionesRespuesta)
            case 'text_comparison':
                return this.evaluateTextComparison(pregunta, respuestaUsuario, opcionesRespuesta)
            case 'numerical_tolerance':
                return this.evaluateNumerical(pregunta, respuestaUsuario, opcionesRespuesta)
            case 'matching_pairs':
                return this.evaluateMatching(pregunta, respuestaUsuario, opcionesRespuesta)
            case 'sequence_order':
                return this.evaluateOrdering(pregunta, respuestaUsuario, opcionesRespuesta)
            case 'text_parsing':
                return this.evaluateFillBlanks(pregunta, respuestaUsuario, opcionesRespuesta)
            case 'manual':
                return this.evaluateManual(pregunta, respuestaUsuario)
            default:
                return { esCorrecta: false, puntaje: 0, feedback: 'Tipo de evaluación no implementado' }
        }
    }

    // Evaluación automática estándar (multiple choice)
    static evaluateAutomatic(pregunta, respuestaUsuario, opcionesRespuesta) {
        const opcionCorrecta = opcionesRespuesta.find(op => op.es_correcta)
        const esCorrecta = respuestaUsuario.opcion_seleccionada_id === opcionCorrecta?.id

        return {
            esCorrecta,
            puntaje: esCorrecta ? 1.0 : 0.0,
            feedback: esCorrecta ? 'Respuesta correcta' : `La respuesta correcta era: ${opcionCorrecta?.texto_opcion}`,
            opcionCorrecta: opcionCorrecta?.texto_opcion
        }
    }

    // Evaluación parcial (multiple response)
    static evaluateAutomaticPartial(pregunta, respuestaUsuario, opcionesRespuesta) {
        const opcionSeleccionada = opcionesRespuesta.find(op => op.id === respuestaUsuario.opcion_seleccionada_id)
        const esCorrecta = opcionSeleccionada?.es_correcta || false

        const totalCorrectas = opcionesRespuesta.filter(op => op.es_correcta).length
        const puntajeParcial = esCorrecta ? (1.0 / totalCorrectas) : 0.0

        return {
            esCorrecta,
            puntaje: puntajeParcial,
            feedback: esCorrecta ? 'Respuesta parcialmente correcta' : 'Respuesta incorrecta',
            totalCorrectas
        }
    }

    // Evaluación de texto (short answer)
    static evaluateTextComparison(pregunta, respuestaUsuario, opcionesRespuesta) {
        const respuestaTexto = respuestaUsuario.respuesta_texto?.trim().toLowerCase()
        const respuestasCorrectas = opcionesRespuesta
            .filter(op => op.es_correcta)
            .map(op => op.texto_opcion.trim().toLowerCase())

        const esCorrecta = respuestasCorrectas.some(correcta =>
            respuestaTexto === correcta ||
            respuestaTexto.includes(correcta) ||
            correcta.includes(respuestaTexto)
        )

        return {
            esCorrecta,
            puntaje: esCorrecta ? 1.0 : 0.0,
            feedback: esCorrecta ? 'Respuesta correcta' : `Respuestas aceptadas: ${respuestasCorrectas.join(', ')}`,
            respuestasCorrectas
        }
    }

    // Evaluación numérica
    static evaluateNumerical(pregunta, respuestaUsuario, opcionesRespuesta) {
        const respuestaNum = parseFloat(respuestaUsuario.respuesta_texto)
        if (isNaN(respuestaNum)) {
            return { esCorrecta: false, puntaje: 0.0, feedback: 'Respuesta debe ser un número' }
        }

        const opcionCorrecta = opcionesRespuesta.find(op => op.es_correcta)
        const valorCorrecto = parseFloat(opcionCorrecta?.texto_opcion)
        const tolerancia = 0.01 // 1% de tolerancia por defecto

        const esCorrecta = Math.abs(respuestaNum - valorCorrecto) <= (valorCorrecto * tolerancia)

        return {
            esCorrecta,
            puntaje: esCorrecta ? 1.0 : 0.0,
            feedback: esCorrecta ? 'Respuesta correcta' : `La respuesta correcta era: ${valorCorrecto}`,
            valorCorrecto,
            tolerancia
        }
    }

    // Evaluación manual (essay)
    static evaluateManual(pregunta, respuestaUsuario) {
        return {
            esCorrecta: null, // requiere evaluación manual
            puntaje: null,
            feedback: 'Esta respuesta requiere evaluación manual por el instructor',
            requiresManualGrading: true
        }
    }

    // Placeholder para tipos complejos
    static evaluateMatching(pregunta, respuestaUsuario, opcionesRespuesta) {
        return { esCorrecta: false, puntaje: 0.0, feedback: 'Evaluación de emparejamiento no implementada aún' }
    }

    static evaluateOrdering(pregunta, respuestaUsuario, opcionesRespuesta) {
        return { esCorrecta: false, puntaje: 0.0, feedback: 'Evaluación de ordenamiento no implementada aún' }
    }

    static evaluateFillBlanks(pregunta, respuestaUsuario, opcionesRespuesta) {
        return { esCorrecta: false, puntaje: 0.0, feedback: 'Evaluación de espacios en blanco no implementada aún' }
    }
}

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
// UTILIDADES DE VALIDACIÓN
// =============================================
const validateQuestionType = (tipoPregunta) => {
    if (!QUESTION_TYPES[tipoPregunta]) {
        const tiposValidos = Object.keys(QUESTION_TYPES)
        throw new Error(`Tipo de pregunta inválido: ${tipoPregunta}. Tipos válidos: ${tiposValidos.join(', ')}`)
    }
    return QUESTION_TYPES[tipoPregunta]
}

const validateQuestionData = (questionData) => {
    const { enunciado, tipoPregunta, opciones = [] } = questionData
    const errors = []

    // Validar enunciado
    if (!enunciado?.trim()) {
        errors.push('El enunciado es requerido')
    }

    // Validar tipo
    let tipoConfig
    try {
        tipoConfig = validateQuestionType(tipoPregunta)
    } catch (error) {
        errors.push(error.message)
        return { isValid: false, errors }
    }

    // Validar opciones según el tipo
    if (tipoConfig.requiresOptions && opciones.length < 1) {
        errors.push(`El tipo ${tipoConfig.name} requiere al menos una opción`)
    }

    // Validar respuestas correctas
    const respuestasCorrectas = opciones.filter(op => op.esCorrecta)
    if (tipoConfig.maxCorrectAnswers === 1 && respuestasCorrectas.length !== 1) {
        errors.push(`El tipo ${tipoConfig.name} debe tener exactamente una respuesta correcta`)
    } else if (tipoConfig.maxCorrectAnswers > 0 && respuestasCorrectas.length > tipoConfig.maxCorrectAnswers) {
        errors.push(`El tipo ${tipoConfig.name} no puede tener más de ${tipoConfig.maxCorrectAnswers} respuestas correctas`)
    } else if (tipoConfig.requiresOptions && respuestasCorrectas.length === 0 && tipoConfig.evaluation !== 'manual') {
        errors.push(`El tipo ${tipoConfig.name} debe tener al menos una respuesta correcta`)
    }

    // Validaciones específicas por tipo
    if (tipoPregunta === 'true_false' && opciones.length !== 2) {
        errors.push('Las preguntas Verdadero/Falso deben tener exactamente 2 opciones')
    }

    return {
        isValid: errors.length === 0,
        errors,
        config: tipoConfig
    }
}

// =============================================
// OBTENER CONTENIDO DEL CURSO PARA EDICIÓN
// =============================================
const getCourseContent = async (req, res) => {
    try {
        const { cursoId } = req.params

        console.log('📚 Obteniendo contenido del curso:', cursoId)

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

        // Obtener simulacros con estadísticas
        const simulacrosResult = await pool.query(
            `SELECT s.*,
            (SELECT COUNT(*) FROM preguntas p WHERE p.simulacro_id = s.id) as total_preguntas,
            (SELECT COUNT(DISTINCT p.tipo_pregunta) FROM preguntas p WHERE p.simulacro_id = s.id) as tipos_pregunta_usados
            FROM simulacros s 
            WHERE s.curso_id = $1 AND s.activo = true 
            ORDER BY s.fecha_creacion`,
            [cursoId]
        )

        console.log('✅ Contenido del curso obtenido exitosamente')

        res.json({
            success: true,
            data: {
                curso: cursoResult.rows[0],
                modulos: modulosResult.rows,
                simulacros: simulacrosResult.rows,
                estadisticas: {
                    total_modulos: modulosResult.rows.length,
                    total_clases: modulosResult.rows.reduce((acc, mod) => acc + (mod.clases?.length || 0), 0),
                    total_simulacros: simulacrosResult.rows.length,
                    total_preguntas: simulacrosResult.rows.reduce((acc, sim) => acc + parseInt(sim.total_preguntas || 0), 0)
                },
                tipos_pregunta_disponibles: QUESTION_TYPES
            }
        })

    } catch (error) {
        console.error('❌ Error obteniendo contenido del curso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
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

        console.log('➕ Creando módulo:', { cursoId, titulo, orden })

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

        console.log('✅ Módulo creado exitosamente:', result.rows[0].id)

        res.status(201).json({
            success: true,
            message: 'Módulo creado exitosamente',
            data: { modulo: result.rows[0] }
        })

    } catch (error) {
        console.error('❌ Error creando módulo:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ACTUALIZAR MÓDULO
// =============================================
const updateModule = async (req, res) => {
    try {
        const { id } = req.params
        const { titulo, descripcion, orden } = req.body

        console.log('✏️ Actualizando módulo:', id)

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

        console.log('✅ Módulo actualizado exitosamente')

        res.json({
            success: true,
            message: 'Módulo actualizado exitosamente',
            data: { modulo: result.rows[0] }
        })

    } catch (error) {
        console.error('❌ Error actualizando módulo:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ELIMINAR MÓDULO
// =============================================
const deleteModule = async (req, res) => {
    try {
        const { id } = req.params

        console.log('🗑️ Eliminando módulo:', id)

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

        console.log('✅ Módulo eliminado exitosamente')

        res.json({
            success: true,
            message: 'Módulo eliminado exitosamente'
        })

    } catch (error) {
        console.error('❌ Error eliminando módulo:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// REORDENAR MÓDULOS
// =============================================
const reorderModules = async (req, res) => {
    try {
        const { cursoId, moduleOrders } = req.body

        console.log('🔄 Reordenando módulos:', { cursoId, count: moduleOrders?.length })

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

        console.log('✅ Módulos reordenados exitosamente')

        res.json({
            success: true,
            message: 'Módulos reordenados exitosamente'
        })

    } catch (error) {
        console.error('❌ Error reordenando módulos:', error)
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

        console.log('➕ Creando clase:', { moduloId, titulo, orden })

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

        console.log('✅ Clase creada exitosamente:', result.rows[0].id)

        res.status(201).json({
            success: true,
            message: 'Clase creada exitosamente',
            data: { clase: result.rows[0] }
        })

    } catch (error) {
        console.error('❌ Error creando clase:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ACTUALIZAR CLASE
// =============================================
const updateClass = async (req, res) => {
    try {
        const { id } = req.params
        const { titulo, descripcion, videoYoutubeUrl, duracionMinutos, esGratuita, orden } = req.body

        console.log('✏️ Actualizando clase:', id)

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

        console.log('✅ Clase actualizada exitosamente')

        res.json({
            success: true,
            message: 'Clase actualizada exitosamente',
            data: { clase: result.rows[0] }
        })

    } catch (error) {
        console.error('❌ Error actualizando clase:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// ELIMINAR CLASE
// =============================================
const deleteClass = async (req, res) => {
    try {
        const { id } = req.params

        console.log('🗑️ Eliminando clase:', id)

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

        console.log('✅ Clase eliminada exitosamente')

        res.json({
            success: true,
            message: 'Clase eliminada exitosamente'
        })

    } catch (error) {
        console.error('❌ Error eliminando clase:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// REORDENAR CLASES
// =============================================
const reorderClasses = async (req, res) => {
    try {
        const { moduloId, classOrders } = req.body

        console.log('🔄 Reordenando clases:', { moduloId, count: classOrders?.length })

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

        console.log('✅ Clases reordenadas exitosamente')

        res.json({
            success: true,
            message: 'Clases reordenadas exitosamente'
        })

    } catch (error) {
        console.error('❌ Error reordenando clases:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// ==================== GESTIÓN DE SIMULACROS ====================

// const createSimulacro = async (req, res) => {
//     try {
//         const {
//             cursoId, titulo, descripcion, modoEvaluacion,
//             tiempoLimiteMinutos, tiempoPorPreguntaSegundos,
//             numeroPreguntas, intentosPermitidos = -1,
//             randomizarPreguntas = true, randomizarOpciones = true,
//             mostrarRespuestasDespues = 1
//         } = req.body
//
//         console.log('➕ Creando simulacro:', { cursoId, titulo, modoEvaluacion })
//
//         if (!cursoId || !titulo || !modoEvaluacion || !numeroPreguntas) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Campos requeridos: cursoId, titulo, modoEvaluacion, numeroPreguntas'
//             })
//         }
//
//         if (!['practica', 'realista', 'examen'].includes(modoEvaluacion)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Modo de evaluación inválido. Opciones: practica, realista, examen'
//             })
//         }
//
//         // Verificar permisos
//         const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)
//         if (!hasPermission) {
//             return res.status(403).json({
//                 success: false,
//                 message: 'No tienes permisos para modificar este curso'
//             })
//         }
//
//         const result = await pool.query(
//             `INSERT INTO simulacros
//              (curso_id, titulo, descripcion, modo_evaluacion, tiempo_limite_minutos,
//               tiempo_por_pregunta_segundos, numero_preguntas, intentos_permitidos,
//               randomizar_preguntas, randomizar_opciones, mostrar_respuestas_despues)
//              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
//             [cursoId, titulo, descripcion, modoEvaluacion, tiempoLimiteMinutos,
//                 tiempoPorPreguntaSegundos, numeroPreguntas, intentosPermitidos,
//                 randomizarPreguntas, randomizarOpciones, mostrarRespuestasDespues]
//         )
//
//         console.log('✅ Simulacro creado exitosamente:', result.rows[0].id)
//
//         res.status(201).json({
//             success: true,
//             message: 'Simulacro creado exitosamente',
//             data: { simulacro: result.rows[0] }
//         })
//
//     } catch (error) {
//         console.error('❌ Error creando simulacro:', error)
//         res.status(500).json({
//             success: false,
//             message: 'Error interno del servidor'
//         })
//     }
// }

const createSimulacro = async (req, res) => {
    try {
        const {
            cursoId, titulo, descripcion,
            modoEvaluacion = 'practica', // Mantener compatibilidad
            modoEstudio = 'estudio',     // NUEVO
            tipoTiempo = 'sin_limite',   // NUEVO
            tipoNavegacion = 'libre',    // NUEVO
            tiempoLimiteMinutos,
            tiempoPorPreguntaSegundos,
            numeroPreguntas,
            intentosPermitidos = -1,
            randomizarPreguntas = true,
            randomizarOpciones = true,
            mostrarRespuestasDespues = 1,
            configuracionAvanzada = {}   // NUEVO
        } = req.body

        console.log('➕ Creando simulacro avanzado:', {
            cursoId, titulo, modoEstudio, tipoTiempo, tipoNavegacion
        })

        // Validar campos requeridos
        if (!cursoId || !titulo || !numeroPreguntas) {
            return res.status(400).json({
                success: false,
                message: 'Campos requeridos: cursoId, titulo, numeroPreguntas'
            })
        }

        // Aplicar configuración por defecto según modo
        const simulacroData = applyDefaultConfig({
            modoEstudio, tipoTiempo, tipoNavegacion,
            tiempoLimiteMinutos, tiempoPorPreguntaSegundos,
            numeroPreguntas, intentosPermitidos,
            randomizarPreguntas, randomizarOpciones, mostrarRespuestasDespues
        })

        // Validar configuración
        const validation = validateSimulacroConfig(simulacroData)
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Configuración de simulacro inválida',
                errors: validation.errors
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

        // Calcular tiempo automáticamente si es necesario
        let tiempoLimiteFinal = simulacroData.tiempoLimiteMinutos
        let tiempoPorPreguntaFinal = simulacroData.tiempoPorPreguntaSegundos

        if (simulacroData.tipoTiempo === 'por_pregunta' && tiempoPorPreguntaFinal && !tiempoLimiteFinal) {
            tiempoLimiteFinal = Math.ceil((tiempoPorPreguntaFinal * numeroPreguntas) / 60)
        } else if (simulacroData.tipoTiempo === 'global' && tiempoLimiteFinal && !tiempoPorPreguntaFinal) {
            tiempoPorPreguntaFinal = Math.floor((tiempoLimiteFinal * 60) / numeroPreguntas)
        }

        // Crear configuración avanzada
        const configAvanzada = {
            ...configuracionAvanzada,
            modo_config: validation.modeConfig,
            tiempo_calculado_automaticamente: tiempoLimiteFinal !== simulacroData.tiempoLimiteMinutos || tiempoPorPreguntaFinal !== simulacroData.tiempoPorPreguntaSegundos,
            fecha_creacion_config: new Date().toISOString()
        }

        // Insertar en base de datos
        const result = await pool.query(
            `INSERT INTO simulacros 
             (curso_id, titulo, descripcion, modo_evaluacion, 
              modo_estudio, tipo_tiempo, tipo_navegacion,
              tiempo_limite_minutos, tiempo_por_pregunta_segundos, 
              numero_preguntas, intentos_permitidos,
              randomizar_preguntas, randomizar_opciones, mostrar_respuestas_despues,
              configuracion_avanzada) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
             RETURNING *`,
            [
                cursoId, titulo, descripcion, modoEvaluacion,
                simulacroData.modoEstudio, simulacroData.tipoTiempo, simulacroData.tipoNavegacion,
                tiempoLimiteFinal, tiempoPorPreguntaFinal,
                numeroPreguntas, simulacroData.intentosPermitidos,
                simulacroData.randomizarPreguntas, simulacroData.randomizarOpciones,
                simulacroData.mostrarRespuestasDespues,
                JSON.stringify(configAvanzada)
            ]
        )

        const simulacroCreado = result.rows[0]

        console.log('✅ Simulacro creado exitosamente:', simulacroCreado.id)

        res.status(201).json({
            success: true,
            message: `Simulacro "${validation.modeConfig?.name || 'Personalizado'}" creado exitosamente`,
            data: {
                simulacro: simulacroCreado,
                configuracion: {
                    modo: validation.modeConfig,
                    tiempo_tipo: TIEMPO_TYPES[simulacroData.tipoTiempo],
                    navegacion_tipo: NAVEGACION_TYPES[simulacroData.tipoNavegacion],
                    tiempo_total_estimado: tiempoLimiteFinal,
                    tiempo_por_pregunta_calculado: tiempoPorPreguntaFinal
                }
            }
        })

    } catch (error) {
        console.error('❌ Error creando simulacro:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}

const updateSimulacro = async (req, res) => {
    try {
        const { id } = req.params
        const {
            titulo, descripcion,
            modoEvaluacion,
            modoEstudio,           // NUEVO
            tipoTiempo,           // NUEVO
            tipoNavegacion,       // NUEVO
            tiempoLimiteMinutos,
            tiempoPorPreguntaSegundos,
            numeroPreguntas,
            intentosPermitidos,
            randomizarPreguntas,
            randomizarOpciones,
            mostrarRespuestasDespues,
            configuracionAvanzada  // NUEVO
        } = req.body

        console.log('✏️ Actualizando simulacro:', id, { modoEstudio, tipoTiempo, tipoNavegacion })

        // Verificar permisos
        const simulacroCheck = await pool.query(
            `SELECT curso_id, configuracion_avanzada FROM simulacros WHERE id = $1`,
            [id]
        )

        if (simulacroCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Simulacro no encontrado'
            })
        }

        const cursoId = simulacroCheck.rows[0].curso_id
        const configActual = simulacroCheck.rows[0].configuracion_avanzada || {}

        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para modificar este simulacro'
            })
        }

        // Preparar datos para validación (solo campos que se van a actualizar)
        const updateData = {}
        if (modoEstudio !== undefined) updateData.modoEstudio = modoEstudio
        if (tipoTiempo !== undefined) updateData.tipoTiempo = tipoTiempo
        if (tipoNavegacion !== undefined) updateData.tipoNavegacion = tipoNavegacion
        if (tiempoLimiteMinutos !== undefined) updateData.tiempoLimiteMinutos = tiempoLimiteMinutos
        if (tiempoPorPreguntaSegundos !== undefined) updateData.tiempoPorPreguntaSegundos = tiempoPorPreguntaSegundos
        if (numeroPreguntas !== undefined) updateData.numeroPreguntas = numeroPreguntas
        if (intentosPermitidos !== undefined) updateData.intentosPermitidos = intentosPermitidos

        // Validar si hay cambios de configuración críticos
        if (Object.keys(updateData).length > 0) {
            const validation = validateSimulacroConfig(updateData)
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Configuración de simulacro inválida',
                    errors: validation.errors
                })
            }
        }

        // Calcular tiempos automáticamente si es necesario
        let tiempoLimiteFinal = tiempoLimiteMinutos
        let tiempoPorPreguntaFinal = tiempoPorPreguntaSegundos

        if (tipoTiempo === 'por_pregunta' && tiempoPorPreguntaFinal && numeroPreguntas && !tiempoLimiteFinal) {
            tiempoLimiteFinal = Math.ceil((tiempoPorPreguntaFinal * numeroPreguntas) / 60)
        } else if (tipoTiempo === 'global' && tiempoLimiteFinal && numeroPreguntas && !tiempoPorPreguntaFinal) {
            tiempoPorPreguntaFinal = Math.floor((tiempoLimiteFinal * 60) / numeroPreguntas)
        }

        // Actualizar configuración avanzada
        const configActualizada = {
            ...configActual,
            ...configuracionAvanzada,
            ultima_modificacion: new Date().toISOString(),
            modificado_por: req.user.id
        }

        // Construir query de actualización dinámicamente
        const updateFields = []
        const updateValues = []
        let paramCount = 0

        const addField = (field, value) => {
            if (value !== undefined) {
                paramCount++
                updateFields.push(`${field} = $${paramCount}`)
                updateValues.push(value)
            }
        }

        addField('titulo', titulo)
        addField('descripcion', descripcion)
        addField('modo_evaluacion', modoEvaluacion)
        addField('modo_estudio', modoEstudio)
        addField('tipo_tiempo', tipoTiempo)
        addField('tipo_navegacion', tipoNavegacion)
        addField('tiempo_limite_minutos', tiempoLimiteFinal)
        addField('tiempo_por_pregunta_segundos', tiempoPorPreguntaFinal)
        addField('numero_preguntas', numeroPreguntas)
        addField('intentos_permitidos', intentosPermitidos)
        addField('randomizar_preguntas', randomizarPreguntas)
        addField('randomizar_opciones', randomizarOpciones)
        addField('mostrar_respuestas_despues', mostrarRespuestasDespues)
        addField('configuracion_avanzada', JSON.stringify(configActualizada))

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay campos para actualizar'
            })
        }

        // Ejecutar actualización
        const result = await pool.query(
            `UPDATE simulacros SET ${updateFields.join(', ')} WHERE id = $${paramCount + 1} RETURNING *`,
            [...updateValues, id]
        )

        const simulacroActualizado = result.rows[0]

        console.log('✅ Simulacro actualizado exitosamente')

        res.json({
            success: true,
            message: 'Simulacro actualizado exitosamente',
            data: {
                simulacro: simulacroActualizado,
                cambios_aplicados: updateFields.map(field => field.split(' = ')[0]),
                configuracion: {
                    modo: modoEstudio ? SIMULACRO_MODES[modoEstudio] : undefined,
                    tiempo_tipo: tipoTiempo ? TIEMPO_TYPES[tipoTiempo] : undefined,
                    navegacion_tipo: tipoNavegacion ? NAVEGACION_TYPES[tipoNavegacion] : undefined
                }
            }
        })

    } catch (error) {
        console.error('❌ Error actualizando simulacro:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}
// const updateSimulacro = async (req, res) => {
//     try {
//         const { id } = req.params
//         const {
//             titulo, descripcion, modoEvaluacion, tiempoLimiteMinutos,
//             tiempoPorPreguntaSegundos, numeroPreguntas, intentosPermitidos,
//             randomizarPreguntas, randomizarOpciones, mostrarRespuestasDespues
//         } = req.body
//
//         console.log('✏️ Actualizando simulacro:', id)
//
//         // Verificar permisos
//         const simulacroCheck = await pool.query(
//             `SELECT curso_id FROM simulacros WHERE id = $1`,
//             [id]
//         )
//
//         if (simulacroCheck.rows.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Simulacro no encontrado'
//             })
//         }
//
//         const cursoId = simulacroCheck.rows[0].curso_id
//         const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)
//
//         if (!hasPermission) {
//             return res.status(403).json({
//                 success: false,
//                 message: 'No tienes permisos para modificar este simulacro'
//             })
//         }
//
//         const result = await pool.query(
//             `UPDATE simulacros
//              SET titulo = $1, descripcion = $2, modo_evaluacion = $3,
//                  tiempo_limite_minutos = $4, tiempo_por_pregunta_segundos = $5,
//                  numero_preguntas = $6, intentos_permitidos = $7,
//                  randomizar_preguntas = $8, randomizar_opciones = $9,
//                  mostrar_respuestas_despues = $10
//              WHERE id = $11 RETURNING *`,
//             [titulo, descripcion, modoEvaluacion, tiempoLimiteMinutos,
//                 tiempoPorPreguntaSegundos, numeroPreguntas, intentosPermitidos,
//                 randomizarPreguntas, randomizarOpciones, mostrarRespuestasDespues, id]
//         )
//
//         console.log('✅ Simulacro actualizado exitosamente')
//
//         res.json({
//             success: true,
//             message: 'Simulacro actualizado exitosamente',
//             data: { simulacro: result.rows[0] }
//         })
//
//     } catch (error) {
//         console.error('❌ Error actualizando simulacro:', error)
//         res.status(500).json({
//             success: false,
//             message: 'Error interno del servidor'
//         })
//     }
// }

// =============================================
// ELIMINAR SIMULACRO
// =============================================
const deleteSimulacro = async (req, res) => {
    try {
        const { id } = req.params

        console.log('🗑️ Eliminando simulacro:', id)

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

        console.log('✅ Simulacro eliminado exitosamente')

        res.json({
            success: true,
            message: 'Simulacro eliminado exitosamente'
        })

    } catch (error) {
        console.error('❌ Error eliminando simulacro:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// OBTENER SIMULACRO CON PREGUNTAS - MEJORADO
// =============================================
const getSimulacroWithQuestions = async (req, res) => {
    try {
        const { id } = req.params

        console.log('🧪 Obteniendo simulacro con preguntas:', id)

        // Verificar permisos
        const simulacroCheck = await pool.query(
            `SELECT s.*, c.titulo as curso_titulo, c.instructor_id 
             FROM simulacros s 
             JOIN cursos c ON s.curso_id = c.id 
             WHERE s.id = $1`,
            [id]
        )

        if (simulacroCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Simulacro no encontrado'
            })
        }

        const simulacro = simulacroCheck.rows[0]
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, simulacro.curso_id)

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver este simulacro'
            })
        }

        // Obtener preguntas con opciones y estadísticas
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
             ) as opciones,
             (SELECT COUNT(*) FROM respuestas_usuario ru WHERE ru.pregunta_id = p.id) as veces_respondida,
             (SELECT COUNT(*) FROM respuestas_usuario ru WHERE ru.pregunta_id = p.id AND ru.es_correcta = true) as veces_correcta
             FROM preguntas p
             LEFT JOIN opciones_respuesta o ON p.id = o.pregunta_id
             WHERE p.simulacro_id = $1
             GROUP BY p.id
             ORDER BY p.fecha_creacion`,
            [id]
        )

        // Estadísticas por tipo de pregunta
        const estadisticasTipos = {}
        preguntasResult.rows.forEach(pregunta => {
            const tipo = pregunta.tipo_pregunta
            if (!estadisticasTipos[tipo]) {
                estadisticasTipos[tipo] = {
                    cantidad: 0,
                    config: QUESTION_TYPES[tipo] || { name: tipo, description: 'Tipo personalizado' }
                }
            }
            estadisticasTipos[tipo].cantidad++
        })

        console.log('✅ Simulacro obtenido exitosamente')

        res.json({
            success: true,
            data: {
                simulacro,
                preguntas: preguntasResult.rows,
                estadisticas: {
                    total_preguntas: preguntasResult.rows.length,
                    meta_preguntas: simulacro.numero_preguntas,
                    completado: preguntasResult.rows.length >= simulacro.numero_preguntas,
                    tipos_usados: estadisticasTipos,
                    promedio_dificultad: preguntasResult.rows.length > 0
                        ? preguntasResult.rows.reduce((acc, p) => acc + (p.veces_respondida > 0 ? (p.veces_correcta / p.veces_respondida) : 0.5), 0) / preguntasResult.rows.length
                        : 0
                },
                tipos_disponibles: QUESTION_TYPES
            }
        })

    } catch (error) {
        console.error('❌ Error obteniendo simulacro:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}

const getSimulacroConfigurations = async (req, res) => {
    try {
        console.log('📋 Obteniendo configuraciones de simulacro disponibles')

        res.json({
            success: true,
            data: {
                modos_estudio: SIMULACRO_MODES,
                tipos_tiempo: TIEMPO_TYPES,
                tipos_navegacion: NAVEGACION_TYPES,
                ejemplos: {
                    medicina_eunacom: {
                        modoEstudio: 'examen_real',
                        tipoTiempo: 'global',
                        tipoNavegacion: 'libre',
                        tiempoLimiteMinutos: 180,
                        numeroPreguntas: 120,
                        intentosPermitidos: 1
                    },
                    practica_basica: {
                        modoEstudio: 'estudio',
                        tipoTiempo: 'sin_limite',
                        tipoNavegacion: 'libre',
                        intentosPermitidos: -1
                    },
                    evaluacion_intermedia: {
                        modoEstudio: 'revision',
                        tipoTiempo: 'global',
                        tipoNavegacion: 'libre',
                        tiempoLimiteMinutos: 45,
                        numeroPreguntas: 30,
                        intentosPermitidos: 3
                    }
                }
            }
        })
    } catch (error) {
        console.error('❌ Error obteniendo configuraciones:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}


// ==================== GESTIÓN DE PREGUNTAS ====================

// =============================================
// CREAR PREGUNTA CON OPCIONES - MEJORADO
// =============================================
const createQuestion = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const { simulacroId, enunciado, tipoPregunta, explicacion, imagenUrl, opciones = [] } = req.body

        console.log('➕ Creando pregunta:', { tipoPregunta, simulacroId, opcionesCount: opciones.length })

        // Validar datos de la pregunta
        const validation = validateQuestionData({ enunciado, tipoPregunta, explicacion, imagenUrl, opciones })
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Datos de pregunta inválidos',
                errors: validation.errors
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

        console.log('✅ Pregunta creada exitosamente:', preguntaId)

        res.status(201).json({
            success: true,
            message: `Pregunta de tipo "${validation.config.name}" creada exitosamente`,
            data: {
                pregunta: preguntaResult.rows[0],
                opciones: opcionesCreadas,
                tipo_config: validation.config
            }
        })

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('❌ Error creando pregunta:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    } finally {
        client.release()
    }
}

// =============================================
// ACTUALIZAR PREGUNTA
// =============================================
const updateQuestion = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const { id } = req.params
        const { enunciado, tipoPregunta, explicacion, imagenUrl, opciones } = req.body

        console.log('✏️ Actualizando pregunta:', id)

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

            console.log('✅ Pregunta actualizada exitosamente')

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

            console.log('✅ Pregunta actualizada exitosamente')

            res.json({
                success: true,
                message: 'Pregunta actualizada exitosamente',
                data: { pregunta: preguntaResult.rows[0] }
            })
        }

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('❌ Error actualizando pregunta:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    } finally {
        client.release()
    }
}

// =============================================
// ELIMINAR PREGUNTA
// =============================================
const deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params

        console.log('🗑️ Eliminando pregunta:', id)

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

        console.log('✅ Pregunta eliminada exitosamente')

        res.json({
            success: true,
            message: 'Pregunta eliminada exitosamente'
        })

    } catch (error) {
        console.error('❌ Error eliminando pregunta:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CREAR MÚLTIPLES PREGUNTAS - MEJORADO
// =============================================
const createMultipleQuestions = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const { simulacroId, questions } = req.body

        console.log('📚 Creando múltiples preguntas:', { simulacroId, count: questions?.length })

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
        const errores = []

        for (let i = 0; i < questions.length; i++) {
            const questionData = questions[i]
            const { enunciado, tipoPregunta, explicacion, imagenUrl, opciones } = questionData

            try {
                // Validar cada pregunta
                const validation = validateQuestionData(questionData)
                if (!validation.isValid) {
                    errores.push(`Pregunta ${i + 1}: ${validation.errors.join(', ')}`)
                    continue
                }

                // Crear pregunta
                const preguntaResult = await client.query(
                    'INSERT INTO preguntas (simulacro_id, enunciado, tipo_pregunta, explicacion, imagen_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                    [simulacroId, enunciado, tipoPregunta, explicacion, imagenUrl]
                )

                const preguntaId = preguntaResult.rows[0].id

                // Crear opciones
                const opcionesCreadas = []
                for (let j = 0; j < opciones.length; j++) {
                    const { textoOpcion, esCorrecta } = opciones[j]

                    const opcionResult = await client.query(
                        'INSERT INTO opciones_respuesta (pregunta_id, texto_opcion, es_correcta, orden) VALUES ($1, $2, $3, $4) RETURNING *',
                        [preguntaId, textoOpcion.trim(), esCorrecta === true, j + 1]
                    )
                    opcionesCreadas.push(opcionResult.rows[0])
                }

                preguntasCreadas.push({
                    pregunta: preguntaResult.rows[0],
                    opciones: opcionesCreadas
                })

            } catch (error) {
                errores.push(`Pregunta ${i + 1}: ${error.message}`)
            }
        }

        if (preguntasCreadas.length === 0) {
            await client.query('ROLLBACK')
            return res.status(400).json({
                success: false,
                message: 'No se pudieron crear preguntas',
                errors: errores
            })
        }

        await client.query('COMMIT')

        console.log('✅ Preguntas múltiples creadas:', preguntasCreadas.length)

        res.status(201).json({
            success: true,
            message: `${preguntasCreadas.length} preguntas creadas exitosamente`,
            data: {
                preguntas: preguntasCreadas,
                errores: errores.length > 0 ? errores : undefined
            },
            estadisticas: {
                exitosas: preguntasCreadas.length,
                fallidas: errores.length,
                total_intentadas: questions.length
            }
        })

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('❌ Error creando múltiples preguntas:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    } finally {
        client.release()
    }
}

const getQuestionTypes = async (req, res) => {
    try {
        console.log('📋 Obteniendo tipos de pregunta disponibles')

        res.json({
            success: true,
            data: {
                tipos: QUESTION_TYPES,
                implementados: Object.keys(QUESTION_TYPES).length,
                categorias: {
                    basicos: Object.entries(QUESTION_TYPES).filter(([k, v]) => v.category === 'basicos').map(([k, v]) => ({ key: k, ...v })),
                    texto: Object.entries(QUESTION_TYPES).filter(([k, v]) => v.category === 'texto').map(([k, v]) => ({ key: k, ...v })),
                    numericos: Object.entries(QUESTION_TYPES).filter(([k, v]) => v.category === 'numericos').map(([k, v]) => ({ key: k, ...v })),
                    interactivos: Object.entries(QUESTION_TYPES).filter(([k, v]) => v.category === 'interactivos').map(([k, v]) => ({ key: k, ...v }))
                }
            }
        })
    } catch (error) {
        console.error('❌ Error obteniendo tipos de pregunta:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// VALIDAR URL DE YOUTUBE
// =============================================
const validateYouTubeUrl = async (req, res) => {
    try {
        const { url } = req.body

        console.log('🔗 Validando URL de YouTube:', url)

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

            console.log('✅ URL de YouTube válida:', videoId)

            res.json({
                success: true,
                data: {
                    isValid: true,
                    videoId,
                    embedUrl: `https://www.youtube.com/embed/${videoId}`,
                    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
                }
            })
        } else {
            console.log('❌ URL de YouTube inválida')

            res.status(400).json({
                success: false,
                message: 'URL de YouTube inválida',
                expectedFormats: [
                    'https://www.youtube.com/watch?v=VIDEO_ID',
                    'https://youtu.be/VIDEO_ID',
                    'https://www.youtube.com/embed/VIDEO_ID'
                ]
            })
        }

    } catch (error) {
        console.error('❌ Error validando URL de YouTube:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// DUPLICAR CURSO
// =============================================
const duplicateCourse = async (req, res) => {
    const client = await pool.connect()

    try {
        await client.query('BEGIN')

        const { cursoId } = req.params
        const { titulo } = req.body

        console.log('📋 Duplicando curso:', { cursoId, titulo })

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

        console.log('✅ Curso duplicado exitosamente:', nuevoCursoId)

        res.status(201).json({
            success: true,
            message: 'Curso duplicado exitosamente',
            data: { curso: nuevoCurso.rows[0] }
        })

    } catch (error) {
        await client.query('ROLLBACK')
        console.error('❌ Error duplicando curso:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    } finally {
        client.release()
    }
}

// =============================================
// ESTADÍSTICAS AVANZADAS DEL CURSO
// =============================================
const getCourseStats = async (req, res) => {
    try {
        const { cursoId } = req.params

        console.log('📊 Obteniendo estadísticas del curso:', cursoId)

        // Verificar permisos
        const hasPermission = await checkCoursePermission(req.user.id, req.user.tipo_usuario, cursoId)
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver estadísticas de este curso'
            })
        }

        // Estadísticas generales
        const statsResult = await pool.query(
            `SELECT 
                c.titulo as curso_titulo,
                c.es_gratuito,
                c.precio,
                (SELECT COUNT(*) FROM modulos m WHERE m.curso_id = c.id) as total_modulos,
                (SELECT COUNT(*) FROM clases cl JOIN modulos m ON cl.modulo_id = m.id WHERE m.curso_id = c.id) as total_clases,
                (SELECT SUM(cl.duracion_minutos) FROM clases cl JOIN modulos m ON cl.modulo_id = m.id WHERE m.curso_id = c.id) as duracion_total_minutos,
                (SELECT COUNT(*) FROM simulacros s WHERE s.curso_id = c.id AND s.activo = true) as total_simulacros,
                (SELECT COUNT(*) FROM preguntas p JOIN simulacros s ON p.simulacro_id = s.id WHERE s.curso_id = c.id) as total_preguntas,
                (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_id = c.id) as total_inscripciones,
                (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_id = c.id AND i.estado_pago = 'habilitado') as inscripciones_activas
             FROM cursos c 
             WHERE c.id = $1`,
            [cursoId]
        )

        if (statsResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curso no encontrado'
            })
        }

        // Estadísticas por tipo de pregunta
        const questionTypesResult = await pool.query(
            `SELECT 
                p.tipo_pregunta,
                COUNT(*) as cantidad,
                AVG(
                    CASE WHEN ru.total_respuestas > 0 
                    THEN (ru.respuestas_correctas::decimal / ru.total_respuestas) * 100
                    ELSE 0 
                    END
                ) as promedio_acierto
             FROM preguntas p
             JOIN simulacros s ON p.simulacro_id = s.id
             LEFT JOIN (
                 SELECT 
                     pregunta_id,
                     COUNT(*) as total_respuestas,
                     COUNT(*) FILTER (WHERE es_correcta = true) as respuestas_correctas
                 FROM respuestas_usuario
                 GROUP BY pregunta_id
             ) ru ON p.id = ru.pregunta_id
             WHERE s.curso_id = $1
             GROUP BY p.tipo_pregunta
             ORDER BY cantidad DESC`,
            [cursoId]
        )

        // Actividad reciente
        const actividadResult = await pool.query(
            `SELECT 
                'intento' as tipo,
                i.fecha_intento as fecha,
                pu.nombre_completo as usuario,
                s.titulo as detalle,
                i.puntaje
             FROM intentos_simulacro i
             JOIN perfiles_usuario pu ON i.usuario_id = pu.id
             JOIN simulacros s ON i.simulacro_id = s.id
             WHERE s.curso_id = $1 AND i.puntaje IS NOT NULL
             ORDER BY i.fecha_intento DESC
             LIMIT 10`,
            [cursoId]
        )

        const stats = statsResult.rows[0]

        console.log('✅ Estadísticas obtenidas exitosamente')

        res.json({
            success: true,
            data: {
                curso: {
                    titulo: stats.curso_titulo,
                    es_gratuito: stats.es_gratuito,
                    precio: stats.precio
                },
                contenido: {
                    modulos: parseInt(stats.total_modulos) || 0,
                    clases: parseInt(stats.total_clases) || 0,
                    duracion_horas: Math.round((parseInt(stats.duracion_total_minutos) || 0) / 60 * 10) / 10,
                    simulacros: parseInt(stats.total_simulacros) || 0,
                    preguntas: parseInt(stats.total_preguntas) || 0
                },
                inscripciones: {
                    total: parseInt(stats.total_inscripciones) || 0,
                    activas: parseInt(stats.inscripciones_activas) || 0,
                    tasa_activacion: stats.total_inscripciones > 0
                        ? Math.round((stats.inscripciones_activas / stats.total_inscripciones) * 100)
                        : 0
                },
                tipos_pregunta: questionTypesResult.rows.map(row => ({
                    tipo: row.tipo_pregunta,
                    config: QUESTION_TYPES[row.tipo_pregunta] || { name: row.tipo_pregunta },
                    cantidad: parseInt(row.cantidad),
                    promedio_acierto: Math.round(parseFloat(row.promedio_acierto) || 0)
                })),
                actividad_reciente: actividadResult.rows,
                resumen: {
                    completitud: {
                        tiene_contenido: (parseInt(stats.total_clases) || 0) > 0,
                        tiene_evaluacion: (parseInt(stats.total_simulacros) || 0) > 0,
                        tiene_preguntas: (parseInt(stats.total_preguntas) || 0) > 0,
                        esta_completo: (parseInt(stats.total_clases) || 0) > 0 &&
                            (parseInt(stats.total_simulacros) || 0) > 0 &&
                            (parseInt(stats.total_preguntas) || 0) > 0
                    }
                }
            }
        })

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// EXPORTAR TODAS LAS FUNCIONES
// =============================================
module.exports = {
    // Gestión de cursos
    getCourseContent,
    getCourseStats,

    // Gestión de módulos
    createModule,
    updateModule,
    deleteModule,
    reorderModules,

    // Gestión de clases
    createClass,
    updateClass,
    deleteClass,
    reorderClasses,

    // Gestión de simulacros
    createSimulacro,
    updateSimulacro,
    deleteSimulacro,
    getSimulacroWithQuestions,

    // Gestión de preguntas
    createQuestion,
    updateQuestion,
    deleteQuestion,

    getSimulacroConfigurations,

    createMultipleQuestions,
    getQuestionTypes,

    // Utilidades
    validateYouTubeUrl,

    duplicateCourse,

    // Servicios internos (para uso en otros controladores)
    QuestionEvaluationService,
    QUESTION_TYPES,


    SIMULACRO_MODES,
    TIEMPO_TYPES,
    NAVEGACION_TYPES,
    validateSimulacroConfig,
    applyDefaultConfig,

    validateQuestionData,
    checkCoursePermission
}