import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app-config.type';
import { AllConfigType } from '../config/config.type';

@Injectable()
export class GoalsFeatureGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  canActivate(_context: ExecutionContext): boolean {
    const app = this.configService.get<AppConfig>('app', { infer: true });
    const enabled = app?.goalsEnabled ?? true;
    if (!enabled) {
      throw new NotFoundException();
    }
    return true;
  }
}
