import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AiAnalyticsService } from './ai-analytics.service';
import { IsString } from 'class-validator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class AskDto { @IsString() question: string; }

@Controller('ai')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'OWNER', 'FACTORY_MANAGER')
export class AiAnalyticsController {
  constructor(private service: AiAnalyticsService) {}

  @Post('ask')
  ask(@Body() dto: AskDto, @Query('branchId') branchId?: string) {
    return this.service.ask(dto.question, branchId);
  }

  @Get('top-products')
  topProducts(@Query('branchId') b?: string, @Query('limit') l?: string) {
    return this.service.topProducts(b, l ? Number(l) : 10);
  }

  @Get('slow-moving')
  slowMoving(@Query('days') d?: string) {
    return this.service.slowMovingInventory(d ? Number(d) : 30);
  }
}
