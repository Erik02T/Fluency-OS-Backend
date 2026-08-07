import { ImmersionType } from '@prisma/client';

export class ImmersionLogResponseDto {
  id!: string;
  userId!: string;
  type!: ImmersionType;
  title!: string;
  episode!: string | null;
  durationMinutes!: number;
  comprehension!: number | null;
  isActive!: boolean;
  notes!: string | null;
  loggedAt!: Date;
  createdAt!: Date;
}

export class PaginatedImmersionLogResponseDto {
  data!: ImmersionLogResponseDto[];
  pagination!: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
  };
}
