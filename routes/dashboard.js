// routes/dashboard.js - CORREGIDO
const express = require('express')
const router = express.Router()
const { getStudentDashboard, getAdminDashboard } = require('../controllers/dashboardController')
const { authenticateToken, requireRole } = require('../middleware/auth')

// CAMBIO: Frontend espera GET /dashboard (sin /student)
router.get('/', authenticateToken, (req, res) => {
    // Detectar automáticamente según el rol del usuario
    if (req.user.tipo_usuario === 'admin') {
        return getAdminDashboard(req, res)
    } else {
        return getStudentDashboard(req, res)
    }
})

// Endpoints específicos por si los necesitas después
router.get('/student', authenticateToken, getStudentDashboard)
router.get('/admin', authenticateToken, requireRole(['admin']), getAdminDashboard)

module.exports = router