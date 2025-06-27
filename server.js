
// server.js - Servidor completo
const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 5001

// =====================================================
// CONFIGURACIÓN CORS SIMPLE - PERMITE TODOS LOS ORÍGENES
// =====================================================
const corsOptions = {
    origin: '*',                    // ✅ Permite TODOS los orígenes (temporal)
    credentials: false,             // ⚠️ Debe ser false cuando origin es '*'
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Access-Token'
    ],
    optionsSuccessStatus: 200
}

// CONFIGURACIÓN ALTERNATIVA MÁS ESPECÍFICA (para usar después)
const corsOptionsSecure = {
    origin: [
        'http://localhost:3000',              // Desarrollo local
        'http://localhost:3001',
        'https://mediconsa-lovat.vercel.app', // ✅ Tu dominio Vercel
        'http://159.112.148.177:3000',        // IP servidor
        'http://159.112.148.177',
        'https://159.112.148.177'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Access-Token'
    ],
    optionsSuccessStatus: 200
}

// =====================================================
// MIDDLEWARE CORS SUPER PERMISIVO (TEMPORAL)
// =====================================================

// CORS Manual - Más agresivo
app.use((req, res, next) => {
    // Permitir TODOS los orígenes
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*')

    // Permitir TODOS los headers
    res.header('Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Access-Token, Cache-Control'
    )

    // Permitir TODOS los métodos
    res.header('Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD'
    )

    // Permitir credentials
    res.header('Access-Control-Allow-Credentials', 'true')

    // Manejar preflight requests
    if (req.method === 'OPTIONS') {
        console.log('🔄 Preflight request from:', req.headers.origin)
        return res.status(200).end()
    }

    console.log(`${req.method} ${req.path} - Origin: ${req.get('origin')}`)
    next()
})

// Aplicar CORS del módulo también (doble protección)
app.use(cors(corsOptions))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Headers adicionales
app.use((req, res, next) => {
    res.header('X-Powered-By', 'Mediconsa Academy')
    next()
})

// =====================================================
// RUTA DE HEALTH CHECK
// =====================================================
app.get('/', (req, res) => {
    res.json({
        message: 'Mediconsa API 100% Completa 🏥',
        version: '1.0.0',
        status: 'ONLINE',
        timestamp: new Date().toISOString(),
        server: {
            port: PORT,
            environment: process.env.NODE_ENV || 'development',
            cors: 'ENABLED'
        },
        features: [
            'Autenticación completa',
            'Gestión de cursos y contenido',
            'Sistema de inscripciones',
            'Simulacros interactivos',
            'Tracking de progreso',
            'Dashboard admin y estudiante',
            'Aprobación de pagos',
            'Reportes y estadísticas',
            'Gestión de usuarios',
            'CORS configurado'
        ],
        endpoints: {
            auth: '/med-api/auth',
            courses: '/med-api/courses',
            courseManagement: '/med-api/course-management',
            enrollments: '/med-api/enrollments',
            simulacros: '/med-api/simulacros',
            progress: '/med-api/progress',
            dashboard: '/med-api/dashboard',
            userManagement: '/med-api/users',
            reports: '/med-api/reports',
            materiales: '/med-api/materiales',
            clasesVirtuales: '/med-api/clases-virtuales',
            canales: '/med-api/canales'
        }
    })
})

// Health check específico
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    })
})

// =====================================================
// RUTAS PRINCIPALES
// =====================================================

// Autenticación
app.use('/med-api/auth', require('./routes/auth'))

// Cursos (públicos)
app.use('/med-api/courses', require('./routes/courses'))

// Gestión de cursos (admin/instructor)
app.use('/med-api/course-management', require('./routes/courseManagement'))

// Inscripciones
app.use('/med-api/enrollments', require('./routes/enrollments'))

// Simulacros y exámenes
app.use('/med-api/simulacros', require('./routes/simulacros'))

// Progreso de estudiantes
app.use('/med-api/progress', require('./routes/progress'))

// Dashboard
app.use('/med-api/dashboard', require('./routes/dashboard'))

// Gestión de usuarios (admin)
app.use('/med-api/users', require('./routes/userManagement'))

