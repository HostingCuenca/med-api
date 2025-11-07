# 🚀 Guía de Implementación Frontend - Sistema de Temporadas

## 📝 Información General
**Fecha:** ${new Date().toLocaleDateString('es-ES')}
**Cambio Principal:** Se agregó control de acceso por temporadas mediante el campo `acceso_activo`

---

## 🎯 ¿Qué cambió?

Antes los usuarios con `estado_pago = 'habilitado'` tenían acceso permanente.

Ahora necesitan **dos condiciones**:
1. `estado_pago = 'habilitado'` (pagaron)
2. `acceso_activo = true` (temporada activa)

---

## 📊 PASO 1: Actualizar el GET de inscripciones (Admin Dashboard)

### Endpoint actual:
```
GET /med-api/enrollments/admin/all
```

### ❌ Respuesta ANTES:
```json
{
  "success": true,
  "data": {
    "inscripciones": [
      {
        "id": "abc-123",
        "usuario_id": "user-456",
        "curso_id": "curso-789",
        "estado_pago": "habilitado",
        "nombre_completo": "Juan Pérez",
        "email": "juan@email.com",
        "curso_titulo": "Curso ENARM 2024",
        "precio": 50,
        "fecha_inscripcion": "2024-01-15T10:00:00",
        "fecha_habilitacion": "2024-01-16T14:30:00"
      }
    ],
    "statistics": {
      "total_inscripciones": 100,
      "pendientes": 10,
      "habilitadas": 80,
      "rechazadas": 10,
      "ingresos_totales": 5000,
      "ingresos_pendientes": 500
    }
  }
}
```

### ✅ Respuesta AHORA:
```json
{
  "success": true,
  "data": {
    "inscripciones": [
      {
        "id": "abc-123",
        "usuario_id": "user-456",
        "curso_id": "curso-789",
        "estado_pago": "habilitado",
        "acceso_activo": true,              // ✅ NUEVO CAMPO
        "tiene_acceso_actual": true,        // ✅ NUEVO CAMPO (calculado)
        "nombre_completo": "Juan Pérez",
        "email": "juan@email.com",
        "curso_titulo": "Curso ENARM 2024",
        "precio": 50,
        "fecha_inscripcion": "2024-01-15T10:00:00",
        "fecha_habilitacion": "2024-01-16T14:30:00"
      }
    ],
    "statistics": {
      "total_inscripciones": 100,
      "pendientes": 10,
      "habilitadas": 80,
      "rechazadas": 10,
      "accesos_activos": 60,              // ✅ NUEVO
      "accesos_inactivos": 20,            // ✅ NUEVO
      "ingresos_totales": 5000,
      "ingresos_pendientes": 500
    }
  }
}
```

### 🔧 Cambios en el código Frontend:

#### Opción A - Cambio Mínimo (Compatible con versión anterior):
```jsx
// ✅ Usar el campo calculado
<Badge color={inscripcion.tiene_acceso_actual ? 'success' : 'warning'}>
  {inscripcion.tiene_acceso_actual ? 'Activo' : 'Inactivo'}
</Badge>
```

#### Opción B - Cambio Completo (Más control):
```jsx
// Determinar badge según estado
const getBadgeEstado = (inscripcion) => {
  if (inscripcion.estado_pago === 'pendiente') {
    return { label: 'Pendiente', color: 'info' }
  }

  if (inscripcion.estado_pago === 'rechazado') {
    return { label: 'Rechazado', color: 'error' }
  }

  if (inscripcion.estado_pago === 'habilitado') {
    if (inscripcion.acceso_activo) {
      return { label: 'Activo', color: 'success' }
    } else {
      return { label: 'Inactivo', color: 'warning' }
    }
  }

  return { label: 'Desconocido', color: 'default' }
}

// En el componente
const estado = getBadgeEstado(inscripcion)
<Badge color={estado.color}>{estado.label}</Badge>
```

