
const express = require('express')
const router = express.Router()
const {
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
} = require('../controllers/simulacroController')
const { authenticateToken, requireRole } = require('../middleware/auth')

// ==================== MIDDLEWARE DE LOGGING ====================
router.use((req, res, next) => {
    console.log(`🧪 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('📝 Body:', JSON.stringify(req.body, null, 2))
    }
    next()
})

// ==================== RUTAS PARA ESTUDIANTES ====================

// Obtener simulacros disponibles por curso
router.get('/course/:cursoId',
    authenticateToken,
    getSimulacrosByCourse
)

// Obtener preguntas de un simulacro para realizar
router.get('/:simulacroId/questions',
    authenticateToken,
    getSimulacroQuestions
)

// Enviar respuestas de un simulacro
router.post('/:simulacroId/submit',
    authenticateToken,
    submitSimulacro
)

// Obtener mis intentos de simulacros
router.get('/my-attempts',
    authenticateToken,
    getMyAttempts
)

// Obtener detalle de un intento específico
router.get('/attempt/:intentoId',
    authenticateToken,
    getAttemptDetail
)

// ==================== RUTAS ADMIN ====================

// IMPORTANTE: Rutas específicas DEBEN ir ANTES de rutas con parámetros dinámicos

// Obtener todos los simulacros (con filtros)
router.get('/admin/all',
    authenticateToken,
    requireRole(['admin']),
    getAllSimulacros
)

// Obtener todos los intentos (para purificación)
router.get('/admin/intentos',
    authenticateToken,
    requireRole(['admin']),
    getAllIntentos
)

// Obtener estadísticas de intentos por curso
router.get('/admin/intentos/stats/:cursoId',
    authenticateToken,
    requireRole(['admin']),
    getIntentosStats
)

// Eliminar intentos (hard delete - purificación)
router.delete('/admin/intentos',
    authenticateToken,
    requireRole(['admin']),
    deleteIntentos
)

// Eliminar simulacro (safe delete) - DEBE IR AL FINAL
router.delete('/admin/:simulacroId',
    authenticateToken,
    requireRole(['admin']),
    deleteSimulacro
)

// ==================== MIDDLEWARE DE MANEJO DE ERRORES ====================
router.use((error, req, res, next) => {
    console.error('🚨 Error en simulacros:', error)
    res.status(500).json({
        success: false,
        message: 'Error interno en simulacros',
        timestamp: new Date().toISOString(),
        endpoint: req.originalUrl,
        method: req.method,
        ...(process.env.NODE_ENV === 'development' && {
            error: error.message,
            stack: error.stack
        })
    })
})

// ==================== DOCUMENTACIÓN DE ENDPOINTS ====================
router.get('/docs', (req, res) => {
    res.json({
        title: 'Simulacros API Documentation',
        version: '2.0.0',
        description: 'API para la ejecución de simulacros por estudiantes con compatibilidad total',
        baseUrl: '/med-api/simulacros',
        authentication: 'Bearer Token required',
        compatibility: 'Soporta tanto simulacros antiguos como nuevos con configuraciones avanzadas',
        endpoints: {
            'GET /course/:cursoId': {
                description: 'Obtener simulacros disponibles de un curso',
                parameters: {
                    cursoId: 'UUID del curso'
                },
                response: 'Lista de simulacros con información de intentos del usuario'
            },
            'GET /:simulacroId/questions': {
                description: 'Obtener preguntas de un simulacro para realizar',
                parameters: {
                    simulacroId: 'UUID del simulacro'
                },
                response: 'Simulacro con preguntas randomizadas según configuración'
            },
            'POST /:simulacroId/submit': {
                description: 'Enviar respuestas del simulacro',
                parameters: {
                    simulacroId: 'UUID del simulacro'
                },
                body: {
                    respuestas: 'Array de respuestas con preguntaId y opcionSeleccionadaId',
                    tiempoEmpleadoMinutos: 'Número de minutos empleados'
                },
                response: 'Resultado del simulacro con puntaje y detalle'
            },
            'GET /my-attempts': {
                description: 'Obtener intentos del usuario autenticado',
                query: {
                    simulacroId: 'Filtrar por simulacro específico',
                    cursoId: 'Filtrar por curso específico',
                    page: 'Número de página (default: 1)',
                    limit: 'Límite por página (default: 20, max: 100)'
                },
                response: 'Lista paginada de intentos con estadísticas'
            },
            'GET /attempt/:intentoId': {
                description: 'Obtener detalle de un intento específico',
                parameters: {
                    intentoId: 'UUID del intento'
                },
                response: 'Detalle completo del intento con respuestas (si está permitido)'
            },
            'GET /admin/all': {
                description: '[ADMIN] Obtener todos los simulacros con filtros',
                authentication: 'Bearer Token + Admin Role',
                query: {
                    cursoId: 'Filtrar por curso específico',
                    activo: 'true/false - Filtrar por estado',
                    modoEstudio: 'estudio/revision/evaluacion/examen_real',
                    page: 'Número de página (default: 1)',
                    limit: 'Límite por página (default: 50)'
                },
                response: 'Lista paginada de simulacros con estadísticas completas'
            },
            'DELETE /admin/:simulacroId': {
                description: '[ADMIN] Eliminar simulacro (safe delete)',
                authentication: 'Bearer Token + Admin Role',
                parameters: {
                    simulacroId: 'UUID del simulacro'
                },
                response: 'Confirmación de desactivación con información preservada'
            }
        },
        compatibility_features: {
            campo_mapping: {
                'modo_evaluacion ↔ modo_estudio': 'Mapeo automático entre sistemas',
                'configuracion_legacy': 'Soporte para configuraciones antiguas',
                'evaluacion_avanzada': 'Soporte para 10 tipos de pregunta'
            },
            response_format: {
                dual_mode_support: 'Respuestas incluyen tanto campos nuevos como antiguos',
                backward_compatibility: 'Frontend antiguo sigue funcionando',
                forward_compatibility: 'Frontend nuevo recibe datos enriquecidos'
            }
        },
        question_types_supported: {
            basicos: ['multiple', 'true_false', 'multiple_respuesta'],
            texto: ['short_answer', 'essay', 'fill_blanks'],
            numericos: ['numerical'],
            interactivos: ['matching', 'ordering']
        },
        simulacro_modes: {
            nuevos: ['estudio', 'revision', 'evaluacion', 'examen_real'],
            antiguos: ['practica', 'realista', 'examen'],
            mapping: {
                'estudio → practica': 'Compatibilidad automática',
                'revision → realista': 'Compatibilidad automática',
                'evaluacion → realista': 'Compatibilidad automática',
                'examen_real → examen': 'Compatibilidad automática'
            }
        },
        ejemplos: {
            realizar_simulacro: {
                step1: 'GET /course/uuid-curso → obtener simulacros disponibles',
                step2: 'GET /uuid-simulacro/questions → obtener preguntas',
                step3: 'POST /uuid-simulacro/submit → enviar respuestas',
                step4: 'GET /my-attempts → ver resultados'
            },
            respuesta_submit: {
                url: 'POST /uuid-simulacro/submit',
                body: {
                    respuestas: [
                        {
                            preguntaId: 'uuid-pregunta-1',
                            opcionSeleccionadaId: 'uuid-opcion-a',
                            respuestaTexto: null
                        },
                        {
                            preguntaId: 'uuid-pregunta-2',
                            opcionSeleccionadaId: null,
                            respuestaTexto: 'Mi respuesta de texto'
                        }
                    ],
                    tiempoEmpleadoMinutos: 45
                },
                response: {
                    success: true,
                    data: {
                        intentoId: 'uuid-intento',
                        puntaje: 85,
                        respuestasCorrectas: 17,
                        totalPreguntas: 20,
                        modoEvaluacion: 'practica',
                        modoEstudio: 'estudio',
                        detalle: '...',
                        estadisticas: '...'
                    }
                }
            }
        }
    })
})

// ==================== ENDPOINT DE SALUD ====================
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'simulacros-estudiantes',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        endpoints_available: 5,
        compatibility: 'Full backward and forward compatibility',
        features: [
            'Ejecución de simulacros',
            'Evaluación avanzada por tipos',
            'Compatibilidad total',
            'Navegación secuencial/libre',
            'Múltiples tipos de pregunta',
            'Estadísticas detalladas',
            'Historial de intentos',
            'Configuraciones avanzadas'
        ]
    })
})

module.exports = router