// routes/reports.js
const express = require('express')
const router = express.Router()
const { getGeneralReport, getPopularCourses } = require('../controllers/reportsController')
const { authenticateToken, requireRole } = require('../middleware/auth')

router.get('/general', authenticateToken, requireRole(['admin']), getGeneralReport)
router.get('/popular-courses', authenticateToken, requireRole(['admin']), getPopularCourses)

module.exports = router