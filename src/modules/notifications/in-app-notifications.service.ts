import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { User } from '@/modules/users/entities/user.entity';
import { InAppNotification } from './entities/in-app-notification.entity';

const DEFAULT_LIMIT = 30;

@Injectable()
export class InAppNotificationsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private get repo() {
    return this.dataSource.getRepository(InAppNotification);
  }

  create(userId: string, title: string, message: string, href?: string) {
    return this.repo.save(
      this.repo.create({ userId, title, message, href: href ?? null, readAt: null }),
    );
  }

  async createForEmail(email: string, title: string, message: string, href?: string) {
    const user = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .select('user.id')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() })
      .getOne();
    if (!user) return null;
    return this.create(user.id, title, message, href);
  }

  /** Notify every active user of a role (validators can be scoped to their assigned state). */
  async createForRole(
    role: string,
    title: string,
    message: string,
    href?: string,
    scope: { state?: string } = {},
  ): Promise<number> {
    const query = this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .select('user.id')
      .where('user.role = :role', { role })
      .andWhere('user.isActive = true');
    if (scope.state) {
      query.andWhere('UPPER(user.assignedState) = UPPER(:state)', { state: scope.state.trim() });
    }
    const users = await query.getMany();
    if (users.length === 0) return 0;
    await this.repo.save(
      users.map((user) =>
        this.repo.create({ userId: user.id, title, message, href: href ?? null, readAt: null }),
      ),
    );
    return users.length;
  }

  async listMine(userId: string, limit = DEFAULT_LIMIT) {
    const [rows, unreadCount] = await Promise.all([
      this.repo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: limit,
      }),
      this.repo.count({ where: { userId, readAt: IsNull() } }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        href: row.href ?? null,
        read: row.readAt !== null,
        createdAt: new Date(row.createdAt).toISOString(),
      })),
      unreadCount,
    };
  }

  async markAllRead(userId: string) {
    const result = await this.repo.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return { marked: result.affected ?? 0 };
  }
}
