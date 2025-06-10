-- CreateTable
CREATE TABLE "perfiles_usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "nombre_usuario" TEXT NOT NULL,
    "telefono" TEXT,
    "avatar_url" TEXT,
    "tipo_usuario" TEXT NOT NULL DEFAULT 'estudiante',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfiles_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursos" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "slug" TEXT NOT NULL,
    "miniatura_url" TEXT,
    "precio" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "descuento" INTEGER NOT NULL DEFAULT 0,
    "tipo_examen" TEXT,
    "es_gratuito" BOOLEAN NOT NULL DEFAULT false,
    "instructor_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modulos" (
    "id" TEXT NOT NULL,
    "curso_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clases" (
    "id" TEXT NOT NULL,
    "modulo_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "video_youtube_url" TEXT,
    "duracion_minutos" INTEGER,
    "es_gratuita" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscripciones" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "curso_id" TEXT NOT NULL,
    "estado_pago" TEXT NOT NULL DEFAULT 'pendiente',
    "fecha_inscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_habilitacion" TIMESTAMP(3),
    "habilitado_por" TEXT,

    CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progreso_clases" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "clase_id" TEXT NOT NULL,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "porcentajeVisto" INTEGER NOT NULL DEFAULT 0,
    "fecha_ultima_vista" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progreso_clases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulacros" (
    "id" TEXT NOT NULL,
    "curso_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "modo_evaluacion" TEXT NOT NULL,
    "tiempo_limite_minutos" INTEGER,
    "tiempo_por_pregunta_segundos" INTEGER,
    "numero_preguntas" INTEGER NOT NULL,
    "intentos_permitidos" INTEGER NOT NULL DEFAULT -1,
    "randomizar_preguntas" BOOLEAN NOT NULL DEFAULT true,
    "randomizar_opciones" BOOLEAN NOT NULL DEFAULT true,
    "mostrar_respuestas_despues" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulacros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preguntas" (
    "id" TEXT NOT NULL,
    "simulacro_id" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL,
    "tipo_pregunta" TEXT NOT NULL,
    "explicacion" TEXT,
    "imagen_url" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preguntas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opciones_respuesta" (
    "id" TEXT NOT NULL,
    "pregunta_id" TEXT NOT NULL,
    "texto_opcion" TEXT NOT NULL,
    "es_correcta" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "opciones_respuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intentos_simulacro" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "simulacro_id" TEXT NOT NULL,
    "puntaje" DECIMAL(5,2),
    "total_preguntas" INTEGER,
    "respuestas_correctas" INTEGER,
    "tiempo_empleado_minutos" INTEGER,
    "fecha_intento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentos_simulacro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respuestas_usuario" (
    "id" TEXT NOT NULL,
    "intento_simulacro_id" TEXT NOT NULL,
    "pregunta_id" TEXT NOT NULL,
    "opcion_seleccionada_id" TEXT NOT NULL,
    "es_correcta" BOOLEAN NOT NULL DEFAULT false,
    "fecha_respuesta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respuestas_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiales" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "archivo_url" TEXT NOT NULL,
    "tipo_archivo" TEXT,
    "precio" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "es_gratuito" BOOLEAN NOT NULL DEFAULT false,
    "curso_id" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materiales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_usuario_email_key" ON "perfiles_usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_usuario_nombre_usuario_key" ON "perfiles_usuario"("nombre_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "cursos_slug_key" ON "cursos"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_usuario_id_curso_id_key" ON "inscripciones"("usuario_id", "curso_id");

-- CreateIndex
CREATE UNIQUE INDEX "progreso_clases_usuario_id_clase_id_key" ON "progreso_clases"("usuario_id", "clase_id");

-- AddForeignKey
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "perfiles_usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modulos" ADD CONSTRAINT "modulos_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clases" ADD CONSTRAINT "clases_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "perfiles_usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_habilitado_por_fkey" FOREIGN KEY ("habilitado_por") REFERENCES "perfiles_usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progreso_clases" ADD CONSTRAINT "progreso_clases_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "perfiles_usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progreso_clases" ADD CONSTRAINT "progreso_clases_clase_id_fkey" FOREIGN KEY ("clase_id") REFERENCES "clases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulacros" ADD CONSTRAINT "simulacros_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preguntas" ADD CONSTRAINT "preguntas_simulacro_id_fkey" FOREIGN KEY ("simulacro_id") REFERENCES "simulacros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opciones_respuesta" ADD CONSTRAINT "opciones_respuesta_pregunta_id_fkey" FOREIGN KEY ("pregunta_id") REFERENCES "preguntas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos_simulacro" ADD CONSTRAINT "intentos_simulacro_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "perfiles_usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos_simulacro" ADD CONSTRAINT "intentos_simulacro_simulacro_id_fkey" FOREIGN KEY ("simulacro_id") REFERENCES "simulacros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas_usuario" ADD CONSTRAINT "respuestas_usuario_intento_simulacro_id_fkey" FOREIGN KEY ("intento_simulacro_id") REFERENCES "intentos_simulacro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas_usuario" ADD CONSTRAINT "respuestas_usuario_pregunta_id_fkey" FOREIGN KEY ("pregunta_id") REFERENCES "preguntas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas_usuario" ADD CONSTRAINT "respuestas_usuario_opcion_seleccionada_id_fkey" FOREIGN KEY ("opcion_seleccionada_id") REFERENCES "opciones_respuesta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiales" ADD CONSTRAINT "materiales_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
