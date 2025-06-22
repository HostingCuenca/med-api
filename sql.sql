-- public."_prisma_migrations" definition

-- Drop table

-- DROP TABLE public."_prisma_migrations";

CREATE TABLE public."_prisma_migrations" (
	id varchar(36) NOT NULL,
	checksum varchar(64) NOT NULL,
	finished_at timestamptz NULL,
	migration_name varchar(255) NOT NULL,
	logs text NULL,
	rolled_back_at timestamptz NULL,
	started_at timestamptz DEFAULT now() NOT NULL,
	applied_steps_count int4 DEFAULT 0 NOT NULL,
	CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY (id)
);


-- public.perfiles_usuario definition

-- Drop table

-- DROP TABLE public.perfiles_usuario;

CREATE TABLE public.perfiles_usuario (
	email text NOT NULL,
	password_hash text NOT NULL,
	nombre_completo text NOT NULL,
	nombre_usuario text NOT NULL,
	telefono text NULL,
	avatar_url text NULL,
	tipo_usuario text DEFAULT 'estudiante'::text NOT NULL,
	activo bool DEFAULT true NOT NULL,
	fecha_registro timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	ultima_conexion timestamptz NULL,
	CONSTRAINT perfiles_usuario_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX perfiles_usuario_email_key ON public.perfiles_usuario USING btree (email);
CREATE UNIQUE INDEX perfiles_usuario_nombre_usuario_key ON public.perfiles_usuario USING btree (nombre_usuario);


-- public.cursos definition

-- Drop table

-- DROP TABLE public.cursos;

CREATE TABLE public.cursos (
	titulo text NOT NULL,
	descripcion text NULL,
	slug text NOT NULL,
	miniatura_url text NULL,
	precio numeric(10, 2) DEFAULT 0 NOT NULL,
	descuento int4 DEFAULT 0 NOT NULL,
	tipo_examen text NULL,
	es_gratuito bool DEFAULT false NOT NULL,
	activo bool DEFAULT true NOT NULL,
	fecha_creacion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	instructor_id uuid NULL,
	CONSTRAINT cursos_pkey PRIMARY KEY (id),
	CONSTRAINT cursos_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX cursos_slug_key ON public.cursos USING btree (slug);


-- public.inscripciones definition

-- Drop table

-- DROP TABLE public.inscripciones;

CREATE TABLE public.inscripciones (
	estado_pago text DEFAULT 'pendiente'::text NOT NULL,
	fecha_inscripcion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	fecha_habilitacion timestamp(3) NULL,
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	usuario_id uuid NOT NULL,
	curso_id uuid NOT NULL,
	habilitado_por uuid NULL,
	CONSTRAINT inscripciones_pkey PRIMARY KEY (id),
	CONSTRAINT inscripciones_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT inscripciones_habilitado_por_fkey FOREIGN KEY (habilitado_por) REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL ON UPDATE CASCADE,
	CONSTRAINT inscripciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.perfiles_usuario(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX inscripciones_usuario_id_curso_id_key ON public.inscripciones USING btree (usuario_id, curso_id);


-- public.materiales definition

-- Drop table

-- DROP TABLE public.materiales;

CREATE TABLE public.materiales (
	titulo text NOT NULL,
	descripcion text NULL,
	archivo_url text NOT NULL,
	tipo_archivo text NULL,
	precio numeric(10, 2) DEFAULT 0 NOT NULL,
	es_gratuito bool DEFAULT false NOT NULL,
	fecha_creacion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	curso_id uuid NULL,
	CONSTRAINT materiales_pkey PRIMARY KEY (id),
	CONSTRAINT materiales_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE SET NULL ON UPDATE CASCADE
);


-- public.modulos definition

-- Drop table

-- DROP TABLE public.modulos;

CREATE TABLE public.modulos (
	titulo text NOT NULL,
	descripcion text NULL,
	orden int4 NOT NULL,
	fecha_creacion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	curso_id uuid NOT NULL,
	CONSTRAINT modulos_pkey PRIMARY KEY (id),
	CONSTRAINT modulos_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE CASCADE ON UPDATE CASCADE
);


-- public.simulacros definition

-- Drop table

-- DROP TABLE public.simulacros;

CREATE TABLE public.simulacros (
	titulo text NOT NULL,
	descripcion text NULL,
	modo_evaluacion text NOT NULL,
	tiempo_limite_minutos int4 NULL,
	tiempo_por_pregunta_segundos int4 NULL,
	numero_preguntas int4 NOT NULL,
	intentos_permitidos int4 DEFAULT '-1'::integer NOT NULL,
	randomizar_preguntas bool DEFAULT true NOT NULL,
	randomizar_opciones bool DEFAULT true NOT NULL,
	mostrar_respuestas_despues int4 DEFAULT 1 NOT NULL,
	activo bool DEFAULT true NOT NULL,
	fecha_creacion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	curso_id uuid NOT NULL,
	CONSTRAINT simulacros_pkey PRIMARY KEY (id),
	CONSTRAINT simulacros_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE CASCADE ON UPDATE CASCADE
);


-- public.clases definition

-- Drop table

-- DROP TABLE public.clases;

CREATE TABLE public.clases (
	titulo text NOT NULL,
	descripcion text NULL,
	video_youtube_url text NULL,
	duracion_minutos int4 NULL,
	es_gratuita bool DEFAULT false NOT NULL,
	orden int4 NOT NULL,
	fecha_creacion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	modulo_id uuid NOT NULL,
	CONSTRAINT clases_pkey PRIMARY KEY (id),
	CONSTRAINT clases_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id) ON DELETE CASCADE ON UPDATE CASCADE
);


-- public.intentos_simulacro definition

-- Drop table

-- DROP TABLE public.intentos_simulacro;

CREATE TABLE public.intentos_simulacro (
	puntaje numeric(5, 2) NULL,
	total_preguntas int4 NULL,
	respuestas_correctas int4 NULL,
	tiempo_empleado_minutos int4 NULL,
	fecha_intento timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	usuario_id uuid NOT NULL,
	simulacro_id uuid NOT NULL,
	CONSTRAINT intentos_simulacro_pkey PRIMARY KEY (id),
	CONSTRAINT intentos_simulacro_simulacro_id_fkey FOREIGN KEY (simulacro_id) REFERENCES public.simulacros(id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT intentos_simulacro_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.perfiles_usuario(id) ON DELETE CASCADE ON UPDATE CASCADE
);


-- public.preguntas definition

-- Drop table

-- DROP TABLE public.preguntas;

CREATE TABLE public.preguntas (
	enunciado text NOT NULL,
	tipo_pregunta text NOT NULL,
	explicacion text NULL,
	imagen_url text NULL,
	fecha_creacion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	simulacro_id uuid NOT NULL,
	CONSTRAINT preguntas_pkey PRIMARY KEY (id),
	CONSTRAINT preguntas_simulacro_id_fkey FOREIGN KEY (simulacro_id) REFERENCES public.simulacros(id) ON DELETE CASCADE ON UPDATE CASCADE
);


-- public.progreso_clases definition

-- Drop table

-- DROP TABLE public.progreso_clases;

CREATE TABLE public.progreso_clases (
	completada bool DEFAULT false NOT NULL,
	"porcentajeVisto" int4 DEFAULT 0 NOT NULL,
	fecha_ultima_vista timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	usuario_id uuid NOT NULL,
	clase_id uuid NOT NULL,
	CONSTRAINT progreso_clases_pkey PRIMARY KEY (id),
	CONSTRAINT progreso_clases_clase_id_fkey FOREIGN KEY (clase_id) REFERENCES public.clases(id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT progreso_clases_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.perfiles_usuario(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX progreso_clases_usuario_id_clase_id_key ON public.progreso_clases USING btree (usuario_id, clase_id);


-- public.opciones_respuesta definition

-- Drop table

-- DROP TABLE public.opciones_respuesta;

CREATE TABLE public.opciones_respuesta (
	texto_opcion text NOT NULL,
	es_correcta bool DEFAULT false NOT NULL,
	orden int4 NOT NULL,
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	pregunta_id uuid NOT NULL,
	CONSTRAINT opciones_respuesta_pkey PRIMARY KEY (id),
	CONSTRAINT opciones_respuesta_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES public.preguntas(id) ON DELETE CASCADE ON UPDATE CASCADE
);


-- public.respuestas_usuario definition

-- Drop table

-- DROP TABLE public.respuestas_usuario;

CREATE TABLE public.respuestas_usuario (
	es_correcta bool DEFAULT false NOT NULL,
	fecha_respuesta timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	intento_simulacro_id uuid NOT NULL,
	pregunta_id uuid NOT NULL,
	opcion_seleccionada_id uuid NOT NULL,
	CONSTRAINT respuestas_usuario_pkey PRIMARY KEY (id),
	CONSTRAINT respuestas_usuario_intento_simulacro_id_fkey FOREIGN KEY (intento_simulacro_id) REFERENCES public.intentos_simulacro(id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT respuestas_usuario_opcion_seleccionada_id_fkey FOREIGN KEY (opcion_seleccionada_id) REFERENCES public.opciones_respuesta(id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT respuestas_usuario_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES public.preguntas(id) ON DELETE CASCADE ON UPDATE CASCADE
);


ALTER TABLE intentos_simulacro ADD COLUMN completado BOOLEAN DEFAULT false;
UPDATE intentos_simulacro SET completado = true WHERE puntaje IS NOT NULL;



-- 1. EXPANDIR tabla preguntas (agregar solo campos críticos)
ALTER TABLE preguntas ADD COLUMN IF NOT EXISTS configuracion JSONB DEFAULT '{}';
ALTER TABLE preguntas ADD COLUMN IF NOT EXISTS puntaje_maximo DECIMAL(5,2) DEFAULT 1.0;
ALTER TABLE preguntas ADD COLUMN IF NOT EXISTS metadatos JSONB DEFAULT '{}';

-- 2. EXPANDIR opciones_respuesta (agregar puntaje parcial)
ALTER TABLE opciones_respuesta ADD COLUMN IF NOT EXISTS puntaje_parcial DECIMAL(3,2) DEFAULT 0;
ALTER TABLE opciones_respuesta ADD COLUMN IF NOT EXISTS metadatos JSONB DEFAULT '{}';

-- 3. EXPANDIR respuestas_usuario (para respuestas de texto libre)
ALTER TABLE respuestas_usuario ADD COLUMN IF NOT EXISTS respuesta_texto TEXT;
ALTER TABLE respuestas_usuario ADD COLUMN IF NOT EXISTS puntaje_obtenido DECIMAL(5,2);
ALTER TABLE respuestas_usuario ADD COLUMN IF NOT EXISTS metadatos JSONB DEFAULT '{}';

-- 4. NUEVA tabla para preguntas complejas (opcional)
CREATE TABLE IF NOT EXISTS elementos_pregunta (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pregunta_id UUID REFERENCES preguntas(id) ON DELETE CASCADE,
    tipo_elemento TEXT NOT NULL, -- 'concepto', 'definicion', 'formula', 'variable'
    contenido TEXT NOT NULL,
    posicion INTEGER DEFAULT 0,
    es_correcto BOOLEAN DEFAULT false,
    metadatos JSONB DEFAULT '{}'
);



-- Actualización de tabla simulacros
ALTER TABLE simulacros ADD COLUMN modo_estudio VARCHAR(20) DEFAULT 'estudio';
-- 'estudio', 'revision', 'evaluacion', 'examen_real'

ALTER TABLE simulacros ADD COLUMN tipo_tiempo VARCHAR(20) DEFAULT 'sin_limite';
-- 'sin_limite', 'por_pregunta', 'global'

ALTER TABLE simulacros ADD COLUMN tipo_navegacion VARCHAR(20) DEFAULT 'libre';
-- 'libre', 'secuencial'

ALTER TABLE simulacros ADD COLUMN configuracion_modo JSONB DEFAULT '{}';
-- Configuraciones específicas del modo


-- Agregar nuevos campos para los 4 modos de simulacro
ALTER TABLE simulacros ADD COLUMN IF NOT EXISTS modo_estudio VARCHAR(20) DEFAULT 'estudio';
-- 'estudio', 'revision', 'evaluacion', 'examen_real'

ALTER TABLE simulacros ADD COLUMN IF NOT EXISTS tipo_tiempo VARCHAR(20) DEFAULT 'sin_limite';
-- 'sin_limite', 'por_pregunta', 'global'

ALTER TABLE simulacros ADD COLUMN IF NOT EXISTS tipo_navegacion VARCHAR(20) DEFAULT 'libre';
-- 'libre', 'secuencial'

ALTER TABLE simulacros ADD COLUMN IF NOT EXISTS configuracion_avanzada JSONB DEFAULT '{}';
-- Configuraciones específicas del modo



--definitivo


-- =====================================================
-- SISTEMA E-LEARNING - SCRIPT DEFINITIVO LIMPIO
-- Base de datos PostgreSQL - Versión Final
-- =====================================================

-- Tabla de migraciones de Prisma
CREATE TABLE public."_prisma_migrations" (
    id varchar(36) NOT NULL,
    checksum varchar(64) NOT NULL,
    finished_at timestamptz NULL,
    migration_name varchar(255) NOT NULL,
    logs text NULL,
    rolled_back_at timestamptz NULL,
    started_at timestamptz DEFAULT now() NOT NULL,
    applied_steps_count int4 DEFAULT 0 NOT NULL,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY (id)
);

-- =====================================================
-- USUARIOS Y PERFILES
-- =====================================================
CREATE TABLE public.perfiles_usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    nombre_completo text NOT NULL,
    nombre_usuario text NOT NULL,
    telefono text NULL,
    avatar_url text NULL,
    tipo_usuario text DEFAULT 'estudiante'::text NOT NULL,
    activo bool DEFAULT true NOT NULL,
    fecha_registro timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ultima_conexion timestamptz NULL,
    CONSTRAINT perfiles_usuario_pkey PRIMARY KEY (id),
    CONSTRAINT check_tipo_usuario CHECK (tipo_usuario IN ('estudiante', 'instructor', 'administrador'))
);

CREATE UNIQUE INDEX perfiles_usuario_email_key ON public.perfiles_usuario USING btree (email);
CREATE UNIQUE INDEX perfiles_usuario_nombre_usuario_key ON public.perfiles_usuario USING btree (nombre_usuario);

-- =====================================================
-- CURSOS Y ESTRUCTURA DE CONTENIDO
-- =====================================================
CREATE TABLE public.cursos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descripcion text NULL,
    slug text NOT NULL,
    miniatura_url text NULL,
    precio numeric(10, 2) DEFAULT 0 NOT NULL,
    descuento int4 DEFAULT 0 NOT NULL,
    tipo_examen text NULL,
    es_gratuito bool DEFAULT false NOT NULL,
    activo bool DEFAULT true NOT NULL,
    fecha_creacion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    instructor_id uuid NULL,
    CONSTRAINT cursos_pkey PRIMARY KEY (id),
    CONSTRAINT cursos_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX cursos_slug_key ON public.cursos USING btree (slug);
CREATE INDEX idx_cursos_instructor ON public.cursos (instructor_id);
CREATE INDEX idx_cursos_activo ON public.cursos (activo);

-- =====================================================
-- MÓDULOS (Organización de clases)
-- =====================================================
CREATE TABLE public.modulos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descripcion text NULL,
    orden int4 NOT NULL,
    fecha_creacion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    curso_id uuid NOT NULL,
    CONSTRAINT modulos_pkey PRIMARY KEY (id),
    CONSTRAINT modulos_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_modulos_curso ON public.modulos (curso_id, orden);

-- =====================================================
-- CLASES (Contenido de video)
-- =====================================================
CREATE TABLE public.clases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descripcion text NULL,
    video_youtube_url text NULL,
    duracion_minutos int4 NULL,
    es_gratuita bool DEFAULT false NOT NULL,
    orden int4 NOT NULL,
    fecha_creacion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modulo_id uuid NOT NULL,
    CONSTRAINT clases_pkey PRIMARY KEY (id),
    CONSTRAINT clases_modulo_id_fkey FOREIGN KEY (modulo_id) REFERENCES public.modulos(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_clases_modulo ON public.clases (modulo_id, orden);

-- =====================================================
-- MATERIALES DESCARGABLES
-- =====================================================
CREATE TABLE public.materiales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descripcion text NULL,
    archivo_url text NOT NULL,
    tipo_archivo text NULL,
    precio numeric(10, 2) DEFAULT 0 NOT NULL,
    es_gratuito bool DEFAULT false NOT NULL,
    fecha_creacion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    curso_id uuid NULL,
    CONSTRAINT materiales_pkey PRIMARY KEY (id),
    CONSTRAINT materiales_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- =====================================================
-- INSCRIPCIONES Y PAGOS
-- =====================================================
CREATE TABLE public.inscripciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    curso_id uuid NOT NULL,
    estado_pago text DEFAULT 'pendiente'::text NOT NULL,
    fecha_inscripcion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_habilitacion timestamp(3) NULL,
    habilitado_por uuid NULL,
    CONSTRAINT inscripciones_pkey PRIMARY KEY (id),
    CONSTRAINT inscripciones_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT inscripciones_habilitado_por_fkey FOREIGN KEY (habilitado_por) REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT inscripciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.perfiles_usuario(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT check_estado_pago CHECK (estado_pago IN ('pendiente', 'pagado', 'cancelado', 'expirado'))
);

CREATE UNIQUE INDEX inscripciones_usuario_id_curso_id_key ON public.inscripciones USING btree (usuario_id, curso_id);
CREATE INDEX idx_inscripciones_usuario ON public.inscripciones (usuario_id);
CREATE INDEX idx_inscripciones_curso ON public.inscripciones (curso_id);

-- =====================================================
-- SISTEMA DE EVALUACIÓN - SIMULACROS
-- =====================================================
CREATE TABLE public.simulacros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descripcion text NULL,
    curso_id uuid NOT NULL,
    -- Configuración básica
    modo_evaluacion text NOT NULL,
    numero_preguntas int4 NOT NULL,
    activo bool DEFAULT true NOT NULL,
    fecha_creacion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    -- Configuración de tiempo
    tiempo_limite_minutos int4 NULL,
    tiempo_por_pregunta_segundos int4 NULL,
    tipo_tiempo varchar(20) DEFAULT 'sin_limite',
    -- Configuración de comportamiento
    intentos_permitidos int4 DEFAULT '-1'::integer NOT NULL,
    randomizar_preguntas bool DEFAULT true NOT NULL,
    randomizar_opciones bool DEFAULT true NOT NULL,
    mostrar_respuestas_despues int4 DEFAULT 1 NOT NULL,
    tipo_navegacion varchar(20) DEFAULT 'libre',
    -- Modos de estudio avanzados
    modo_estudio varchar(20) DEFAULT 'estudio',
    configuracion_avanzada JSONB DEFAULT '{}',
    CONSTRAINT simulacros_pkey PRIMARY KEY (id),
    CONSTRAINT simulacros_curso_id_fkey FOREIGN KEY (curso_id) REFERENCES public.cursos(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT check_modo_estudio CHECK (modo_estudio IN ('estudio', 'revision', 'evaluacion', 'examen_real')),
    CONSTRAINT check_tipo_tiempo CHECK (tipo_tiempo IN ('sin_limite', 'por_pregunta', 'global')),
    CONSTRAINT check_tipo_navegacion CHECK (tipo_navegacion IN ('libre', 'secuencial'))
);

CREATE INDEX idx_simulacros_curso ON public.simulacros (curso_id);

-- =====================================================
-- PREGUNTAS (Soporte para múltiples tipos)
-- =====================================================
CREATE TABLE public.preguntas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enunciado text NOT NULL,
    tipo_pregunta text NOT NULL,
    explicacion text NULL,
    imagen_url text NULL,
    fecha_creacion timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    simulacro_id uuid NOT NULL,
    -- Configuración avanzada
    configuracion JSONB DEFAULT '{}',
    puntaje_maximo DECIMAL(5,2) DEFAULT 1.0,
    metadatos JSONB DEFAULT '{}',
    CONSTRAINT preguntas_pkey PRIMARY KEY (id),
    CONSTRAINT preguntas_simulacro_id_fkey FOREIGN KEY (simulacro_id) REFERENCES public.simulacros(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT check_tipo_pregunta CHECK (tipo_pregunta IN ('multiple_choice', 'true_false', 'text_free', 'matching', 'ordering', 'fill_blank'))
);

CREATE INDEX idx_preguntas_simulacro ON public.preguntas (simulacro_id);

-- =====================================================
-- OPCIONES DE RESPUESTA (Con puntajes parciales)
-- =====================================================
CREATE TABLE public.opciones_respuesta (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    texto_opcion text NOT NULL,
    es_correcta bool DEFAULT false NOT NULL,
    orden int4 NOT NULL,
    pregunta_id uuid NOT NULL,
    -- Puntajes parciales para respuestas múltiples
    puntaje_parcial DECIMAL(3,2) DEFAULT 0,
    metadatos JSONB DEFAULT '{}',
    CONSTRAINT opciones_respuesta_pkey PRIMARY KEY (id),
    CONSTRAINT opciones_respuesta_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES public.preguntas(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- =====================================================
-- ELEMENTOS PARA PREGUNTAS COMPLEJAS
-- =====================================================
CREATE TABLE public.elementos_pregunta (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pregunta_id UUID NOT NULL,
    tipo_elemento TEXT NOT NULL, -- 'concepto', 'definicion', 'formula', 'variable'
    contenido TEXT NOT NULL,
    posicion INTEGER DEFAULT 0,
    es_correcto BOOLEAN DEFAULT false,
    metadatos JSONB DEFAULT '{}',
    CONSTRAINT elementos_pregunta_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES public.preguntas(id) ON DELETE CASCADE
);

-- =====================================================
-- INTENTOS DE SIMULACRO
-- =====================================================
CREATE TABLE public.intentos_simulacro (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    simulacro_id uuid NOT NULL,
    puntaje numeric(5, 2) NULL,
    total_preguntas int4 NULL,
    respuestas_correctas int4 NULL,
    tiempo_empleado_minutos int4 NULL,
    fecha_intento timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completado BOOLEAN DEFAULT false NOT NULL,
    CONSTRAINT intentos_simulacro_pkey PRIMARY KEY (id),
    CONSTRAINT intentos_simulacro_simulacro_id_fkey FOREIGN KEY (simulacro_id) REFERENCES public.simulacros(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT intentos_simulacro_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.perfiles_usuario(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_intentos_usuario_simulacro ON public.intentos_simulacro (usuario_id, simulacro_id);

-- =====================================================
-- RESPUESTAS DE USUARIO (Expandida)
-- =====================================================
CREATE TABLE public.respuestas_usuario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intento_simulacro_id uuid NOT NULL,
    pregunta_id uuid NOT NULL,
    opcion_seleccionada_id uuid NOT NULL,
    es_correcta bool DEFAULT false NOT NULL,
    fecha_respuesta timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    -- Soporte para respuestas de texto libre
    respuesta_texto TEXT,
    puntaje_obtenido DECIMAL(5,2),
    metadatos JSONB DEFAULT '{}',
    CONSTRAINT respuestas_usuario_pkey PRIMARY KEY (id),
    CONSTRAINT respuestas_usuario_intento_simulacro_id_fkey FOREIGN KEY (intento_simulacro_id) REFERENCES public.intentos_simulacro(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT respuestas_usuario_opcion_seleccionada_id_fkey FOREIGN KEY (opcion_seleccionada_id) REFERENCES public.opciones_respuesta(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT respuestas_usuario_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES public.preguntas(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_respuestas_intento ON public.respuestas_usuario (intento_simulacro_id);

-- =====================================================
-- PROGRESO DE CLASES
-- =====================================================
CREATE TABLE public.progreso_clases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    clase_id uuid NOT NULL,
    completada bool DEFAULT false NOT NULL,
    "porcentajeVisto" int4 DEFAULT 0 NOT NULL,
    fecha_ultima_vista timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT progreso_clases_pkey PRIMARY KEY (id),
    CONSTRAINT progreso_clases_clase_id_fkey FOREIGN KEY (clase_id) REFERENCES public.clases(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT progreso_clases_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.perfiles_usuario(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX progreso_clases_usuario_id_clase_id_key ON public.progreso_clases USING btree (usuario_id, clase_id);
CREATE INDEX idx_progreso_usuario ON public.progreso_clases (usuario_id);

-- =====================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================
COMMENT ON TABLE public.perfiles_usuario IS 'Usuarios: estudiantes, instructores, administradores';
COMMENT ON TABLE public.cursos IS 'Cursos disponibles en la plataforma';
COMMENT ON TABLE public.modulos IS 'Módulos que organizan las clases dentro de un curso';
COMMENT ON TABLE public.clases IS 'Clases individuales con contenido de video';
COMMENT ON TABLE public.materiales IS 'Materiales descargables asociados a cursos';
COMMENT ON TABLE public.inscripciones IS 'Registro de inscripciones de usuarios a cursos';
COMMENT ON TABLE public.simulacros IS 'Exámenes y simulacros con múltiples modos de evaluación';
COMMENT ON TABLE public.preguntas IS 'Preguntas con soporte para tipos complejos';
COMMENT ON TABLE public.opciones_respuesta IS 'Opciones de respuesta con puntajes parciales';
COMMENT ON TABLE public.elementos_pregunta IS 'Elementos para preguntas complejas (emparejamiento, ordenamiento)';
COMMENT ON TABLE public.intentos_simulacro IS 'Registro de intentos de simulacros por usuario';
COMMENT ON TABLE public.respuestas_usuario IS 'Respuestas específicas de usuarios en cada intento';
COMMENT ON TABLE public.progreso_clases IS 'Seguimiento del progreso de visualización de clases';

-- =====================================================
-- FIN DEL SCRIPT DEFINITIVO
-- =====================================================

-- Hacer opcion_seleccionada_id NULLABLE para tipos complejos
ALTER TABLE respuestas_usuario
ALTER COLUMN opcion_seleccionada_id DROP NOT NULL;

ALTER TABLE respuestas_usuario
ALTER COLUMN es_correcta DROP NOT NULL;