// Reportes (admin/instructor)
app.use('/med-api/reports', require('./routes/reports'))


app.use('/med-api/materiales', require('./routes/materiales'))

// Clases virtuales
app.use('/med-api/clases-virtuales', require('./routes/clasesVirtuales'))

// Canales de comunicación
app.use('/med-api/canales', require('./routes/canales'))

// =====================================================
// MANEJO DE ERRORES
// =====================================================

// Error de CORS específico
app.use((err, req, res, next) => {
    if (err.message === 'No permitido por CORS') {
        return res.status(403).json({
            success: false,
            message: 'Acceso no permitido por política CORS',
            origin: req.get('origin'),
            allowedOrigins: process.env.NODE_ENV === 'development' ?
                ['*'] : ['mediconsaacademy.com', '159.112.148.177']
        })
    }
    next(err)
})

// Error handler general
app.use((err, req, res, next) => {
    console.error('❌ Error stack:', err.stack)

    const isDevelopment = process.env.NODE_ENV === 'development'

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Error interno del servidor',
        ...(isDevelopment && {
            error: err.message,
            stack: err.stack
        }),
        timestamp: new Date().toISOString()
    })
})

// =====================================================
// 404 HANDLER
// =====================================================
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Endpoint ${req.originalUrl} no encontrado`,
        method: req.method,
        availableEndpoints: [
            'GET    /',
            'GET    /health',
            'POST   /med-api/auth/login',
            'POST   /med-api/auth/register',
            'GET    /med-api/auth/profile',
            'GET    /med-api/courses',
            'GET    /med-api/courses/:id',
            'POST   /med-api/course-management',
            'GET    /med-api/enrollments',
            'POST   /med-api/enrollments',
            'GET    /med-api/simulacros',
            'GET    /med-api/progress',
            'GET    /med-api/dashboard',
            'GET    /med-api/users',
            'GET    /med-api/reports'
        ],
        timestamp: new Date().toISOString()
    })
})

// =====================================================
// INICIAR SERVIDOR
// =====================================================
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 =====================================')
    console.log('🏥 SERVIDOR MEDICONSA ACADEMY INICIADO')
    console.log('=====================================')
    console.log(`📍 URL Principal: http://localhost:${PORT}`)
    console.log(`🌐 IP Externa: http://159.112.148.177:${PORT}`)
    console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`)
    console.log(`🛡️  CORS: HABILITADO`)
    console.log('\n📡 ENDPOINTS DISPONIBLES:')
    console.log(`   🔐 Auth: http://localhost:${PORT}/med-api/auth`)
    console.log(`   📚 Courses: http://localhost:${PORT}/med-api/courses`)
    console.log(`   ⚙️  Course Mgmt: http://localhost:${PORT}/med-api/course-management`)
    console.log(`   📝 Enrollments: http://localhost:${PORT}/med-api/enrollments`)
    console.log(`   🧪 Simulacros: http://localhost:${PORT}/med-api/simulacros`)
    console.log(`   📊 Progress: http://localhost:${PORT}/med-api/progress`)
    console.log(`   📈 Dashboard: http://localhost:${PORT}/med-api/dashboard`)
    console.log(`   👥 Users: http://localhost:${PORT}/med-api/users`)
    console.log(`   📋 Reports: http://localhost:${PORT}/med-api/reports`)
    console.log('\n✅ SERVIDOR 100% OPERATIVO')
    console.log('=====================================\n')
})

// =====================================================
// MANEJO GRACEFUL DE CIERRE
// =====================================================
process.on('SIGTERM', () => {
    console.log('💤 Cerrando servidor gracefully...')
    server.close(() => {
        console.log('✅ Servidor cerrado correctamente')
        process.exit(0)
    })
})

process.on('SIGINT', () => {
    console.log('\n💤 Ctrl+C presionado, cerrando servidor...')
    server.close(() => {
        console.log('✅ Servidor cerrado correctamente')
        process.exit(0)
    })
})

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
    console.error('❌ Excepción no capturada:', err)
    process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rechazada no manejada:', reason)
    process.exit(1)
})

module.exports = app