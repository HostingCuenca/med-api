// routes/progress.js - CORREGIDO
const express = require('express')
const router = express.Router()
const {
    updateClassProgress,
    getCourseProgress,
    getMyOverallProgress
} = require('../controllers/progressController')
const { authenticateToken } = require('../middleware/auth')

// Actualizar progreso de clase
router.patch('/class/:claseId', authenticateToken, updateClassProgress)

// Obtener progreso por curso
router.get('/course/:cursoId', authenticateToken, getCourseProgress)

// Obtener progreso general
router.get('/my-overall', authenticateToken, getMyOverallProgress)

module.exports = router