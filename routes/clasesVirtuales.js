// routes/clasesVirtuales.js
const express = require('express')
const router = express.Router()
const {
    getClasesVirtualesByCourse,
    getMisClasesVirtuales,
    getClaseVirtualDetail,
    createClaseVirtual,
    updateClaseVirtual,      // NUEVO
    deleteClaseVirtual       // NUEVO
} = require('../controllers/clasesVirtualesController')
const { authenticateToken } = require('../middleware/auth')

// ==================== MIDDLEWARE DE LOGGING ====================
router.use((req, res, next) => {
    console.log(`💻 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('📝 Body:', JSON.stringify(req.body, null, 2))
    }
    next()
})

// ==================== RUTAS PARA ESTUDIANTES ====================

// Obtener clases virtuales por curso
router.get('/course/:cursoId',
    authenticateToken,
    getClasesVirtualesByCourse
)

// Obtener mis clases virtuales (todos los cursos)
router.get('/my-classes',
    authenticateToken,
    getMisClasesVirtuales
)

// Obtener detalle y verificar acceso a clase virtual
router.get('/:claseId/detail',
    authenticateToken,
    getClaseVirtualDetail
)

// ==================== RUTAS ADMINISTRATIVAS ====================

// Crear clase virtual (admin/instructor)
router.post('/create',
    authenticateToken,
    createClaseVirtual
)

// Actualizar clase virtual (admin/instructor) - NUEVO
router.put('/:claseId',
    authenticateToken,
    updateClaseVirtual
)

// Eliminar clase virtual (admin/instructor) - NUEVO
router.delete('/:claseId',
    authenticateToken,
    deleteClaseVirtual
)

// ==================== MIDDLEWARE DE MANEJO DE ERRORES ====================
router.use((error, req, res, next) => {
    console.error('🚨 Error en clases virtuales:', error)
    res.status(500).json({
        success: false,
        message: 'Error interno en clases virtuales',
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