#### Agregar columna de acciones:
```jsx
<TableCell>
  {inscripcion.estado_pago === 'habilitado' && inscripcion.acceso_activo && (
    <Button
      size="small"
      color="warning"
      onClick={() => desactivarAcceso([inscripcion.id])}
    >
      Desactivar
    </Button>
  )}

  {inscripcion.estado_pago === 'habilitado' && !inscripcion.acceso_activo && (
    <Button
      size="small"
      color="success"
      onClick={() => reactivarAcceso([inscripcion.id])}
    >
      Reactivar
    </Button>
  )}
</TableCell>
```

---

## 📊 PASO 2: Actualizar Estadísticas (Admin Dashboard)

### Agregar nuevas métricas:

```jsx
// Antes
<Grid container spacing={2}>
  <Grid item xs={4}>
    <Card>
      <CardContent>
        <Typography variant="h6">Total</Typography>
        <Typography variant="h3">{stats.total_inscripciones}</Typography>
      </CardContent>
    </Card>
  </Grid>

  <Grid item xs={4}>
    <Card>
      <CardContent>
        <Typography variant="h6">Pendientes</Typography>
        <Typography variant="h3">{stats.pendientes}</Typography>
      </CardContent>
    </Card>
  </Grid>

  <Grid item xs={4}>
    <Card>
      <CardContent>
        <Typography variant="h6">Habilitadas</Typography>
        <Typography variant="h3">{stats.habilitadas}</Typography>
      </CardContent>
    </Card>
  </Grid>
</Grid>

// ✅ Ahora agregar:
<Grid container spacing={2}>
  <Grid item xs={3}>
    <Card>
      <CardContent>
        <Typography variant="h6">Total</Typography>
        <Typography variant="h3">{stats.total_inscripciones}</Typography>
      </CardContent>
    </Card>
  </Grid>

  <Grid item xs={3}>
    <Card sx={{ bgcolor: 'success.light' }}>
      <CardContent>
        <Typography variant="h6">Accesos Activos</Typography>
        <Typography variant="h3" color="success.dark">
          {stats.accesos_activos}  {/* ✅ NUEVO */}
        </Typography>
      </CardContent>
    </Card>
  </Grid>

  <Grid item xs={3}>
    <Card sx={{ bgcolor: 'warning.light' }}>
      <CardContent>
        <Typography variant="h6">Accesos Inactivos</Typography>
        <Typography variant="h3" color="warning.dark">
          {stats.accesos_inactivos}  {/* ✅ NUEVO */}
        </Typography>
      </CardContent>
    </Card>
  </Grid>

  <Grid item xs={3}>
    <Card sx={{ bgcolor: 'info.light' }}>
      <CardContent>
        <Typography variant="h6">Pendientes</Typography>
        <Typography variant="h3" color="info.dark">
          {stats.pendientes}
        </Typography>
      </CardContent>
    </Card>
  </Grid>
</Grid>
```

---

## 📊 PASO 3: Implementar funciones de Desactivar/Reactivar

### Crear funciones API:

```javascript
// services/enrollmentService.js

/**
 * Desactivar acceso de uno o varios usuarios
 * @param {string[]} inscripcionIds - Array de IDs de inscripciones
 */
export const desactivarAcceso = async (inscripcionIds) => {
  try {
    const response = await fetch('/med-api/enrollments/suspend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`  // Tu función de auth
      },
      body: JSON.stringify({ inscripcionIds })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Error desactivando acceso')
    }

    return data
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

/**
 * Reactivar acceso de uno o varios usuarios
 * @param {string[]} inscripcionIds - Array de IDs de inscripciones
 */
