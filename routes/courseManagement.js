// // routes/courseManagement.js - RUTAS COMPLETAS
// const express = require('express')
// const router = express.Router()
// const {
//     // Gestión de cursos
//     getCourseContent,
//
//     // Gestión de módulos
//     createModule,
//     updateModule,
//     deleteModule,
//     reorderModules,
//
//     // Gestión de clases
//     createClass,
//     updateClass,
//     deleteClass,
//     reorderClasses,
//
//     // Gestión de simulacros
//     createSimulacro,
//     updateSimulacro,
//     deleteSimulacro,
//     getSimulacroWithQuestions,
//
//     // Gestión de preguntas
//     createQuestion,
//     updateQuestion,
//     deleteQuestion,
//     createMultipleQuestions,
//
//     // Utilidades
//     validateYouTubeUrl,
//     duplicateCourse
// } = require('../controllers/courseManagementController')
//
// const { authenticateToken, requireRole } = require('../middleware/auth')
//
// // ==================== GESTIÓN DE CURSOS ====================
// // Obtener contenido completo del curso para edición
// router.get('/course/:cursoId', authenticateToken, requireRole(['admin', 'instructor']), getCourseContent)
//
// // Duplicar curso
// router.post('/duplicate/:cursoId', authenticateToken, requireRole(['admin', 'instructor']), duplicateCourse)
//
// // ==================== GESTIÓN DE MÓDULOS ====================
// // Crear módulo
// router.post('/modules', authenticateToken, requireRole(['admin', 'instructor']), createModule)
//
// // Actualizar módulo
// router.patch('/modules/:id', authenticateToken, requireRole(['admin', 'instructor']), updateModule)
// router.put('/modules/:id', authenticateToken, requireRole(['admin', 'instructor']), updateModule)
//
// // Eliminar módulo
// router.delete('/modules/:id', authenticateToken, requireRole(['admin', 'instructor']), deleteModule)
//
// // Reordenar módulos
// router.patch('/modules/reorder', authenticateToken, requireRole(['admin', 'instructor']), reorderModules)
//
// // ==================== GESTIÓN DE CLASES ====================
// // Crear clase
// router.post('/classes', authenticateToken, requireRole(['admin', 'instructor']), createClass)
//
// // Actualizar clase
// router.patch('/classes/:id', authenticateToken, requireRole(['admin', 'instructor']), updateClass)
// router.put('/classes/:id', authenticateToken, requireRole(['admin', 'instructor']), updateClass)
//
// // Eliminar clase
// router.delete('/classes/:id', authenticateToken, requireRole(['admin', 'instructor']), deleteClass)
//
// // Reordenar clases
// router.patch('/classes/reorder', authenticateToken, requireRole(['admin', 'instructor']), reorderClasses)
//
// // ==================== GESTIÓN DE SIMULACROS ====================
// // Crear simulacro
// router.post('/simulacros', authenticateToken, requireRole(['admin', 'instructor']), createSimulacro)
//
// // Actualizar simulacro
// router.patch('/simulacros/:id', authenticateToken, requireRole(['admin', 'instructor']), updateSimulacro)
// router.put('/simulacros/:id', authenticateToken, requireRole(['admin', 'instructor']), updateSimulacro)
//
// // Eliminar simulacro
// router.delete('/simulacros/:id', authenticateToken, requireRole(['admin', 'instructor']), deleteSimulacro)
//
// // Obtener simulacro con preguntas
// router.get('/simulacros/:id/questions', authenticateToken, requireRole(['admin', 'instructor']), getSimulacroWithQuestions)
//
// // ==================== GESTIÓN DE PREGUNTAS ====================
// // Crear pregunta
// router.post('/questions', authenticateToken, requireRole(['admin', 'instructor']), createQuestion)
//
// // Actualizar pregunta
// router.patch('/questions/:id', authenticateToken, requireRole(['admin', 'instructor']), updateQuestion)
// router.put('/questions/:id', authenticateToken, requireRole(['admin', 'instructor']), updateQuestion)
//
// // Eliminar pregunta
// router.delete('/questions/:id', authenticateToken, requireRole(['admin', 'instructor']), deleteQuestion)
//
// // Crear múltiples preguntas
// router.post('/questions/bulk', authenticateToken, requireRole(['admin', 'instructor']), createMultipleQuestions)
//
// // ==================== UTILIDADES ====================
// // Validar URL de YouTube
// router.post('/validate-youtube', authenticateToken, requireRole(['admin', 'instructor']), validateYouTubeUrl)
//
// module.exports = router



