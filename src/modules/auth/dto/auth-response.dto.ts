import { Role } from '@prisma/client';

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: {
    id: string;
    email: string;
    role: Role;
    username: string;
    name?: string | null;
    avatarUrl?: string | null;
    jlptGoal?: string;
    dailyGoalMin?: number;
    createdAt?: Date;
    updatedAt?: Date;
  };
}
