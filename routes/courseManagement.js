// routes/courseManagement.js
const express = require('express')
const router = express.Router()
const {
    createModule,
    createClass,
    createSimulacro,
    createQuestion,
    getCourseContent
} = require('../controllers/courseManagementController')
const { authenticateToken, requireRole } = require('../middleware/auth')

router.post('/modules', authenticateToken, requireRole(['admin', 'instructor']), createModule)
router.post('/classes', authenticateToken, requireRole(['admin', 'instructor']), createClass)
router.post('/simulacros', authenticateToken, requireRole(['admin', 'instructor']), createSimulacro)
router.post('/questions', authenticateToken, requireRole(['admin', 'instructor']), createQuestion)
router.get('/course/:cursoId', authenticateToken, requireRole(['admin', 'instructor']), getCourseContent)

module.exports = router