// routes/courseManagement.js - RUTAS COMPLETAS AL 100%
const express = require('express')
const router = express.Router()

// Importar TODAS las funciones del controller
const {
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
    getSimulacroConfigurations,

    // Gestión de preguntas
    createQuestion,
    updateQuestion,
    deleteQuestion,
    createMultipleQuestions,
    getQuestionTypes,

    // Utilidades
    validateYouTubeUrl,
    duplicateCourse
} = require('../controllers/courseManagementController')

const { authenticateToken, requireRole } = require('../middleware/auth')

// ==================== DOCUMENTACIÓN DE ENDPOINTS ====================
/*
🎯 ENDPOINTS DISPONIBLES:

📚 CURSOS:
GET    /course-management/course/:cursoId              - Obtener contenido del curso
GET    /course-management/course/:cursoId/stats       - Estadísticas del curso
POST   /course-management/duplicate/:cursoId          - Duplicar curso

📋 MÓDULOS:
POST   /course-management/modules                     - Crear módulo
PATCH  /course-management/modules/:id                 - Actualizar módulo
DELETE /course-management/modules/:id                 - Eliminar módulo
PATCH  /course-management/modules/reorder             - Reordenar módulos

🎓 CLASES:
POST   /course-management/classes                     - Crear clase
PATCH  /course-management/classes/:id                 - Actualizar clase
DELETE /course-management/classes/:id                 - Eliminar clase
PATCH  /course-management/classes/reorder             - Reordenar clases

🧪 SIMULACROS:
POST   /course-management/simulacros                  - Crear simulacro
PATCH  /course-management/simulacros/:id              - Actualizar simulacro
DELETE /course-management/simulacros/:id              - Eliminar simulacro
GET    /course-management/simulacros/:id/questions    - Obtener simulacro con preguntas

❓ PREGUNTAS:
GET    /course-management/question-types              - Tipos de pregunta disponibles
POST   /course-management/questions                   - Crear pregunta individual
PATCH  /course-management/questions/:id               - Actualizar pregunta
DELETE /course-management/questions/:id               - Eliminar pregunta
POST   /course-management/questions/bulk              - Crear múltiples preguntas

🔧 UTILIDADES:
POST   /course-management/validate-youtube            - Validar URL de YouTube
*/

