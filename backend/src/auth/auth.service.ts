import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import ms from 'ms';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { AuthUpdateDto } from './dto/auth-update.dto';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { NullableType } from '../utils/types/nullable.type';
import { LoginResponseDto } from './dto/login-response.dto';
import { ConfigService } from '@nestjs/config';
import { JwtRefreshPayloadType } from './strategies/types/jwt-refresh-payload.type';
import { JwtPayloadType } from './strategies/types/jwt-payload.type';
import { UsersService } from '../users/users.service';
import { AllConfigType } from '../config/config.type';
import { User } from '../users/domain/user';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private configService: ConfigService<AllConfigType>,
  ) {}

  async validateLogin(loginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByUsername(loginDto.username);

    if (!user) {
      throw new NotFoundException('userNotFound');
    }

    if (!user.password) {
      throw new UnauthorizedException('incorrectPassword');
    }

    const isValidPassword = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isValidPassword) {
      throw new UnauthorizedException('incorrectPassword');
    }

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: user.id,
      username: user.username,
    });

    return {
      refreshToken,
      token,
      tokenExpires,
      user,
    };
  }

  async register(dto: AuthRegisterLoginDto): Promise<void> {
    await this.usersService.create({
      ...dto,
      username: dto.username,
    });
  }

  async me(userJwtPayload: JwtPayloadType): Promise<NullableType<User>> {
    return this.usersService.findById(userJwtPayload.sub);
  }

  async update(
    userJwtPayload: JwtPayloadType,
    userDto: AuthUpdateDto,
  ): Promise<NullableType<User>> {
    const currentUser = await this.usersService.findById(userJwtPayload.sub);

    if (!currentUser) {
      throw new NotFoundException('userNotFound');
    }

    if (userDto.password) {
      if (!userDto.oldPassword) {
        throw new ConflictException('missingOldPassword');
      }

      if (!currentUser.password) {
        throw new UnauthorizedException('incorrectOldPassword');
      }

      const isValidOldPassword = await bcrypt.compare(
        userDto.oldPassword,
        currentUser.password,
      );

      if (!isValidOldPassword) {
        throw new UnauthorizedException('incorrectOldPassword');
      }
    }

    if (userDto.username && userDto.username !== currentUser.username) {
      const userByUsername = await this.usersService.findByUsername(
        userDto.username,
      );

      if (userByUsername && userByUsername.id !== currentUser.id) {
        throw new ConflictException('usernameAlreadyExists');
      }
    }

    delete userDto.oldPassword;

    await this.usersService.update(userJwtPayload.sub, userDto);

    return this.usersService.findById(userJwtPayload.sub);
  }

  async refreshToken(
    data: Pick<JwtRefreshPayloadType, 'sub'>,
  ): Promise<Omit<LoginResponseDto, 'user'>> {
    const user = await this.usersService.findById(data.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: user.id,
      username: user.username,
    });

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  async softDelete(user: User): Promise<void> {
    await this.usersService.remove(user.id);
  }

  logout(): Promise<void> {
    return Promise.resolve();
  }

  private async getTokensData(data: {
    id: User['id'];
    username: User['username'];
  }) {
    const tokenExpiresIn = this.configService.getOrThrow('auth.expires', {
      infer: true,
    });

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const [token, refreshToken] = await Promise.all([
      await this.jwtService.signAsync(
        {
          sub: data.id,
          username: data.username,
          roles: ['user'],
        },
        {
          secret: this.configService.getOrThrow('auth.secret', { infer: true }),
          expiresIn: tokenExpiresIn,
        },
      ),
      await this.jwtService.signAsync(
        {
          sub: data.id,
          username: data.username,
          roles: ['user'],
        },
        {
          secret: this.configService.getOrThrow('auth.refreshSecret', {
            infer: true,
          }),
          expiresIn: this.configService.getOrThrow('auth.refreshExpires', {
            infer: true,
          }),
        },
      ),
    ]);

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }
}
