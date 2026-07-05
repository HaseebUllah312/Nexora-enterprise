import { Injectable, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async create(dto: CreateUserDto) {
    const email = dto.email ? dto.email.trim().toLowerCase() : dto.email;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('A user with this email already exists');

    const passwordHash = await this.authService.hashPassword(dto.password);
    const { password, ...rest } = dto;

    const user = await this.prisma.user.create({
      data: { ...rest, email, passwordHash },
      include: { role: true, branch: true },
    });
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  async findAll(currentUser: any, branchId?: string) {
    const users = await this.prisma.user.findMany({
      where: branchId ? { branchId } : undefined,
      include: { role: true, branch: true },
      orderBy: { createdAt: 'desc' },
    });
    
    const safeUsers = users.map(({ passwordHash, ...u }) => u);
    if (currentUser && currentUser.roleName !== 'SUPER_ADMIN') {
      return safeUsers.filter(u => u.role.name !== 'SUPER_ADMIN');
    }
    return safeUsers;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true, branch: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.findOne(id);
    const updateData = { ...dto };
    if (updateData.email) {
      updateData.email = updateData.email.trim().toLowerCase();
      if (updateData.email !== existing.email.toLowerCase()) {
        const emailTaken = await this.prisma.user.findUnique({ where: { email: updateData.email } });
        if (emailTaken) throw new ConflictException('A user with this email already exists');
      }
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true, branch: true },
    });
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft delete — deactivate rather than destroy to preserve historical records
    return this.prisma.user.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  /** SUPER_ADMIN: reset any user's password without knowing the old one */
  async resetPassword(targetUserId: string, newPassword: string) {
    await this.findOne(targetUserId);
    const passwordHash = await this.authService.hashPassword(newPassword);
    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash },
    });
    // Revoke all refresh tokens — boots them out of every active session
    await this.prisma.refreshToken.updateMany({
      where: { userId: targetUserId },
      data: { revoked: true },
    });
    const { passwordHash: _, ...safe } = user;
    return { success: true, user: safe, message: 'Password reset. All active sessions have been revoked.' };
  }

  /** Self-service: user changes their own password (must know current password) */
  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await this.authService.hashPassword(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Revoke all refresh tokens so they re-authenticate with the new password
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });

    return { success: true, message: 'Password changed successfully. Please log in again.' };
  }
}
