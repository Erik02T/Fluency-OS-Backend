import { ImmersionLog, ImmersionType } from '@prisma/client';

export type ImmersionLogEntity = ImmersionLog;

export interface ImmersionLogCreateInput {
  userId: string;
  type: ImmersionType;
  title: string;
  durationMinutes: number;
  episode?: string | null;
  comprehension?: number | null;
  notes?: string | null;
  isActive?: boolean;
  loggedAt?: Date;
}

export interface ImmersionLogListInput {
  page: number;
  perPage: number;
  type?: ImmersionType;
  startDate?: Date;
  endDate?: Date;
  sort?: 'loggedAt' | 'durationMinutes' | 'createdAt';
  order?: 'asc' | 'desc';
}
