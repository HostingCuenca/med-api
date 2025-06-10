// controllers/reportsController.js
const pool = require('../config/database')

// =============================================
// REPORTE GENERAL
// =============================================
const getGeneralReport = async (req, res) => {
    try {
        const [usuarios, cursos, inscripciones, simulacros] = await Promise.all([
            pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN activo = true THEN 1 END) as activos,
          COUNT(CASE WHEN fecha_registro >= NOW() - INTERVAL '30 days' THEN 1 END) as nuevos_mes
        FROM perfiles_usuario
      `),
            pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN activo = true THEN 1 END) as activos,
          COUNT(CASE WHEN es_gratuito = true THEN 1 END) as gratuitos,
          AVG(precio) as precio_promedio
        FROM cursos
      `),
            pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN estado_pago = 'habilitado' THEN 1 END) as habilitadas,
          COUNT(CASE WHEN estado_pago = 'pendiente' THEN 1 END) as pendientes,
          SUM(CASE WHEN estado_pago = 'habilitado' THEN c.precio ELSE 0 END) as ingresos_totales
        FROM inscripciones i
        JOIN cursos c ON i.curso_id = c.id
      `),
            pool.query(`
        SELECT 
          COUNT(DISTINCT s.id) as total_simulacros,
          COUNT(DISTINCT ia.id) as total_intentos,
          AVG(ia.puntaje) as puntaje_promedio
        FROM simulacros s
        LEFT JOIN intentos_simulacro ia ON s.id = ia.simulacro_id
      `)
        ])

        res.json({
            success: true,
            data: {
                usuarios: usuarios.rows[0],
                cursos: cursos.rows[0],
                inscripciones: inscripciones.rows[0],
                simulacros: simulacros.rows[0]
            }
        })

    } catch (error) {
        console.error('Error generando reporte:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

// =============================================
// CURSOS MÁS POPULARES
// =============================================
const getPopularCourses = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT c.id, c.titulo, c.precio, c.es_gratuito,
        COUNT(i.id) as total_inscripciones,
        COUNT(CASE WHEN i.estado_pago = 'habilitado' THEN 1 END) as inscripciones_activas,
        AVG(ia.puntaje) as puntaje_promedio_simulacros
      FROM cursos c
      LEFT JOIN inscripciones i ON c.id = i.curso_id
      LEFT JOIN simulacros s ON c.id = s.curso_id
      LEFT JOIN intentos_simulacro ia ON s.id = ia.simulacro_id
      WHERE c.activo = true
      GROUP BY c.id
      ORDER BY total_inscripciones DESC
      LIMIT 10
    `)

        res.json({
            success: true,
            data: { cursosPopulares: result.rows }
        })

    } catch (error) {
        console.error('Error obteniendo cursos populares:', error)
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        })
    }
}

module.exports = { getGeneralReport, getPopularCourses }