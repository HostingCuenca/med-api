/*
  Warnings:

  - The primary key for the `clases` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `clases` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `cursos` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `cursos` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `instructor_id` column on the `cursos` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `inscripciones` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `inscripciones` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `habilitado_por` column on the `inscripciones` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `intentos_simulacro` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `intentos_simulacro` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `materiales` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `materiales` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `curso_id` column on the `materiales` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `modulos` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `modulos` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `opciones_respuesta` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `opciones_respuesta` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `perfiles_usuario` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `perfiles_usuario` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `preguntas` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `preguntas` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `progreso_clases` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `progreso_clases` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `respuestas_usuario` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `respuestas_usuario` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `simulacros` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `simulacros` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `modulo_id` on the `clases` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `usuario_id` on the `inscripciones` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `curso_id` on the `inscripciones` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `usuario_id` on the `intentos_simulacro` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `simulacro_id` on the `intentos_simulacro` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `curso_id` on the `modulos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `pregunta_id` on the `opciones_respuesta` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `simulacro_id` on the `preguntas` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `usuario_id` on the `progreso_clases` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `clase_id` on the `progreso_clases` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `intento_simulacro_id` on the `respuestas_usuario` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `pregunta_id` on the `respuestas_usuario` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `opcion_seleccionada_id` on the `respuestas_usuario` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `curso_id` on the `simulacros` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "clases" DROP CONSTRAINT "clases_modulo_id_fkey";

-- DropForeignKey
ALTER TABLE "cursos" DROP CONSTRAINT "cursos_instructor_id_fkey";

-- DropForeignKey
ALTER TABLE "inscripciones" DROP CONSTRAINT "inscripciones_curso_id_fkey";

-- DropForeignKey
ALTER TABLE "inscripciones" DROP CONSTRAINT "inscripciones_habilitado_por_fkey";

-- DropForeignKey
ALTER TABLE "inscripciones" DROP CONSTRAINT "inscripciones_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "intentos_simulacro" DROP CONSTRAINT "intentos_simulacro_simulacro_id_fkey";

-- DropForeignKey
ALTER TABLE "intentos_simulacro" DROP CONSTRAINT "intentos_simulacro_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "materiales" DROP CONSTRAINT "materiales_curso_id_fkey";

-- DropForeignKey
ALTER TABLE "modulos" DROP CONSTRAINT "modulos_curso_id_fkey";

-- DropForeignKey
ALTER TABLE "opciones_respuesta" DROP CONSTRAINT "opciones_respuesta_pregunta_id_fkey";

-- DropForeignKey
ALTER TABLE "preguntas" DROP CONSTRAINT "preguntas_simulacro_id_fkey";

-- DropForeignKey
ALTER TABLE "progreso_clases" DROP CONSTRAINT "progreso_clases_clase_id_fkey";

-- DropForeignKey
ALTER TABLE "progreso_clases" DROP CONSTRAINT "progreso_clases_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "respuestas_usuario" DROP CONSTRAINT "respuestas_usuario_intento_simulacro_id_fkey";

-- DropForeignKey
ALTER TABLE "respuestas_usuario" DROP CONSTRAINT "respuestas_usuario_opcion_seleccionada_id_fkey";

-- DropForeignKey
ALTER TABLE "respuestas_usuario" DROP CONSTRAINT "respuestas_usuario_pregunta_id_fkey";

-- DropForeignKey
ALTER TABLE "simulacros" DROP CONSTRAINT "simulacros_curso_id_fkey";

-- AlterTable
ALTER TABLE "clases" DROP CONSTRAINT "clases_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "modulo_id",
ADD COLUMN     "modulo_id" UUID NOT NULL,
ADD CONSTRAINT "clases_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "cursos" DROP CONSTRAINT "cursos_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "instructor_id",
ADD COLUMN     "instructor_id" UUID,
ADD CONSTRAINT "cursos_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "inscripciones" DROP CONSTRAINT "inscripciones_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "usuario_id",
ADD COLUMN     "usuario_id" UUID NOT NULL,
DROP COLUMN "curso_id",
ADD COLUMN     "curso_id" UUID NOT NULL,
DROP COLUMN "habilitado_por",
ADD COLUMN     "habilitado_por" UUID,
ADD CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "intentos_simulacro" DROP CONSTRAINT "intentos_simulacro_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "usuario_id",
ADD COLUMN     "usuario_id" UUID NOT NULL,
DROP COLUMN "simulacro_id",
ADD COLUMN     "simulacro_id" UUID NOT NULL,
ADD CONSTRAINT "intentos_simulacro_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "materiales" DROP CONSTRAINT "materiales_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "curso_id",
ADD COLUMN     "curso_id" UUID,
ADD CONSTRAINT "materiales_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "modulos" DROP CONSTRAINT "modulos_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "curso_id",
ADD COLUMN     "curso_id" UUID NOT NULL,
ADD CONSTRAINT "modulos_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "opciones_respuesta" DROP CONSTRAINT "opciones_respuesta_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "pregunta_id",
ADD COLUMN     "pregunta_id" UUID NOT NULL,
ADD CONSTRAINT "opciones_respuesta_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "perfiles_usuario" DROP CONSTRAINT "perfiles_usuario_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "perfiles_usuario_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "preguntas" DROP CONSTRAINT "preguntas_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "simulacro_id",
ADD COLUMN     "simulacro_id" UUID NOT NULL,
ADD CONSTRAINT "preguntas_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "progreso_clases" DROP CONSTRAINT "progreso_clases_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "usuario_id",
ADD COLUMN     "usuario_id" UUID NOT NULL,
DROP COLUMN "clase_id",
ADD COLUMN     "clase_id" UUID NOT NULL,
ADD CONSTRAINT "progreso_clases_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "respuestas_usuario" DROP CONSTRAINT "respuestas_usuario_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "intento_simulacro_id",
ADD COLUMN     "intento_simulacro_id" UUID NOT NULL,
DROP COLUMN "pregunta_id",
ADD COLUMN     "pregunta_id" UUID NOT NULL,
DROP COLUMN "opcion_seleccionada_id",
ADD COLUMN     "opcion_seleccionada_id" UUID NOT NULL,
ADD CONSTRAINT "respuestas_usuario_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "simulacros" DROP CONSTRAINT "simulacros_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "curso_id",
ADD COLUMN     "curso_id" UUID NOT NULL,
ADD CONSTRAINT "simulacros_pkey" PRIMARY KEY ("id");

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
