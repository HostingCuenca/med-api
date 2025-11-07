# Sistema de Gestión de Temporadas - Mediconsa Academy

## 📋 Objetivo
Permitir que los cursos tengan acceso por temporada, donde los usuarios deben pagar nuevamente para acceder al curso cuando su temporada expira, manteniendo un historial completo de todos los pagos realizados.

## 🎯 Problema que resuelve

### Antes:
- Usuario paga curso → Acceso permanente
- Si reprueba → Acceso indefinido sin pagar de nuevo
- Sin control de temporadas

### Después:
- Usuario paga curso → Acceso por temporada
- Termina temporada → Pierde acceso (pero se mantiene registro del pago)
- Usuario puede re-solicitar acceso → Nuevo pago
- Historial completo de todas las compras

---

## 🗄️ Cambio en Base de Datos

### Nueva columna agregada:
```sql
ALTER TABLE inscripciones
ADD COLUMN acceso_activo BOOLEAN DEFAULT true;
```

### Estructura de `inscripciones`:
```
id                 → UUID (PK)
usuario_id         → UUID (FK)
curso_id           → UUID (FK)
estado_pago        → TEXT ('pendiente', 'habilitado', 'rechazado')
acceso_activo      → BOOLEAN (true/false) ← NUEVO
fecha_inscripcion  → TIMESTAMP
fecha_habilitacion → TIMESTAMP
habilitado_por     → UUID (FK)
```

---

## 📊 Modelo de Estados

### Combinaciones posibles:

| estado_pago | acceso_activo | Significado | Usuario puede acceder |
|------------|---------------|-------------|---------------------|
| `pendiente` | `false` | Solicitud pendiente de aprobación | ❌ No |
| `habilitado` | `true` | Pago aprobado y acceso activo | ✅ Sí |
| `habilitado` | `false` | Pagó pero temporada terminó | ❌ No |
| `rechazado` | `false` | Pago rechazado | ❌ No |

### Regla de acceso:
```javascript
tieneAcceso = curso.es_gratuito ||
              (estado_pago === 'habilitado' && acceso_activo === true)
```

---

## 🔄 Flujos de Usuario

### 1. Primera inscripción
```
Usuario presiona "Inscribirse"
  ↓
Crear inscripción: estado_pago='pendiente', acceso_activo=false
  ↓
Admin aprueba pago
  ↓
UPDATE: estado_pago='habilitado', acceso_activo=true
  ↓
Usuario tiene acceso ✅
```

### 2. Renovación (temporada expirada)
```
Admin cierra temporada
  ↓
UPDATE todas las inscripciones del curso: acceso_activo=false
  ↓
Usuario intenta acceder → ❌ "Tu acceso expiró"
  ↓
Usuario presiona "Inscribirse" nuevamente
  ↓
Validación:
  - ¿Tiene acceso activo? → NO ✅
  - ¿Tiene solicitud pendiente? → NO ✅
  ↓
Crear NUEVA inscripción: estado_pago='pendiente', acceso_activo=false
  ↓
Admin aprueba nueva solicitud
  ↓
UPDATE nueva inscripción: estado_pago='habilitado', acceso_activo=true
  ↓
Usuario tiene acceso nuevamente ✅

RESULTADO: 2 inscripciones (2 pagos registrados)
```

### 3. Prevención de solicitudes duplicadas
```
Usuario con acceso expirado presiona "Inscribirse"
  ↓
Crear inscripción pendiente
  ↓
Usuario presiona "Inscribirse" nuevamente (antes de que aprueben)
  ↓
Validación: "Ya tienes una solicitud pendiente" ❌
  ↓
NO se crea otra inscripción
```

---

## 🛠️ Servicios Implementados

### 1. `enrollCourse()` - Inscripción/Renovación
**Lógica:**
- Valida si tiene acceso activo → Rechaza
- Valida si tiene solicitud pendiente → Rechaza
- Si tiene pagos anteriores inactivos → Crea nueva inscripción (renovación)
- Si es primera vez → Crea inscripción

### 2. `approvePayment()` - Aprobar Pago
**Cambio:**
```javascript
// Antes:
estado_pago = 'habilitado'

// Ahora:
estado_pago = 'habilitado'
acceso_activo = true  ← NUEVO
```

### 3. `checkCourseAccess()` - Verificar Acceso
**Cambio:**
```javascript
// Antes:
tieneAcceso = es_gratuito || estado_pago === 'habilitado'

// Ahora:
tieneAcceso = es_gratuito ||
              (estado_pago === 'habilitado' && acceso_activo === true)
```

### 4. `suspendAccess()` - Desactivar Acceso (NUEVO)
**Individual:**
```
POST /med-api/enrollments/suspend
{ "inscripcionIds": ["abc-123"] }
```

**Bulk (múltiples):**
```
POST /med-api/enrollments/suspend
{ "inscripcionIds": ["abc-123", "def-456", "ghi-789"] }
```

**Resultado:** acceso_activo = false (estado_pago NO cambia)

### 5. `reactivateAccess()` - Reactivar Acceso (NUEVO)
```
POST /med-api/enrollments/reactivate
{ "inscripcionIds": ["abc-123"] }
```