// ==================== MIDDLEWARE DE LOGGING ====================
router.use((req, res, next) => {
    console.log(`🔧 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('📝 Body:', JSON.stringify(req.body, null, 2))
    }
    next()
})

// ==================== GESTIÓN DE CURSOS ====================



// Obtener contenido completo del curso para edición
router.get('/course/:cursoId',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    getCourseContent
)

// Obtener estadísticas avanzadas del curso
router.get('/course/:cursoId/stats',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    getCourseStats
)

// Duplicar curso completo
router.post('/duplicate/:cursoId',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    duplicateCourse
)

// ==================== GESTIÓN DE MÓDULOS ====================

// Crear módulo
router.post('/modules',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    createModule
)

// Actualizar módulo (PATCH y PUT para compatibilidad)
router.patch('/modules/:id',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    updateModule
)
router.put('/modules/:id',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    updateModule
)

// Eliminar módulo
router.delete('/modules/:id',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    deleteModule
)

// Reordenar módulos
router.patch('/modules/reorder',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    reorderModules
)

// ==================== GESTIÓN DE CLASES ====================

// Crear clase
router.post('/classes',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    createClass
)

// Actualizar clase (PATCH y PUT para compatibilidad)
router.patch('/classes/:id',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    updateClass
)
router.put('/classes/:id',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    updateClass
)

// Eliminar clase
router.delete('/classes/:id',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    deleteClass
)

// Reordenar clases
router.patch('/classes/reorder',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    reorderClasses
)

// ==================== GESTIÓN DE SIMULACROS ====================

router.get('/simulacro-configurations', getSimulacroConfigurations)

// Crear simulacro
router.post('/simulacros',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    createSimulacro
)

// Actualizar simulacro (PATCH y PUT para compatibilidad)
router.patch('/simulacros/:id',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    updateSimulacro
)
router.put('/simulacros/:id',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    updateSimulacro
)

// Eliminar simulacro
router.delete('/simulacros/:id',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    deleteSimulacro
)



// Obtener simulacro con preguntas (para gestión)
router.get('/simulacros/:id/questions',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    getSimulacroWithQuestions
)

// ==================== GESTIÓN DE PREGUNTAS ====================

// Obtener tipos de pregunta disponibles (NO requiere auth para facilidad)
router.get('/question-types', getQuestionTypes)

// Crear pregunta individual
router.post('/questions',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    createQuestion
)

// Actualizar pregunta (PATCH y PUT para compatibilidad)
router.patch('/questions/:id',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    updateQuestion
)
router.put('/questions/:id',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    updateQuestion
)

// Eliminar pregunta
router.delete('/questions/:id',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    deleteQuestion
)

// Crear múltiples preguntas (importación masiva)
router.post('/questions/bulk',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    createMultipleQuestions
)

// ==================== UTILIDADES ====================

// Validar URL de YouTube
router.post('/validate-youtube',
    authenticateToken,
    requireRole(['admin', 'instructor']),
    validateYouTubeUrl
)

// ==================== MIDDLEWARE DE MANEJO DE ERRORES ====================
router.use((error, req, res, next) => {
    console.error('🚨 Error en course-management:', error)
    res.status(500).json({
        success: false,
        message: 'Error interno en course-management',
        timestamp: new Date().toISOString(),
        endpoint: req.originalUrl,
        method: req.method,
        ...(process.env.NODE_ENV === 'development' && {
            error: error.message,
            stack: error.stack
        })
    })
})

// ==================== DOCUMENTACIÓN AUTOMÁTICA ====================
router.get('/docs', (req, res) => {
    res.json({
        title: 'Course Management API Documentation',
        version: '2.0.0',
        description: 'API completa para gestión de cursos, módulos, clases, simulacros y preguntas',
        baseUrl: '/med-api/course-management',
        authentication: 'Bearer Token required (except /question-types)',
        roles: ['admin', 'instructor'],
        endpoints: {
            cursos: {
                'GET /course/:cursoId': 'Obtener contenido completo del curso',
                'GET /course/:cursoId/stats': 'Estadísticas avanzadas del curso',
                'POST /duplicate/:cursoId': 'Duplicar curso completo'
            },
            modulos: {
                'POST /modules': 'Crear módulo',
                'PATCH /modules/:id': 'Actualizar módulo',
                'DELETE /modules/:id': 'Eliminar módulo',
                'PATCH /modules/reorder': 'Reordenar módulos'
            },
            clases: {
                'POST /classes': 'Crear clase',
                'PATCH /classes/:id': 'Actualizar clase',
                'DELETE /classes/:id': 'Eliminar clase',
                'PATCH /classes/reorder': 'Reordenar clases'
            },
            simulacros: {
                'POST /simulacros': 'Crear simulacro',
                'PATCH /simulacros/:id': 'Actualizar simulacro',
                'DELETE /simulacros/:id': 'Eliminar simulacro',
                'GET /simulacros/:id/questions': 'Obtener simulacro con preguntas'
            },
            preguntas: {
                'GET /question-types': 'Tipos de pregunta disponibles (público)',
                'POST /questions': 'Crear pregunta individual',
                'PATCH /questions/:id': 'Actualizar pregunta',
                'DELETE /questions/:id': 'Eliminar pregunta',
                'POST /questions/bulk': 'Crear múltiples preguntas'
            },
            utilidades: {
                'POST /validate-youtube': 'Validar URL de YouTube'
            }
        },
        question_types: {
            basicos: ['multiple', 'true_false', 'multiple_respuesta'],
            texto: ['short_answer', 'essay', 'fill_blanks'],
            numericos: ['numerical'],
            interactivos: ['matching', 'ordering']
        },
        examples: {
            crear_pregunta_multiple: {
                url: 'POST /questions',
                body: {
                    simulacroId: 'uuid-del-simulacro',
                    enunciado: '¿Cuál es la capital de Francia?',
                    tipoPregunta: 'multiple',
                    explicacion: 'París es la capital de Francia desde...',
                    imagenUrl: 'https://ejemplo.com/imagen.jpg',
                    opciones: [
                        { textoOpcion: 'Londres', esCorrecta: false },
                        { textoOpcion: 'París', esCorrecta: true },
                        { textoOpcion: 'Madrid', esCorrecta: false },
                        { textoOpcion: 'Roma', esCorrecta: false }
                    ]
                }
            },
            crear_pregunta_multiple_respuesta: {
                url: 'POST /questions',
                body: {
                    simulacroId: 'uuid-del-simulacro',
                    enunciado: '¿Cuáles son capitales europeas?',
                    tipoPregunta: 'multiple_respuesta',
                    opciones: [
                        { textoOpcion: 'París', esCorrecta: true },
                        { textoOpcion: 'Londres', esCorrecta: true },
                        { textoOpcion: 'Nueva York', esCorrecta: false },
                        { textoOpcion: 'Madrid', esCorrecta: true }
                    ]
                }
            },
            crear_pregunta_short_answer: {
                url: 'POST /questions',
                body: {
                    simulacroId: 'uuid-del-simulacro',
                    enunciado: '¿Cuál es la capital de Francia?',
                    tipoPregunta: 'short_answer',
                    opciones: [
                        { textoOpcion: 'París', esCorrecta: true },
                        { textoOpcion: 'Paris', esCorrecta: true },
                        { textoOpcion: 'PARÍS', esCorrecta: true }
                    ]
                }
            },
            crear_pregunta_numerical: {
                url: 'POST /questions',
                body: {
                    simulacroId: 'uuid-del-simulacro',
                    enunciado: '¿Cuánto es 2 + 2?',
                    tipoPregunta: 'numerical',
                    opciones: [
                        { textoOpcion: '4', esCorrecta: true }
                    ]
                }
            },
            importar_preguntas_bulk: {
                url: 'POST /questions/bulk',
                body: {
                    simulacroId: 'uuid-del-simulacro',
                    questions: [
                        {
                            enunciado: 'Pregunta 1',
                            tipoPregunta: 'multiple',
                            opciones: [
                                { textoOpcion: 'Opción A', esCorrecta: true },
                                { textoOpcion: 'Opción B', esCorrecta: false }
                            ]
                        },
                        {
                            enunciado: 'Pregunta 2',
                            tipoPregunta: 'true_false',
                            opciones: [
                                { textoOpcion: 'Verdadero', esCorrecta: true },
                                { textoOpcion: 'Falso', esCorrecta: false }
                            ]
                        }
                    ]
                }
            }
        },
        testing: {
            base_url: 'http://localhost:5001/med-api/course-management',
            test_endpoints: [
                'GET /question-types',
                'GET /docs',
                'GET /course/COURSE_ID',
                'GET /simulacros/SIMULACRO_ID/questions'
            ]
        }
    })
})

// ==================== ENDPOINT DE SALUD ====================
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'course-management',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        endpoints_available: 20,
        question_types_supported: 10,
        features: [
            'Gestión completa de cursos',
            'Módulos y clases',
            'Simulacros avanzados',
            '10 tipos de preguntas',
            'Evaluación inteligente',
            'Importación masiva',
            'Duplicación de cursos',
            'Estadísticas avanzadas'
        ]
    })
})

module.exports = router