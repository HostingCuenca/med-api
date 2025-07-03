// routes/enrollments.js - AGREGAR NUEVA RUTA

const express = require('express')
const router = express.Router()
const {
    enrollCourse,
    getMyEnrollments,
    approvePayment,
    getPendingPayments,
    checkCourseAccess,
    getAllEnrollments  ,
    getEnrollmentStats
    // ✅ IMPORTAR NUEVO MÉTODO
} = require('../controllers/enrollmentController')
const { authenticateToken, requireRole } = require('../middleware/auth')

// ==================== RUTAS ESTUDIANTES ====================
// Inscribirse a un curso
router.post('/', authenticateToken, enrollCourse)

// Obtener mis inscripciones (MyCourses)
router.get('/my', authenticateToken, getMyEnrollments)

// Verificar acceso a curso específico
router.get('/check-access/:cursoId', authenticateToken, checkCourseAccess)

// ==================== RUTAS ADMINISTRADOR ====================
// ✅ NUEVA RUTA - Obtener TODAS las inscripciones
router.get('/admin/all', authenticateToken, requireRole(['admin']), getAllEnrollments)

router.get('/admin/stats', authenticateToken, requireRole(['admin']), getEnrollmentStats)

// Obtener solo pagos pendientes (ruta existente)
router.get('/pending', authenticateToken, requireRole(['admin']), getPendingPayments)

// Aprobar pago específico
router.patch('/:inscripcionId/approve', authenticateToken, requireRole(['admin']), approvePayment)

module.exports = router