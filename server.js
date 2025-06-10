// server.js - Mediconsa API 100% Completa
const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Test route
app.get('/', (req, res) => {
    res.json({
        message: 'Mediconsa API 100% Completa 🏥',
        version: '1.0.0',
        features: [
            'Autenticación completa',
            'Gestión de cursos y contenido',
            'Sistema de inscripciones',
            'Simulacros interactivos',
            'Tracking de progreso',
            'Dashboard admin y estudiante',
            'Aprobación de pagos',
            'Reportes y estadísticas'
        ],
        endpoints: {
            auth: '/med-api/auth',
            courses: '/med-api/courses',
            courseManagement: '/med-api/course-management',
            enrollments: '/med-api/enrollments',
            simulacros: '/med-api/simulacros',
            progress: '/med-api/progress',
            dashboard: '/med-api/dashboard'
        },
        timestamp: new Date().toISOString()
    })
})

// Routes
app.use('/med-api/auth', require('./routes/auth'))
app.use('/med-api/courses', require('./routes/courses'))
app.use('/med-api/course-management', require('./routes/courseManagement'))
app.use('/med-api/enrollments', require('./routes/enrollments'))
app.use('/med-api/simulacros', require('./routes/simulacros'))
app.use('/med-api/progress', require('./routes/progress'))
app.use('/med-api/dashboard', require('./routes/dashboard'))

// Error handling
app.use((err, req, res, next) => {
    console.error('Error stack:', err.stack)
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
    })
})

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Endpoint ${req.originalUrl} no encontrado`,
        availableEndpoints: [
            '/med-api/auth',
            '/med-api/courses',
            '/med-api/course-management',
            '/med-api/enrollments',
            '/med-api/simulacros',
            '/med-api/progress',
            '/med-api/dashboard'
        ]
    })
})

app.listen(PORT, () => {
    console.log(`🚀 Servidor Mediconsa corriendo en puerto ${PORT}`)
    console.log(`📍 URL: http://localhost:${PORT}`)
    console.log(`🔐 Auth: http://localhost:${PORT}/med-api/auth`)
    console.log(`📚 Courses: http://localhost:${PORT}/med-api/courses`)
    console.log(`⚙️ Course Management: http://localhost:${PORT}/med-api/course-management`)
    console.log(`📝 Enrollments: http://localhost:${PORT}/med-api/enrollments`)
    console.log(`🧪 Simulacros: http://localhost:${PORT}/med-api/simulacros`)
    console.log(`📊 Progress: http://localhost:${PORT}/med-api/progress`)
    console.log(`📈 Dashboard: http://localhost:${PORT}/med-api/dashboard`)
    console.log('✅ Backend Mediconsa 100% COMPLETO Y LISTO')
})