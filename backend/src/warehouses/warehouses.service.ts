import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWarehouseDto) {
    const existing = await this.prisma.warehouse.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('A warehouse with this code already exists');
    return this.prisma.warehouse.create({ data: dto });
  }

  findAll(branchId?: string) {
    return this.prisma.warehouse.findMany({
      where: branchId ? { branchId } : undefined,
      include: { branch: true, _count: { select: { stock: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { branch: true },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    await this.findOne(id);
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.warehouse.delete({ where: { id } });
  }
}
