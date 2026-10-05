import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class UserRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Cria um novo usuário no banco de dados
   * @param data Dados do usuário (email, passwordHash, name, username)
   * @returns Usuário criado
   */
  async create(data: {
    email: string;
    username: string;
    passwordHash: string;
    displayName?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash,
        displayName: data.displayName,
      },
    });
  }

  /**
   * Busca um usuário por email
   * @param email Email do usuário
   * @returns Usuário encontrado ou null
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Busca um usuário por ID
   * @param id ID do usuário
   * @returns Usuário encontrado ou null
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Busca um usuário por username
   * @param username Username do usuário
   * @returns Usuário encontrado ou null
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * Atualiza informações de um usuário
   * @param id ID do usuário
   * @param data Dados a atualizar
   * @returns Usuário atualizado
   */
  async update(
    id: string,
    data: Partial<{
      lastLoginAt: Date;
      displayName: string;
      avatarUrl: string;
    }>,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        lastActiveAt: new Date(),
      },
    });
  }

  /**
   * Remove a senha do objeto User para não retornar ao cliente
   * @param user Usuário completo
   * @returns Usuário sem passwordHash
   */
  sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const sanitized = { ...user };
    delete (sanitized as Partial<User>).passwordHash;
    return sanitized;
  }
}
