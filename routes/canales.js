// routes/canales.js
const express = require('express')
const router = express.Router()
const {
    getCanalesByCourse,
    getMisCanales,
    getCanalDetail,
    createCanal
} = require('../controllers/canalesComunicacionController')
const { authenticateToken } = require('../middleware/auth')

// ==================== MIDDLEWARE DE LOGGING ====================
router.use((req, res, next) => {
    console.log(`💬 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('📝 Body:', JSON.stringify(req.body, null, 2))
    }
    next()
})

// ==================== RUTAS PARA ESTUDIANTES ====================

// Obtener canales por curso
router.get('/course/:cursoId',
    authenticateToken,
    getCanalesByCourse
)

// Obtener mis canales (todos los cursos)
router.get('/my-channels',
    authenticateToken,
    getMisCanales
)

// Obtener detalle y verificar acceso a canal
router.get('/:canalId/detail',
    authenticateToken,
    getCanalDetail
)

// ==================== RUTAS ADMINISTRATIVAS ====================

// Crear canal (admin/instructor)
router.post('/create',
    authenticateToken,
    createCanal
)

// ==================== MIDDLEWARE DE MANEJO DE ERRORES ====================
router.use((error, req, res, next) => {
    console.error('🚨 Error en canales:', error)
    res.status(500).json({
        success: false,
        message: 'Error interno en canales',
        timestamp: new Date().toISOString(),
        endpoint: req.originalUrl,
        method: req.method,
        ...(process.env.NODE_ENV === 'development' && {
            error: error.message,
            stack: error.stack
        })
    })
})

module.exports = router