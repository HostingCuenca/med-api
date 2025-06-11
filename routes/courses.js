// routes/courses.js
const express = require('express')
const router = express.Router()
const {
    getCourses,
    getCourseById,
    createCourse,
    updateCourse,
    deleteCourse
} = require('../controllers/courseController')
const { authenticateToken, requireRole } = require('../middleware/auth')

// Rutas públicas
router.get('/', getCourses)
router.get('/:id', getCourseById)

// Rutas protegidas (admin/instructor)
router.post('/', authenticateToken, requireRole(['admin', 'instructor']), createCourse)
router.put('/:id', authenticateToken, requireRole(['admin', 'instructor']), updateCourse)
router.patch('/:id', authenticateToken, requireRole(['admin', 'instructor']), updateCourse)
router.delete('/:id', authenticateToken, requireRole(['admin', 'instructor']), deleteCourse)

module.exports = router