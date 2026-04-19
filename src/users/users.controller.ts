import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('pairing/confirm')
  async confirmGuardianChildPairing(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!token) {
      return res.redirect(this.usersService.getPairingRedirectUrl(false));
    }

    const result = await this.usersService.confirmPairingToken(token);
    return res.redirect(this.usersService.getPairingRedirectUrl(result.ok));
  }
}
