// routes/reports.js - ACTUALIZADO CON TODAS LAS RUTAS
const express = require('express')
const router = express.Router()
const {
    getGeneralReport,
    getPopularCourses,
    getProgressReport,      // NUEVO
    getFinancialReport,     // NUEVO
    getActivityReport       // NUEVO
} = require('../controllers/reportsController')
const { authenticateToken, requireRole } = require('../middleware/auth')

// ==================== REPORTES PRINCIPALES ====================
// Reporte general del sistema
router.get('/general', authenticateToken, requireRole(['admin']), getGeneralReport)

// Cursos más populares
router.get('/popular-courses', authenticateToken, requireRole(['admin']), getPopularCourses)

// Reporte de progreso de estudiantes
router.get('/progress', authenticateToken, requireRole(['admin']), getProgressReport)

// Reporte financiero
router.get('/financial', authenticateToken, requireRole(['admin']), getFinancialReport)

// Reporte de actividad
router.get('/activity', authenticateToken, requireRole(['admin']), getActivityReport)

module.exports = router