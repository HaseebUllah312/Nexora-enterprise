import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateVehicleDto) { return this.prisma.vehicle.create({ data: dto }); }

  findAll(branchId?: string) {
    return this.prisma.vehicle.findMany({
      where: branchId ? { branchId } : undefined,
      include: { branch: true, _count: { select: { deliveries: true, logs: true } } },
      orderBy: { plateNumber: 'asc' },
    });
  }

  async findOne(id: string) {
    const v = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 20 }, logs: { orderBy: { logDate: 'desc' }, take: 20 } },
    });
    if (!v) throw new NotFoundException('Vehicle not found');
    return v;
  }

  async createDelivery(vehicleId: string, route?: string) {
    await this.findOne(vehicleId);
    return this.prisma.delivery.create({ data: { vehicleId, route } });
  }

  async completeDelivery(id: string) {
    return this.prisma.delivery.update({
      where: { id },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
  }

  // ── Fuel & Maintenance Logs ────────────────────────────────────────────
  async addLog(vehicleId: string, dto: { type: string; amount: number; odometer?: number; description?: string; logDate?: string }) {
    return this.prisma.vehicleLog.create({
      data: {
        vehicleId, type: dto.type, amount: dto.amount,
        odometer: dto.odometer, description: dto.description,
        logDate: dto.logDate ? new Date(dto.logDate) : new Date(),
      },
    });
  }

  async getLogs(vehicleId: string) {
    return this.prisma.vehicleLog.findMany({ where: { vehicleId }, orderBy: { logDate: 'desc' } });
  }

  async fleetSummary(branchId?: string) {
    const vehicles = await this.prisma.vehicle.findMany({ where: branchId ? { branchId } : {} });
    const logs = await this.prisma.vehicleLog.findMany({
      where: { vehicleId: { in: vehicles.map(v => v.id) } },
    });
    const fuelCost  = logs.filter(l => l.type === 'FUEL').reduce((s, l) => s + Number(l.amount), 0);
    const maintCost = logs.filter(l => l.type === 'MAINTENANCE').reduce((s, l) => s + Number(l.amount), 0);
    return { totalVehicles: vehicles.length, totalFuelCost: fuelCost, totalMaintenanceCost: maintCost, totalCost: fuelCost + maintCost };
  }
}
