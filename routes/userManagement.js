// routes/userManagement.js
const express = require('express')
const router = express.Router()
const { getAllUsers, changeUserRole, toggleUserStatus, getUserStats } = require('../controllers/userManagementController')
const { authenticateToken, requireRole } = require('../middleware/auth')

router.get('/', authenticateToken, requireRole(['admin']), getAllUsers)
router.patch('/:userId/role', authenticateToken, requireRole(['admin']), changeUserRole)
router.patch('/:userId/toggle', authenticateToken, requireRole(['admin']), toggleUserStatus)
router.get('/stats', authenticateToken, requireRole(['admin']), getUserStats)

module.exports = router