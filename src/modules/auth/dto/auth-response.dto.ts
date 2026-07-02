export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: {
    id: string;
    email: string;
    username: string;
    name?: string | null;
    avatarUrl?: string | null;
    jlptGoal?: string;
    dailyGoalMin?: number;
    createdAt?: Date;
    updatedAt?: Date;
  };
}
