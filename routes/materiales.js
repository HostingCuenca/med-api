// routes/materiales.js - COMPLETO 100%
const express = require('express')
const router = express.Router()
const {
    getMaterialesByCourse,
    getMarketplaceMaterials,
    getMaterialDetail,
    getMisMateriales,
    createMaterial,
    generateWhatsAppLink,
    addToCart,
    getCart,
    removeFromCart,
    clearCart, getMaterialForEdit, updateMaterial, deleteMaterials
} = require('../controllers/materialesController')
const { authenticateToken } = require('../middleware/auth')

// ==================== MIDDLEWARE DE LOGGING ====================
router.use((req, res, next) => {
    console.log(`📚 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('📝 Body:', JSON.stringify(req.body, null, 2))
    }
    next()
})

// ==================== RUTAS PÚBLICAS (MARKETPLACE) ====================

// Marketplace público - materiales libres y premium
router.get('/marketplace', getMarketplaceMaterials)

// Detalle de material (público pero verifica acceso)
router.get('/:materialId/detail', getMaterialDetail)

// ==================== RUTAS PARA USUARIOS AUTENTICADOS ====================

// Obtener materiales por curso (solo inscritos)
router.get('/course/:cursoId',
    authenticateToken,
    getMaterialesByCourse
)

// Mis materiales (de cursos inscritos)
router.get('/my-materials',
    authenticateToken,
    getMisMateriales
)



router.get('/:materialId/edit',
    authenticateToken,
    getMaterialForEdit
)

// Actualizar material existente
router.put('/:materialId',
    authenticateToken,
    updateMaterial
)

// // Eliminar material individual
// router.delete('/:materialId',
//     authenticateToken,
//     deleteMaterial
// )

// Eliminación masiva de materiales (solo admin)
// router.delete('/bulk/delete',
//     authenticateToken,
//     deleteMaterials
// )

router.post('/bulk/delete',
    authenticateToken,
    deleteMaterials
)

// ==================== CARRITO SIMBÓLICO ====================

// Agregar material al carrito
router.post('/cart/add', addToCart)

// Ver carrito actual
router.get('/cart', getCart)

// Remover item del carrito
router.delete('/cart/:itemId', removeFromCart)

// Limpiar carrito completo
router.delete('/cart', clearCart)

// Generar link de WhatsApp con carrito
router.post('/cart/whatsapp', generateWhatsAppLink)

// ==================== RUTAS ADMINISTRATIVAS ====================

// Crear material (solo admin/instructor)
router.post('/create',
    authenticateToken,
    createMaterial
)

// ==================== MIDDLEWARE DE MANEJO DE ERRORES ====================
router.use((error, req, res, next) => {
    console.error('🚨 Error en materiales:', error)
    res.status(500).json({
        success: false,
        message: 'Error interno en materiales',
        timestamp: new Date().toISOString(),
        endpoint: req.originalUrl,
        method: req.method,
        ...(process.env.NODE_ENV === 'development' && {
            error: error.message,
            stack: error.stack
        })
    })
})

// ==================== DOCUMENTACIÓN DE ENDPOINTS ====================
router.get('/docs', (req, res) => {
    res.json({
        title: 'Materiales API Documentation',
        version: '1.0.0',
        description: 'API para gestión de materiales: cursos, marketplace y carrito simbólico',
        baseUrl: '/med-api/materiales',
        authentication: 'Bearer Token para rutas protegidas, públicas para marketplace',
        features: ['Materiales por curso', 'Marketplace público', 'Carrito simbólico', 'Integración WhatsApp'],
        endpoints: {
            'GET /marketplace': {
                description: 'Marketplace público de materiales libres y premium',
                authentication: 'No requerida',
                query: {
                    categoria: 'Filtrar por categoría',
                    tipo: 'Filtrar por tipo (libre/premium)',
                    search: 'Buscar en título y descripción',
                    page: 'Número de página (default: 1)',
                    limit: 'Límite por página (default: 12, max: 50)'
                },
                response: 'Lista paginada de materiales con categorías disponibles'
            },
            'GET /:materialId/detail': {
                description: 'Detalle de material con verificación de acceso',
                authentication: 'Opcional - mejora la experiencia si está logueado',
                parameters: {
                    materialId: 'UUID del material'
                },
                response: 'Detalle completo con información de acceso'
            },
            'GET /course/:cursoId': {
                description: 'Materiales de un curso específico',
                authentication: 'Bearer Token requerido',
                parameters: {
                    cursoId: 'UUID del curso'
                },
                response: 'Lista de materiales del curso (solo para inscritos)'
            },
            'GET /my-materials': {
                description: 'Todos mis materiales de cursos inscritos',
                authentication: 'Bearer Token requerido',
                response: 'Lista de materiales accesibles por inscripciones'
            },
            'POST /cart/add': {
                description: 'Agregar material al carrito simbólico',
                authentication: 'No requerida',
                body: {
                    materialId: 'UUID del material',
                    cantidad: 'Cantidad (default: 1)',
                    sessionId: 'ID de sesión para usuarios no logueados (generado por frontend)'
                },
                response: 'Confirmación de agregado al carrito'
            },
            'GET /cart': {
                description: 'Ver contenido del carrito actual',
                authentication: 'No requerida',
                query: {
                    sessionId: 'ID de sesión (para usuarios no logueados)'
                },
                headers: {
                    authorization: 'Bearer token (para usuarios logueados) - opcional'
                },
                response: 'Lista de items en carrito con totales'
            },
            'DELETE /cart/:itemId': {
                description: 'Remover item específico del carrito',
                authentication: 'No requerida',
                parameters: {
                    itemId: 'UUID del item en carrito'
                },
                response: 'Confirmación de eliminación'
            },
            'DELETE /cart': {
                description: 'Limpiar carrito completo',
                authentication: 'No requerida',
                query: {
                    sessionId: 'ID de sesión (requerido para usuarios no logueados)'
                },
                response: 'Confirmación de limpieza'
            },
            'POST /cart/whatsapp': {
                description: 'Generar link de WhatsApp para compra',
                authentication: 'No requerida',
                body: {
                    materiales: 'Array de {id, cantidad} de materiales',
                    datosUsuario: {
                        nombre: 'Nombre completo del cliente',
                        email: 'Email de contacto',
                        telefono: 'Teléfono (opcional)',
                        mensaje_adicional: 'Mensaje adicional (opcional)'
                    }
                },
                response: 'Link de WhatsApp generado con mensaje preformateado'
            },
            'POST /create': {
                description: 'Crear nuevo material (solo admin/instructor)',
                authentication: 'Bearer Token requerido',
                body: {
                    titulo: 'Título del material',
                    descripcion: 'Descripción detallada',
                    archivoUrl: 'URL del archivo (Google Drive, etc.)',
                    tipoArchivo: 'Extensión del archivo',
                    precio: 'Precio (0 para gratuito)',
                    tipoMaterial: 'curso/libre/premium',
                    categoria: 'Categoría del material',
                    cursoId: 'UUID del curso (solo para tipo "curso")',
                    imagenUrl: 'URL de imagen de portada (opcional)',
                    visiblePublico: 'Boolean - aparece en marketplace'
                },
                response: 'Material creado exitosamente'
            }
        },
        tipos_material: {
            'curso': {
                description: 'Material vinculado a curso específico',
                acceso: 'Solo usuarios inscritos en el curso',
                marketplace: 'No aparece en marketplace público'
            },
            'libre': {
                description: 'Material de descarga gratuita',
                acceso: 'Cualquier usuario puede descargar',
                marketplace: 'Aparece en marketplace si visible_publico = true'
            },
            'premium': {
                description: 'Material de pago via WhatsApp',
                acceso: 'Se "compra" mediante carrito simbólico',
                marketplace: 'Aparece en marketplace, se añade al carrito'
            }
        },
        flujo_carrito: {
            paso1: 'Usuario navega marketplace → GET /marketplace',
            paso2: 'Ve detalle de material → GET /:materialId/detail',
            paso3: 'Agrega al carrito → POST /cart/add',
            paso4: 'Ve carrito → GET /cart',
            paso5: 'Llena formulario y genera WhatsApp → POST /cart/whatsapp',
            paso6: 'Se redirige a WhatsApp con mensaje preformateado'
        },
        ejemplos: {
            marketplace_request: {
                url: 'GET /marketplace?categoria=medicina&tipo=premium&page=1&limit=12',
                response: {
                    success: true,
                    data: {
                        materiales: '...',
                        categorias_disponibles: '...',
                        pagination: '...'
                    }
                }
            },
            carrito_add: {
                url: 'POST /cart/add',
                body: {
                    materialId: 'uuid-material',
                    cantidad: 2,
                    sessionId: 'session_12345'
                },
                response: {
                    success: true,
                    message: 'Material agregado al carrito',
                    data: { itemsCount: 3, total: 75.50 }
                }
            },
            whatsapp_generation: {
                url: 'POST /cart/whatsapp',
                body: {
                    materiales: [
                        { id: 'uuid-material-1', cantidad: 1 },
                        { id: 'uuid-material-2', cantidad: 2 }
                    ],
                    datosUsuario: {
                        nombre: 'Juan Pérez',
                        email: 'juan@email.com',
                        telefono: '0999999999',
                        mensaje_adicional: 'Necesito urgente'
                    }
                },
                response: {
                    success: true,
                    data: {
                        whatsapp_link: 'https://wa.me/593999999999?text=...',
                        mensaje_preview: '¡Hola! Me interesa adquirir...',
                        resumen: { total_materiales: 2, total_precio: '75.50' }
                    }
                }
            }
        },
        configuracion: {
            whatsapp_business: 'Configurar WHATSAPP_BUSINESS_NUMBER en .env',
            session_management: 'Frontend debe generar sessionId único para usuarios no logueados',
            file_storage: 'Archivos se almacenan externamente (Google Drive, etc.)'
        }
    })
})

// ==================== ENDPOINT DE SALUD ====================
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'materiales-marketplace',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        endpoints_available: 9,
        features: [
            'Materiales por curso',
            'Marketplace público',
            'Carrito simbólico',
            'Integración WhatsApp',
            'Categorización automática',
            'Búsqueda y filtros',
            'Paginación optimizada',
            'Control de acceso granular',
            'Soporte multi-tipo de archivo'
        ],
        stats: {
            tipos_soportados: ['curso', 'libre', 'premium'],
            formatos_archivo: 'PDF, DOC, XLS, PPT, ZIP, Imágenes, Videos, Audio',
            metodos_pago: 'WhatsApp Business (manual)',
            categorias: 'Dinámicas según contenido'
        }
    })
})

module.exports = router