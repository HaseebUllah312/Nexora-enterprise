import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('vehicles')
@UseGuards(RolesGuard)
export class VehiclesController {
  constructor(private service: VehiclesService) {}

  @Post() create(@Body() dto: CreateVehicleDto) { return this.service.create(dto); }
  @Get() findAll(@Query('branchId') b?: string) { return this.service.findAll(b); }
  @Get('fleet-summary') fleetSummary(@Query('branchId') b?: string) { return this.service.fleetSummary(b); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post(':id/deliveries') createDelivery(@Param('id') id: string, @Body('route') route?: string) { return this.service.createDelivery(id, route); }
  @Patch('deliveries/:id/complete') complete(@Param('id') id: string) { return this.service.completeDelivery(id); }

  @Post(':id/logs') addLog(@Param('id') id: string, @Body() dto: any) { return this.service.addLog(id, dto); }
  @Get(':id/logs') getLogs(@Param('id') id: string) { return this.service.getLogs(id); }
}
