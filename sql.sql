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