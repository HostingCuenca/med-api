// routes/userManagement.js
const express = require('express')
const router = express.Router()
const { getAllUsers, changeUserRole, toggleUserStatus, getUserStats, getUserById, createUser, updateUser, deleteUser,
    getUserProgress, resetUserPassword
} = require('../controllers/userManagementController')
const { authenticateToken, requireRole } = require('../middleware/auth')

// routes/userManagement.js
router.get('/', authenticateToken, requireRole(['admin']), getAllUsers)
router.get('/stats', authenticateToken, requireRole(['admin']), getUserStats)
router.get('/:userId', authenticateToken, requireRole(['admin']), getUserById)
router.post('/', authenticateToken, requireRole(['admin']), createUser)
router.put('/:userId', authenticateToken, requireRole(['admin']), updateUser)
router.patch('/:userId/role', authenticateToken, requireRole(['admin']), changeUserRole)
router.patch('/:userId/status', authenticateToken, requireRole(['admin']), toggleUserStatus)
router.patch('/:userId/password', authenticateToken, requireRole(['admin']), resetUserPassword)
router.get('/:userId/progress', authenticateToken, requireRole(['admin']), getUserProgress)
router.delete('/:userId', authenticateToken, requireRole(['admin']), deleteUser)


module.exports = router