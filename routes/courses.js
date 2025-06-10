// routes/courses.js
const express = require('express')
const router = express.Router()
const { getCourses, getCourseById, createCourse } = require('../controllers/courseController')
const { authenticateToken, requireRole } = require('../middleware/auth')

router.get('/', getCourses)
router.get('/:id', getCourseById)
router.post('/', authenticateToken, requireRole(['admin', 'instructor']), createCourse)

module.exports = router