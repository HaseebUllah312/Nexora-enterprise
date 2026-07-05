import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const email = dto.email ? dto.email.trim().toLowerCase() : dto.email;
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    // Same error for "no user" and "wrong password" — don't leak which one
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active. Contact your administrator.');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Invalid email or password');

    const tokens = await this.issueTokens(user.id, user.email, user.roleId, user.role.name, user.branchId);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ipAddress: ip },
    });

    const { passwordHash, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    // Rotate: revoke the used token, issue a new pair
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('User no longer active');

    return this.issueTokens(user.id, user.email, user.roleId, user.role.name, user.branchId);
  }

  async logout(userId: string, refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash },
      data: { revoked: true },
    });
    return { success: true };
  }

  private async issueTokens(
    sub: string,
    email: string,
    roleId: string,
    roleName: string,
    branchId: string | null,
  ) {
    const payload = { sub, email, roleId, roleName, branchId };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // matches JWT_REFRESH_EXPIRES_IN default

    await this.prisma.refreshToken.create({
      data: { userId: sub, tokenHash: this.hashToken(refreshToken), expiresAt },
    });

    return { accessToken, refreshToken };
  }

  // Refresh tokens are stored hashed (never raw) so a DB leak doesn't hand out live sessions
  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }
}
