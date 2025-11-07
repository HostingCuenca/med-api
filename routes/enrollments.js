// routes/enrollments.js - AGREGAR NUEVA RUTA

const express = require('express')
const router = express.Router()
const {
    enrollCourse,
    getMyEnrollments,
    approvePayment,
    getPendingPayments,
    checkCourseAccess,
    getAllEnrollments,
    getEnrollmentStats,
    suspendAccess,
    reactivateAccess,
    closeCourseSeason
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

// ✅ NUEVAS RUTAS - Gestión de accesos
// Desactivar acceso (individual o bulk)
router.post('/suspend', authenticateToken, requireRole(['admin']), suspendAccess)

// Reactivar acceso (individual o bulk)
router.post('/reactivate', authenticateToken, requireRole(['admin']), reactivateAccess)

// Cerrar temporada de un curso (desactivar todos los accesos del curso)
router.post('/course/:cursoId/close-season', authenticateToken, requireRole(['admin']), closeCourseSeason)

module.exports = router