import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';

@Injectable()
export class ManufacturingService {
  constructor(private prisma: PrismaService) {}

  // ── BOM ──────────────────────────────────────────────────────────────
  createBom(dto: CreateBomDto) {
    return this.prisma.bom.create({
      data: {
        finishedProductId: dto.finishedProductId,
        name: dto.name,
        components: { create: dto.components.map((c) => ({ productId: c.productId, quantity: c.quantity })) },
      },
      include: { finishedProduct: true, components: { include: { product: true } } },
    });
  }

  findAllBoms() {
    return this.prisma.bom.findMany({
      include: { finishedProduct: true, components: { include: { product: true } }, _count: { select: { productionOrders: true } } },
    });
  }

  async findOneBom(id: string) {
    const bom = await this.prisma.bom.findUnique({
      where: { id },
      include: { finishedProduct: true, components: { include: { product: true } } },
    });
    if (!bom) throw new NotFoundException('BOM not found');
    return bom;
  }

  // ── PRODUCTION ORDERS ─────────────────────────────────────────────────
  // On start: consume raw materials from the branch's first warehouse.
  // On complete: add finished goods to stock and record all movements.

  async createProductionOrder(dto: CreateProductionOrderDto) {
    const bom = await this.findOneBom(dto.bomId);
    const orderNo = `PRD-${Date.now()}`;
    return this.prisma.productionOrder.create({
      data: {
        orderNo,
        bomId: dto.bomId,
        branchId: dto.branchId,
        quantityPlanned: dto.quantityPlanned,
        status: 'PLANNED',
      },
      include: { bom: { include: { finishedProduct: true } } },
    });
  }

  findAllOrders(branchId?: string, status?: string) {
    return this.prisma.productionOrder.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: { bom: { include: { finishedProduct: true } }, branch: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneOrder(id: string) {
    const o = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: { bom: { include: { components: { include: { product: true } }, finishedProduct: true } }, branch: true },
    });
    if (!o) throw new NotFoundException('Production order not found');
    return o;
  }

  async startProduction(id: string) {
    const order = await this.findOneOrder(id);
    if (order.status !== 'PLANNED') throw new BadRequestException('Only PLANNED orders can be started');

    const warehouse = await this.prisma.warehouse.findFirst({ where: { branchId: order.branchId } });
    if (!warehouse) throw new BadRequestException('No warehouse found for this branch');

    return this.prisma.$transaction(async (tx) => {
      // Consume raw materials — multiply each BOM component quantity by planned production qty
      for (const comp of order.bom.components) {
        const needed = Number(comp.quantity) * Number(order.quantityPlanned);
        const stock = await tx.stock.findFirst({
          where: { productId: comp.productId, warehouseId: warehouse.id },
        });
        if (!stock || Number(stock.quantity) < needed) {
          throw new BadRequestException(
            `Insufficient stock of ${comp.product.name}: need ${needed}, have ${stock ? Number(stock.quantity) : 0}`,
          );
        }
        await tx.stock.update({ where: { id: stock.id }, data: { quantity: { decrement: needed } } });
        await tx.stockMovement.create({
          data: {
            productId: comp.productId,
            type: 'PRODUCTION_CONSUMPTION',
            quantity: -needed,
            referenceType: 'ProductionOrder',
            referenceId: order.id,
          },
        });
      }
      return tx.productionOrder.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });
    }, { timeout: 30000 });
  }

  async completeProduction(id: string, quantityProduced: number, wastage: number = 0) {
    const order = await this.findOneOrder(id);
    if (order.status !== 'IN_PROGRESS') throw new BadRequestException('Order is not IN_PROGRESS');

    const warehouse = await this.prisma.warehouse.findFirst({ where: { branchId: order.branchId } });
    if (!warehouse) throw new BadRequestException('No warehouse found for this branch');

    const finishedProductId = order.bom.finishedProductId;

    return this.prisma.$transaction(async (tx) => {
      // Add finished goods to stock
      await tx.stock.upsert({
        where: { productId_warehouseId_batchNumber: { productId: finishedProductId, warehouseId: warehouse.id, batchNumber: '' } },
        update: { quantity: { increment: quantityProduced } },
        create: { productId: finishedProductId, warehouseId: warehouse.id, branchId: order.branchId, quantity: quantityProduced },
      });
      await tx.stockMovement.create({
        data: {
          productId: finishedProductId,
          type: 'PRODUCTION_OUTPUT',
          quantity: quantityProduced,
          referenceType: 'ProductionOrder',
          referenceId: id,
          notes: `Production complete. Wastage: ${wastage}`,
        },
      });
      return tx.productionOrder.update({
        where: { id },
        data: { status: 'COMPLETED', quantityProduced, wastage, completedAt: new Date() },
      });
    }, { timeout: 30000 });
  }

  async productionStats(branchId?: string) {
    const orders = await this.prisma.productionOrder.findMany({
      where: { ...(branchId ? { branchId } : {}), status: 'COMPLETED' },
    });
    return {
      totalOrders: orders.length,
      totalProduced: orders.reduce((s, o) => s + Number(o.quantityProduced), 0),
      totalWastage: orders.reduce((s, o) => s + Number(o.wastage), 0),
    };
  }
}
