import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  roleId: string;
  roleName: string;
  branchId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Attached to request.user
    return {
      userId: payload.sub,
      email: payload.email,
      roleId: payload.roleId,
      roleName: payload.roleName,
      branchId: payload.branchId,
    };
  }
}
