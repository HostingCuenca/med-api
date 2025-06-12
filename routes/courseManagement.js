// routes/courseManagement.js - RUTAS COMPLETAS
const express = require('express')
const router = express.Router()
const {
    // Gestión de cursos
    getCourseContent,

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
    createMultipleQuestions,

    // Utilidades
    validateYouTubeUrl,
    duplicateCourse
} = require('../controllers/courseManagementController')

const { authenticateToken, requireRole } = require('../middleware/auth')

// ==================== GESTIÓN DE CURSOS ====================
// Obtener contenido completo del curso para edición
router.get('/course/:cursoId', authenticateToken, requireRole(['admin', 'instructor']), getCourseContent)

// Duplicar curso
router.post('/duplicate/:cursoId', authenticateToken, requireRole(['admin', 'instructor']), duplicateCourse)

// ==================== GESTIÓN DE MÓDULOS ====================
// Crear módulo
router.post('/modules', authenticateToken, requireRole(['admin', 'instructor']), createModule)

// Actualizar módulo
router.patch('/modules/:id', authenticateToken, requireRole(['admin', 'instructor']), updateModule)
router.put('/modules/:id', authenticateToken, requireRole(['admin', 'instructor']), updateModule)

// Eliminar módulo
router.delete('/modules/:id', authenticateToken, requireRole(['admin', 'instructor']), deleteModule)

// Reordenar módulos
router.patch('/modules/reorder', authenticateToken, requireRole(['admin', 'instructor']), reorderModules)

// ==================== GESTIÓN DE CLASES ====================
// Crear clase
router.post('/classes', authenticateToken, requireRole(['admin', 'instructor']), createClass)

// Actualizar clase
router.patch('/classes/:id', authenticateToken, requireRole(['admin', 'instructor']), updateClass)
router.put('/classes/:id', authenticateToken, requireRole(['admin', 'instructor']), updateClass)

// Eliminar clase
router.delete('/classes/:id', authenticateToken, requireRole(['admin', 'instructor']), deleteClass)

// Reordenar clases
router.patch('/classes/reorder', authenticateToken, requireRole(['admin', 'instructor']), reorderClasses)

// ==================== GESTIÓN DE SIMULACROS ====================
// Crear simulacro
router.post('/simulacros', authenticateToken, requireRole(['admin', 'instructor']), createSimulacro)

// Actualizar simulacro
router.patch('/simulacros/:id', authenticateToken, requireRole(['admin', 'instructor']), updateSimulacro)
router.put('/simulacros/:id', authenticateToken, requireRole(['admin', 'instructor']), updateSimulacro)

// Eliminar simulacro
router.delete('/simulacros/:id', authenticateToken, requireRole(['admin', 'instructor']), deleteSimulacro)

// Obtener simulacro con preguntas
router.get('/simulacros/:id/questions', authenticateToken, requireRole(['admin', 'instructor']), getSimulacroWithQuestions)

// ==================== GESTIÓN DE PREGUNTAS ====================
// Crear pregunta
router.post('/questions', authenticateToken, requireRole(['admin', 'instructor']), createQuestion)

// Actualizar pregunta
router.patch('/questions/:id', authenticateToken, requireRole(['admin', 'instructor']), updateQuestion)
router.put('/questions/:id', authenticateToken, requireRole(['admin', 'instructor']), updateQuestion)

// Eliminar pregunta
router.delete('/questions/:id', authenticateToken, requireRole(['admin', 'instructor']), deleteQuestion)

// Crear múltiples preguntas
router.post('/questions/bulk', authenticateToken, requireRole(['admin', 'instructor']), createMultipleQuestions)

// ==================== UTILIDADES ====================
// Validar URL de YouTube
router.post('/validate-youtube', authenticateToken, requireRole(['admin', 'instructor']), validateYouTubeUrl)

module.exports = router