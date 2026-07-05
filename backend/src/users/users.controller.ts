import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'OWNER', 'FACTORY_MANAGER', 'BRANCH_MANAGER')
  findAll(@CurrentUser() currentUser: any, @Query('branchId') branchId?: string) {
    return this.usersService.findAll(currentUser, branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OWNER')
  async update(
    @CurrentUser() currentUser: any,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    if (currentUser.roleName !== 'SUPER_ADMIN') {
      const targetUser = await this.usersService.findOne(id);
      if (targetUser.role.name === 'SUPER_ADMIN') {
        throw new UnauthorizedException('You cannot modify a developer account.');
      }
    }
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'OWNER')
  async remove(
    @CurrentUser() currentUser: any,
    @Param('id') id: string,
  ) {
    if (currentUser.roleName !== 'SUPER_ADMIN') {
      const targetUser = await this.usersService.findOne(id);
      if (targetUser.role.name === 'SUPER_ADMIN') {
        throw new UnauthorizedException('You cannot delete a developer account.');
      }
    }
    return this.usersService.remove(id);
  }

  // ── Password endpoints ────────────────────────────────────────────────────

  /** SUPER_ADMIN: reset any account's password (no old password needed) */
  @Patch(':id/reset-password')
  @Roles('SUPER_ADMIN')
  resetPassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.usersService.resetPassword(id, body.newPassword);
  }

  /** Any logged-in user: change their own password (must know current) */
  @Patch('me/change-password')
  changeOwnPassword(
    @CurrentUser() user: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.usersService.changeOwnPassword(user.userId, body.currentPassword, body.newPassword);
  }
}
