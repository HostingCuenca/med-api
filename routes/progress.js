// routes/progress.js
const express = require('express')
const router = express.Router()
const {
    updateClassProgress,
    getCourseProgress,
    getMyOverallProgress
} = require('../controllers/progressController')
const { authenticateToken } = require('../middleware/auth')

router.patch('/class/:claseId', authenticateToken, updateClassProgress)
router.get('/course/:cursoId', authenticateToken, getCourseProgress)
router.get('/my-overall', authenticateToken, getMyOverallProgress)

module.exports = router