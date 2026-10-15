-- AlterTable
-- O banco de produção já possuía a coluna nullable (schema drift com o schema.prisma).
-- Esta migration alinha o histórico de migrations com o estado real do banco e com
-- o schema.prisma, cujo campo Vocabulary.jlptLevel passou a ser opcional.
ALTER TABLE "vocabulary" ALTER COLUMN "jlptLevel" DROP NOT NULL;
