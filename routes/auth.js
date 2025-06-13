// routes/auth.js
const express = require('express')
const router = express.Router()
const { register, login, getProfile, updateProfile, changePassword } = require('../controllers/authController')

const { authenticateToken } = require('../middleware/auth')

router.post('/register', register)
router.post('/login', login)
router.get('/profile', authenticateToken, getProfile)


router.put('/profile', authenticateToken, updateProfile)
router.put('/change-password', authenticateToken, changePassword)

module.exports = router