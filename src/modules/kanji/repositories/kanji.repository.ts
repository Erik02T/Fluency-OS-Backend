import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { KanjiFiltersDto } from '../dto';

@Injectable()
export class KanjiRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Busca lista de kanjis com filtros e paginação
   * @param filters KanjiFiltersDto com jlpt, grade, search, etc
   * @returns Array de kanjis com meanings, readings, exemplos
   */
  async findAll(filters: KanjiFiltersDto): Promise<any[]> {
    const skip = (filters.page - 1) * filters.perPage;

    // Construir WHERE clause dinamicamente
    const where: Prisma.KanjiWhereInput = {
      AND: this.buildWhereConditions(filters),
    };

    // Construir ORDER BY
    const orderBy = this.buildOrderBy(filters.sort);

    return this.prisma.kanji.findMany({
      where,
      orderBy,
      skip,
      take: filters.perPage,
      include: {
        meanings: {
          where: { language: 'pt-BR', isPrimary: true },
          select: { meaning: true },
        },
        readings: {
          select: {
            reading: true,
            type: true,
            isPrimary: true,
          },
        },
      },
    });
  }

  /**
   * Contar total de kanjis com filtros
   * @param filters KanjiFiltersDto
   * @returns Contagem total
   */
  async count(filters: KanjiFiltersDto): Promise<number> {
    const where: Prisma.KanjiWhereInput = {
      AND: this.buildWhereConditions(filters),
    };

    return this.prisma.kanji.count({ where });
  }

  /**
   * Buscar kanji por ID com todos os dados
   * @param id ID do kanji
   * @returns Kanji completo com meanings, readings, examples, radicals
   */
  async findByIdFull(id: string): Promise<any> {
    return this.prisma.kanji.findUnique({
      where: { id },
      include: {
        meanings: {
          orderBy: { position: 'asc' },
        },
        readings: {
          orderBy: { reading: 'asc' },
        },
        examples: {
          take: 10,
          orderBy: { position: 'asc' },
        },
        radicals: {
          include: {
            radical: true,
          },
        },
      },
    });
  }

  /**
   * Buscar kanji por character
   * @param character Caractere do kanji (ex: "日")
   * @returns Kanji encontrado ou null
   */
  async findByCharacter(character: string): Promise<any> {
    return this.prisma.kanji.findUnique({
      where: { character },
      include: {
        meanings: true,
        readings: true,
        examples: { take: 10 },
        radicals: { include: { radical: true } },
      },
    });
  }

  /**
   * Buscar por term (character, meaning, onyomi, kunyomi)
   * Usa ILIKE para case-insensitive partial match
   * @param search Termo de busca
   * @param limit Número máximo de resultados
   * @returns Array de kanjis
   */
  async search(search: string, limit: number = 50): Promise<any[]> {
    if (!search || search.length < 1) {
      return [];
    }

    const searchTerm = `%${search}%`;

    return this.prisma.$queryRaw`
      SELECT DISTINCT k.* 
      FROM "Kanji" k
      LEFT JOIN "KanjiMeaning" km ON k."id" = km."kanjiId" AND km."language" = 'pt-BR'
      LEFT JOIN "KanjiReading" kr ON k."id" = kr."kanjiId"
      WHERE 
        k."character" ILIKE ${searchTerm}
        OR km."meaning" ILIKE ${searchTerm}
        OR kr."reading" ILIKE ${searchTerm}
        OR kr."romanization" ILIKE ${searchTerm}
      ORDER BY k."frequencyRank" ASC
      LIMIT ${limit}
    `;
  }

  /**
   * Construir WHERE conditions baseado em filtros
   * @param filters KanjiFiltersDto
   * @returns Array de condições para AND
   */
  private buildWhereConditions(
    filters: KanjiFiltersDto,
  ): Prisma.KanjiWhereInput[] {
    const conditions: Prisma.KanjiWhereInput[] = [];

    if (filters.jlpt) {
      conditions.push({ jlptLevel: filters.jlpt });
    }

    if (filters.grade) {
      conditions.push({ grade: filters.grade });
    }

    if (filters.search && filters.search.length > 0) {
      conditions.push({
        character: {
          contains: filters.search,
          mode: 'insensitive',
        },
      });
      conditions.push({
        OR: [
          { character: { contains: filters.search } },
          {
            meanings: {
              some: {
                meaning: { contains: filters.search, mode: 'insensitive' },
                language: 'pt-BR',
              },
            },
          },
          {
            readings: {
              some: {
                OR: [
                  { reading: { contains: filters.search } },
                  {
                    romanji: { contains: filters.search, mode: 'insensitive' },
                  },
                ],
              },
            },
          },
        ],
      });
    }

    return conditions;
  }

  /**
   * Construir ORDER BY baseado em sort parameter
   * @param sort Campo para ordenação
   * @returns Ordenação Prisma
   */
  private buildOrderBy(sort?: string): Prisma.KanjiOrderByWithRelationInput {
    switch (sort) {
      case 'jlpt':
        return { jlptLevel: 'asc' };
      case 'grade':
        return { grade: 'asc' };
      case 'strokes':
        return { strokeCount: 'asc' };
      case 'frequency':
      default:
        return { frequency: 'asc' };
    }
  }
}
