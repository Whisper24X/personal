import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { OrNeverType } from '../../utils/types/or-never.type';
import { JwtPayloadType } from './types/jwt-payload.type';
import { AllConfigType } from '../../config/config.type';

/**
 * iframe / <img> / PDF 嵌入等无法带 Authorization 头，前端用 ?token= 传递 JWT（见 buildUrl raw 资源）。
 */
const extractJwtFromBearerOrQuery = (req: Request): string | null => {
  const header = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (header) {
    return header;
  }
  const raw = req.query?.token;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim()) {
    return raw[0].trim();
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService<AllConfigType>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractJwtFromBearerOrQuery]),
      secretOrKey: configService.getOrThrow('auth.secret', { infer: true }),
    });
  }

  // Why we don't check if the user exists in the database:
  // https://github.com/brocoders/nestjs-boilerplate/blob/main/docs/auth.md#about-jwt-strategy
  public validate(payload: JwtPayloadType): OrNeverType<JwtPayloadType> {
    if (!payload.sub) {
      throw new UnauthorizedException();
    }

    return payload;
  }
}
