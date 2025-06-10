// routes/simulacros.js
const express = require('express')
const router = express.Router()
const {
    getSimulacrosByCourse,
    getSimulacroQuestions,
    submitSimulacro,
    getMyAttempts,
    getAttemptDetail
} = require('../controllers/simulacroController')
const { authenticateToken } = require('../middleware/auth')

router.get('/course/:cursoId', authenticateToken, getSimulacrosByCourse)
router.get('/:simulacroId/questions', authenticateToken, getSimulacroQuestions)
router.post('/:simulacroId/submit', authenticateToken, submitSimulacro)
router.get('/my-attempts', authenticateToken, getMyAttempts)
router.get('/attempt/:intentoId', authenticateToken, getAttemptDetail)

module.exports = router