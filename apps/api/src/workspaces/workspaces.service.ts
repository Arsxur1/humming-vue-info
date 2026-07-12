import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import {
  ASSIGNABLE_ROLES,
  type CreateWorkspaceDto,
  type InviteMemberDto,
  type Role,
  type UpdateWorkspaceDto,
} from '@avatarstudio/shared';
import { DB, type Db } from '../db/client.js';
import { invitations, users, workspaceMembers, workspaces } from '../db/schema.js';
import { AuditService } from '../audit/audit.service.js';
import { MailerService } from '../mailer/mailer.service.js';
import type { AuthenticatedUser } from '../auth/auth.guard.js';

const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MailerService) private readonly mailer: MailerService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(dto: CreateWorkspaceDto, actor: AuthenticatedUser) {
    const workspace = await this.db.transaction(async (tx) => {
      const [ws] = await tx
        .insert(workspaces)
        .values({ name: dto.name, ownerId: actor.id })
        .returning();
      if (!ws) throw new Error('insert workspaces: пустой результат');
      await tx
        .insert(workspaceMembers)
        .values({ workspaceId: ws.id, userId: actor.id, role: 'owner' });
      return ws;
    });
    await this.audit.record({
      workspaceId: workspace.id,
      actorId: actor.id,
      action: 'workspace.created',
      target: workspace.id,
      meta: { name: workspace.name },
    });
    return workspace;
  }

  async listForUser(userId: string) {
    return this.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        role: workspaceMembers.role,
        createdAt: workspaces.createdAt,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId));
  }

  async update(workspaceId: string, dto: UpdateWorkspaceDto, actor: AuthenticatedUser) {
    const [ws] = await this.db
      .update(workspaces)
      .set({ name: dto.name })
      .where(eq(workspaces.id, workspaceId))
      .returning();
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'workspace.updated',
      target: workspaceId,
      meta: { name: dto.name },
    });
    return ws;
  }

  async listMembers(workspaceId: string) {
    return this.db
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        name: users.name,
        email: users.email,
        joinedAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));
  }

  async invite(
    workspaceId: string,
    dto: InviteMemberDto,
    actor: AuthenticatedUser,
    actorRole: Role,
  ) {
    if (!ASSIGNABLE_ROLES[actorRole].includes(dto.role)) {
      throw new ForbiddenException({
        error: {
          code: 'ROLE_NOT_ASSIGNABLE',
          message: `Ваша роль (${actorRole}) не может назначать роль ${dto.role}. Попросите Owner.`,
        },
      });
    }

    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    if (existingUser) {
      const membership = await this.db.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, existingUser.id),
        ),
      });
      if (membership) {
        throw new ConflictException({
          error: {
            code: 'ALREADY_MEMBER',
            message: 'Этот пользователь уже участник workspace.',
          },
        });
      }
    }

    const token = randomBytes(32).toString('base64url');
    const [invitation] = await this.db
      .insert(invitations)
      .values({
        workspaceId,
        email,
        role: dto.role,
        token,
        invitedBy: actor.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      })
      .returning();
    if (!invitation) throw new Error('insert invitations: пустой результат');

    await this.mailer.send({
      to: email,
      subject: 'Приглашение в AvatarStudio',
      body: `Вас пригласили в workspace с ролью ${dto.role}. Токен приглашения: ${token}`,
    });
    await this.audit.record({
      workspaceId,
      actorId: actor.id,
      action: 'member.invited',
      target: email,
      meta: { role: dto.role },
    });

    return { id: invitation.id, email, role: invitation.role, expiresAt: invitation.expiresAt };
  }

  async acceptInvite(token: string, actor: AuthenticatedUser) {
    const invitation = await this.db.query.invitations.findFirst({
      where: and(
        eq(invitations.token, token),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    });
    if (!invitation) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_INVITATION',
          message: 'Приглашение недействительно или истекло. Запросите новое.',
        },
      });
    }
    if (invitation.email !== actor.email.toLowerCase()) {
      throw new ForbiddenException({
        error: {
          code: 'INVITATION_EMAIL_MISMATCH',
          message: `Приглашение выдано на другой e-mail (${invitation.email}). Войдите под ним.`,
        },
      });
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, invitation.id));
      await tx.insert(workspaceMembers).values({
        workspaceId: invitation.workspaceId,
        userId: actor.id,
        role: invitation.role,
      });
    });
    await this.audit.record({
      workspaceId: invitation.workspaceId,
      actorId: actor.id,
      action: 'member.joined',
      target: actor.id,
      meta: { role: invitation.role },
    });

    return { workspaceId: invitation.workspaceId, role: invitation.role };
  }
}
