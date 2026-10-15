import { ImmersionType } from '@prisma/client';

export interface ImmersionLogResponseDto {
  id: string;
  userId: string;
  type: ImmersionType;
  title: string;
  episode: string | null;
  durationMinutes: number;
  comprehension: number | null;
  isActive: boolean;
  notes: string | null;
  loggedAt: string;
  createdAt: string;
}

export interface ImmersionPaginationDto {
  page: number;
  perPage: number;
  total: number;
  pages: number;
}

export interface PaginatedImmersionLogResponseDto {
  data: ImmersionLogResponseDto[];
  pagination: ImmersionPaginationDto;
}

export interface DeleteImmersionLogResponseDto {
  success: boolean;
  id: string;
}
