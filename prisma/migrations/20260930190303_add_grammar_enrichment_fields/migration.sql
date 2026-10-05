-- AlterTable
ALTER TABLE "grammar_examples" ADD COLUMN     "characterCount" INTEGER,
ADD COLUMN     "furigana" JSONB,
ADD COLUMN     "kanjiBreakdown" JSONB,
ADD COLUMN     "wordCount" INTEGER;

-- AlterTable
ALTER TABLE "grammar_points" ADD COLUMN     "enrichmentData" JSONB,
ADD COLUMN     "patternFurigana" JSONB,
ADD COLUMN     "patternKanjiBreakdown" JSONB;