export const reactivarAcceso = async (inscripcionIds) => {
  try {
    const response = await fetch('/med-api/enrollments/reactivate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ inscripcionIds })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Error reactivando acceso')
    }

    return data
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

/**
 * Cerrar temporada de un curso (desactiva todos los accesos)
 * @param {string} cursoId - ID del curso
 */
export const cerrarTemporadaCurso = async (cursoId) => {
  try {
    const response = await fetch(`/med-api/enrollments/course/${cursoId}/close-season`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Error cerrando temporada')
    }

    return data
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}
```

### Usar en el componente:

```jsx
import { desactivarAcceso, reactivarAcceso } from '@/services/enrollmentService'
import { useState } from 'react'
import { toast } from 'react-hot-toast'  // O tu librería de notificaciones

const InscripcionesTable = () => {
  const [inscripciones, setInscripciones] = useState([])
  const [loading, setLoading] = useState(false)

  // Función para desactivar
  const handleDesactivar = async (inscripcionIds) => {
    if (!confirm('¿Estás seguro de desactivar el acceso?')) return

    setLoading(true)
    try {
      const result = await desactivarAcceso(inscripcionIds)
      toast.success(result.message)

      // Recargar datos
      await fetchInscripciones()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  // Función para reactivar
  const handleReactivar = async (inscripcionIds) => {
    if (!confirm('¿Estás seguro de reactivar el acceso?')) return

    setLoading(true)
    try {
      const result = await reactivarAcceso(inscripcionIds)
      toast.success(result.message)

      // Recargar datos
      await fetchInscripciones()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Table>
      {/* ... */}
      <TableCell>
        {inscripcion.estado_pago === 'habilitado' && inscripcion.acceso_activo && (
          <Button
            size="small"
            color="warning"
            disabled={loading}
            onClick={() => handleDesactivar([inscripcion.id])}
          >
            Desactivar
          </Button>
        )}

        {inscripcion.estado_pago === 'habilitado' && !inscripcion.acceso_activo && (
          <Button
            size="small"
            color="success"
            disabled={loading}
            onClick={() => handleReactivar([inscripcion.id])}
          >
            Reactivar
          </Button>
        )}
      </TableCell>
    </Table>
  )
}
```

---

## 📊 PASO 4: Actualizar vista del Estudiante (Mis Cursos)

### Endpoint:
```
GET /med-api/enrollments/my
```

### Cambios en respuesta:
```json
{
  "inscripciones": [{
    "id": "abc-123",
    "curso_id": "curso-789",
    "estado_pago": "habilitado",
    "acceso_activo": true,              // ✅ NUEVO
    "tiene_acceso_actual": true,        // ✅ NUEVO
    "titulo": "Curso ENARM 2024",
    "slug": "curso-enarm-2024",
    "porcentaje_progreso": 45.50,
    ...
  }]
}
```

### Código Frontend:

```jsx
const MisCursos = () => {
  const [cursos, setCursos] = useState([])

  return (
    <Grid container spacing={3}>
      {cursos.map(curso => (
        <Grid item xs={12} md={6} lg={4} key={curso.id}>
          <Card>
            <CardMedia
              component="img"
              height="140"
              image={curso.miniatura_url}
              alt={curso.titulo}
            />
            <CardContent>
              <Typography variant="h5">{curso.titulo}</Typography>

              {/* ✅ NUEVO: Indicador de acceso */}
              {curso.tiene_acceso_actual ? (
                <Chip
                  label="Acceso Activo"
                  color="success"
                  icon={<CheckCircleIcon />}
                  sx={{ mt: 1 }}
                />
              ) : curso.estado_pago === 'habilitado' && !curso.acceso_activo ? (
                <>
                  <Chip
                    label="Acceso Expirado"
                    color="warning"
                    icon={<WarningIcon />}
                    sx={{ mt: 1 }}
                  />
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Tu acceso a este curso expiró.
                    <Button size="small" onClick={() => renovarCurso(curso.curso_id)}>
                      Renovar Ahora
                    </Button>
                  </Alert>
                </>
              ) : curso.estado_pago === 'pendiente' ? (
                <Chip
                  label="Pago Pendiente"
                  color="info"
                  icon={<HourglassIcon />}
                  sx={{ mt: 1 }}
                />
              ) : (
                <Chip
                  label="Sin Acceso"
                  color="default"
                  sx={{ mt: 1 }}
                />
              )}

              <LinearProgress
                variant="determinate"
                value={curso.porcentaje_progreso}
                sx={{ mt: 2 }}
              />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Progreso: {curso.porcentaje_progreso}%
              </Typography>

              {/* Botón de acceso */}
              <Button
                fullWidth
                variant="contained"
                disabled={!curso.tiene_acceso_actual}
                href={`/curso/${curso.slug}`}
                sx={{ mt: 2 }}
              >
                {curso.tiene_acceso_actual ? 'Continuar' : 'Sin Acceso'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}
```

---

## 📊 PASO 5: Actualizar validación de acceso (checkCourseAccess)

### Endpoint:
```
GET /med-api/enrollments/check-access/:cursoId
```

### ❌ Respuesta ANTES:
```json
{
  "success": true,
  "data": {
    "tieneAcceso": true,
    "esGratuito": false,
    "estadoPago": "habilitado",
    "fechaHabilitacion": "2024-01-16T14:30:00",
    "inscrito": true
  }
}
```

### ✅ Respuesta AHORA:
```json
{
  "success": true,
  "data": {
    "tieneAcceso": true,           // ✅ Ahora valida acceso_activo
    "esGratuito": false,
    "estadoPago": "habilitado",    // ✅ Puede ser "inactivo"
    "accesoActivo": true,          // ✅ NUEVO
    "fechaHabilitacion": "2024-01-16T14:30:00",
    "inscrito": true
  }
}
```

### Posibles valores de `estadoPago`:
- `no_inscrito` - No se ha inscrito
- `pendiente` - Esperando aprobación de pago
- `habilitado` - Acceso activo
- `inactivo` - ✅ **NUEVO:** Pagó pero acceso desactivado
- `rechazado` - Pago rechazado

### Código Frontend:

```jsx
// Hook para verificar acceso
const useCheckAccess = (cursoId) => {
  const [acceso, setAcceso] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await fetch(`/med-api/enrollments/check-access/${cursoId}`, {
          headers: {
            'Authorization': `Bearer ${getToken()}`
          }
        })
        const data = await response.json()
        setAcceso(data.data)
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    if (cursoId) {
      checkAccess()
    }
  }, [cursoId])

  return { acceso, loading }
}

// Usar en página del curso
const CursoPage = ({ cursoId }) => {
  const { acceso, loading } = useCheckAccess(cursoId)

  if (loading) return <Spinner />

  // ✅ NUEVA LÓGICA
  if (!acceso.tieneAcceso) {
    if (acceso.estadoPago === 'inactivo') {
      return (
        <Alert severity="warning">
          <AlertTitle>Acceso Expirado</AlertTitle>
          Tu acceso a este curso ha expirado.
          <Button onClick={() => renovarAcceso(cursoId)}>
            Renovar Acceso
          </Button>
        </Alert>
      )
    }

    if (acceso.estadoPago === 'pendiente') {
      return (
        <Alert severity="info">
          <AlertTitle>Pago Pendiente</AlertTitle>
          Tu solicitud está pendiente de aprobación.
        </Alert>
      )
    }

    if (acceso.estadoPago === 'no_inscrito') {
      return (
        <Alert severity="info">
          <AlertTitle>Inscríbete</AlertTitle>
          <Button onClick={() => inscribirse(cursoId)}>
            Inscribirse Ahora
          </Button>
        </Alert>
      )
    }
  }

  // Si tiene acceso, mostrar contenido del curso
  return <ContenidoCurso />
}
```

---

## 📊 PASO 6: Agregar botón "Cerrar Temporada" en página del curso (Admin)

```jsx
const CursoAdminActions = ({ cursoId }) => {
  const [loading, setLoading] = useState(false)

  const handleCerrarTemporada = async () => {
    if (!confirm('¿Cerrar temporada? Todos los usuarios perderán acceso.')) {
      return
    }

    setLoading(true)
    try {
      const result = await cerrarTemporadaCurso(cursoId)
      toast.success(result.message)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outlined"
      color="warning"
      disabled={loading}
      onClick={handleCerrarTemporada}
      startIcon={<CloseIcon />}
    >
      Cerrar Temporada
    </Button>
  )
}
```

---

## 🧪 PRUEBAS PASO A PASO

### Usuario de Prueba Creado:
```
Email: prueba@med.com
Password: admin123
Rol: Estudiante
```

### Secuencia de Pruebas:

#### 1️⃣ **Probar GET de inscripciones**
```bash
GET http://localhost:5001/med-api/enrollments/admin/all
Authorization: Bearer {tu-token-admin}
```
**Verificar:** Que devuelva campos `acceso_activo` y `tiene_acceso_actual`

#### 2️⃣ **Probar checkCourseAccess**
```bash
GET http://localhost:5001/med-api/enrollments/check-access/{cursoId}
Authorization: Bearer {token-prueba@med.com}
```
**Verificar:** Que devuelva `accesoActivo` y `estadoPago`

#### 3️⃣ **Desactivar acceso del usuario prueba**
```bash
POST http://localhost:5001/med-api/enrollments/suspend
Authorization: Bearer {tu-token-admin}
Content-Type: application/json

{
  "inscripcionIds": ["{id-inscripcion-usuario-prueba}"]
}
```
**Verificar:**
- Respuesta exitosa con mensaje de confirmación
- Usuario prueba NO puede acceder al curso

#### 4️⃣ **Verificar pérdida de acceso**
```bash
GET http://localhost:5001/med-api/enrollments/check-access/{cursoId}
Authorization: Bearer {token-prueba@med.com}
```
**Verificar:**
- `tieneAcceso: false`
- `estadoPago: "inactivo"`
- `accesoActivo: false`

#### 5️⃣ **Reactivar acceso**
```bash
POST http://localhost:5001/med-api/enrollments/reactivate
Authorization: Bearer {tu-token-admin}
Content-Type: application/json

{
  "inscripcionIds": ["{id-inscripcion-usuario-prueba}"]
}
```
**Verificar:** Usuario recupera acceso

#### 6️⃣ **Cerrar temporada de curso completo**
```bash
POST http://localhost:5001/med-api/enrollments/course/{cursoId}/close-season
Authorization: Bearer {tu-token-admin}
```
**Verificar:** Todos los usuarios del curso pierden acceso

---

## ✅ Checklist de Implementación

### Backend (Ya implementado):
- [x] Agregar columna `acceso_activo` a BD
- [x] Actualizar `getAllEnrollments` con nuevos campos
- [x] Actualizar `checkCourseAccess` con validación
- [x] Actualizar `getMyEnrollments` con nuevos campos
- [x] Crear endpoint `suspendAccess`
- [x] Crear endpoint `reactivateAccess`
- [x] Crear endpoint `closeCourseSeason`
- [x] Actualizar `approvePayment` para activar acceso

### Frontend (Por implementar):
- [ ] **PASO 1:** Actualizar tabla de inscripciones (Admin)
- [ ] **PASO 2:** Agregar nuevas estadísticas (Admin)
- [ ] **PASO 3:** Implementar botones Desactivar/Reactivar
- [ ] **PASO 4:** Actualizar vista Mis Cursos (Estudiante)
- [ ] **PASO 5:** Actualizar validación de acceso en páginas de curso
- [ ] **PASO 6:** Agregar botón "Cerrar Temporada" (Admin)

---

## 📞 Soporte

Si tienes dudas sobre la implementación:
1. Revisar la documentación completa en `DOCUMENTACION_TEMPORADAS.md`
2. Probar los endpoints con el usuario `prueba@med.com`
3. Verificar los logs del servidor para errores

**Fecha de implementación:** ${new Date().toLocaleDateString('es-ES')}
