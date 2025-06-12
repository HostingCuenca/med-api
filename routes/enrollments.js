// routes/enrollments.js - CORREGIDO
const express = require('express')
const router = express.Router()
const {
    enrollCourse,
    getMyEnrollments,
    approvePayment,
    getPendingPayments,
    checkCourseAccess
} = require('../controllers/enrollmentController')
const { authenticateToken, requireRole } = require('../middleware/auth')

// Inscribirse a un curso
router.post('/', authenticateToken, enrollCourse)

// Obtener mis inscripciones (MyCourses)
router.get('/my', authenticateToken, getMyEnrollments)

// Verificar acceso a curso específico
router.get('/check-access/:cursoId', authenticateToken, checkCourseAccess)

// Rutas de administración
router.get('/pending', authenticateToken, requireRole(['admin']), getPendingPayments)
router.patch('/:inscripcionId/approve', authenticateToken, requireRole(['admin']), approvePayment)

module.exports = router