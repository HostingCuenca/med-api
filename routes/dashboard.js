// routes/dashboard.js
const express = require('express')
const router = express.Router()
const { getStudentDashboard, getAdminDashboard } = require('../controllers/dashboardController')
const { authenticateToken, requireRole } = require('../middleware/auth')

router.get('/student', authenticateToken, getStudentDashboard)
router.get('/admin', authenticateToken, requireRole(['admin']), getAdminDashboard)

module.exports = router