**Resultado:** acceso_activo = true (sin cobrar de nuevo)

### 6. `closeCourseSeason()` - Cerrar Temporada (NUEVO)
```
POST /med-api/enrollments/course/:cursoId/close-season
```

**Resultado:** Desactiva todos los accesos activos del curso

---

## 📊 Reportes Financieros

### Total de ingresos (histórico completo):
```sql
SELECT COUNT(*) as total_pagos, SUM(c.precio) as ingresos_totales
FROM inscripciones i
JOIN cursos c ON i.curso_id = c.id
WHERE i.estado_pago = 'habilitado'
```

### Usuarios con acceso activo:
```sql
SELECT COUNT(*) as usuarios_activos
FROM inscripciones
WHERE estado_pago = 'habilitado' AND acceso_activo = true
```

### Usuarios que pagaron pero perdieron acceso (potenciales renovaciones):
```sql
SELECT u.nombre_completo, u.email, c.titulo, i.fecha_habilitacion
FROM inscripciones i
JOIN perfiles_usuario u ON i.usuario_id = u.id
JOIN cursos c ON i.curso_id = c.id
WHERE i.estado_pago = 'habilitado' AND i.acceso_activo = false
ORDER BY i.fecha_habilitacion DESC
```

### Historial de compras de un usuario:
```sql
SELECT c.titulo, i.fecha_inscripcion, i.fecha_habilitacion,
       i.estado_pago, i.acceso_activo, c.precio
FROM inscripciones i
JOIN cursos c ON i.curso_id = c.id
WHERE i.usuario_id = 'xxx'
ORDER BY i.fecha_inscripcion DESC
```

### Ingresos por temporada (si se agrega columna temporada):
```sql
SELECT COUNT(*) as ventas, SUM(c.precio) as ingresos
FROM inscripciones i
JOIN cursos c ON i.curso_id = c.id
WHERE i.estado_pago = 'habilitado'
  AND i.fecha_habilitacion BETWEEN '2024-01-01' AND '2024-06-30'
```

---

## 🔐 Endpoints API

### Estudiantes:
```
POST   /med-api/enrollments/enroll          → Inscribirse/Renovar
GET    /med-api/enrollments/my-enrollments  → Mis inscripciones
GET    /med-api/enrollments/check/:cursoId  → Verificar acceso
```

### Administradores:
```
GET    /med-api/enrollments                        → Todas las inscripciones
POST   /med-api/enrollments/approve/:inscripcionId → Aprobar pago
POST   /med-api/enrollments/suspend                → Desactivar acceso (individual/bulk)
POST   /med-api/enrollments/reactivate             → Reactivar acceso (individual/bulk)
POST   /med-api/enrollments/course/:cursoId/close-season → Cerrar temporada curso
```

---

## 🎯 Casos de Uso

### Caso 1: Cerrar temporada de un curso
```javascript
// Admin cierra temporada ENARM 2024-1
POST /med-api/enrollments/course/abc-123/close-season

// Resultado: Todos los usuarios pierden acceso
// Pero el registro de pago se mantiene
```

### Caso 2: Usuario quiere renovar acceso
```javascript
// Usuario con acceso expirado solicita nuevamente
POST /med-api/enrollments/enroll
{ "cursoId": "abc-123" }

// Se crea nueva inscripción pendiente
// Admin aprueba → Usuario paga nuevamente → Acceso restaurado
```

### Caso 3: Desactivar usuario específico (manualmente)
```javascript
// Admin desactiva acceso de 1 usuario problemático
POST /med-api/enrollments/suspend
{ "inscripcionIds": ["inscripcion-123"] }

// Usuario pierde acceso inmediatamente
// Puede reactivarse sin nuevo pago
```

### Caso 4: Reactivar usuario por error
```javascript
// Admin desactivó por error, lo reactiva
POST /med-api/enrollments/reactivate
{ "inscripcionIds": ["inscripcion-123"] }

// Usuario recupera acceso sin pagar de nuevo
```

---

## ✅ Ventajas del Sistema

1. **Historial completo**: Cada pago queda registrado permanentemente
2. **Control granular**: Activar/desactivar sin afectar historial financiero
3. **Escalable**: Funciona para cursos lifetime y temporales
4. **Reportes precisos**: Diferencia entre "pagó" vs "tiene acceso"
5. **Flexible**: Permite renovaciones y correcciones manuales
6. **Sin pérdida de datos**: estado_pago nunca se modifica después de aprobar

---

## 🧪 Testing

### Escenarios a probar:
1. ✅ Usuario solicita curso por primera vez
2. ✅ Admin aprueba y usuario accede
3. ✅ Admin cierra temporada, usuario pierde acceso
4. ✅ Usuario solicita renovación
5. ✅ Usuario intenta crear múltiples solicitudes pendientes (debe rechazar)
6. ✅ Admin desactiva usuario individualmente
7. ✅ Admin reactiva usuario
8. ✅ Verificar reportes financieros muestran todos los pagos
9. ✅ Usuario con acceso activo intenta inscribirse de nuevo (debe rechazar)

---

## 📅 Fecha de Implementación
**Fecha:** ${new Date().toLocaleDateString('es-ES')}
**Versión:** 1.0.0
