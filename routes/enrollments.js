// routes/enrollments.js
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

router.post('/', authenticateToken, enrollCourse)
router.get('/my', authenticateToken, getMyEnrollments)
router.get('/pending', authenticateToken, requireRole(['admin']), getPendingPayments)
router.patch('/:inscripcionId/approve', authenticateToken, requireRole(['admin']), approvePayment)
router.get('/check-access/:cursoId', authenticateToken, checkCourseAccess)

module.exports = router