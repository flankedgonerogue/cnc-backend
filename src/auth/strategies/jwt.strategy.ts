import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

type JwtPayload = {
  sub: string;
  email?: string;
  role?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub, {
      includeDeleted: true,
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.deletedAt) {
      throw new UnauthorizedException('User account is deactivated');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
