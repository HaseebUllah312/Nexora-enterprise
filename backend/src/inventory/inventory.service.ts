import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockInDto } from './dto/stock-in.dto';
import { StockOutDto } from './dto/stock-out.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // ---------------- STOCK QUERIES ----------------

  getStock(branchId?: string, warehouseId?: string) {
    return this.prisma.stock.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: { product: true, warehouse: true, branch: true },
      orderBy: { product: { name: 'asc' } },
    });
  }

  getMovements(productId?: string) {
    return this.prisma.stockMovement.findMany({
      where: productId ? { productId } : undefined,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ---------------- STOCK IN / OUT / ADJUSTMENT ----------------
  // All three use $transaction so the Stock row and its StockMovement audit
  // trail are written atomically — a failure partway never leaves stock and
  // the movement log out of sync.

  async stockIn(dto: StockInDto) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stock.upsert({
        where: {
          productId_warehouseId_batchNumber: {
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            batchNumber: dto.batchNumber ?? '',
          },
        },
        update: { quantity: { increment: dto.quantity } },
        create: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          branchId: warehouse.branchId,
          quantity: dto.quantity,
          batchNumber: dto.batchNumber,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          type: 'STOCK_IN',
          quantity: dto.quantity,
          notes: dto.notes,
        },
      });

      return stock;
    }, { timeout: 30000 });
  }

  async stockOut(dto: StockOutDto) {
    const stock = await this.prisma.stock.findUnique({
      where: {
        productId_warehouseId_batchNumber: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          batchNumber: dto.batchNumber ?? '',
        },
      },
    });
    if (!stock || Number(stock.quantity) < dto.quantity) {
      throw new BadRequestException('Insufficient stock for this product at the selected warehouse');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.stock.update({
        where: { id: stock.id },
        data: { quantity: { decrement: dto.quantity } },
      });

      await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          type: 'STOCK_OUT',
          quantity: dto.quantity,
          notes: dto.notes,
        },
      });

      return updated;
    }, { timeout: 30000 });
  }

  async adjustment(dto: StockAdjustmentDto) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stock.findUnique({
        where: {
          productId_warehouseId_batchNumber: {
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            batchNumber: dto.batchNumber ?? '',
          },
        },
      });

      const previousQty = existing ? Number(existing.quantity) : 0;
      const delta = dto.newQuantity - previousQty;

      const stock = await tx.stock.upsert({
        where: {
          productId_warehouseId_batchNumber: {
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            batchNumber: dto.batchNumber ?? '',
          },
        },
        update: { quantity: dto.newQuantity },
        create: {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          branchId: warehouse.branchId,
          quantity: dto.newQuantity,
          batchNumber: dto.batchNumber,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          type: 'ADJUSTMENT',
          quantity: delta,
          notes: `Physical count adjustment: ${dto.reason} (was ${previousQty}, now ${dto.newQuantity})`,
        },
      });

      return stock;
    }, { timeout: 30000 });
  }

  // ---------------- STOCK TRANSFERS ----------------
  // Lifecycle: REQUESTED -> APPROVED -> DISPATCHED -> IN_TRANSIT -> RECEIVED (or REJECTED)
  // Stock only actually moves at DISPATCHED (leaves source) and RECEIVED (arrives at destination) —
  // this mirrors physical reality: goods in transit aren't in either warehouse's countable stock.

  async createTransfer(dto: CreateTransferDto) {
    if (dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException('Source and destination branch must be different');
    }
    const transferNo = `TRF-${Date.now()}`;
    return this.prisma.stockTransfer.create({
      data: {
        transferNo,
        fromBranchId: dto.fromBranchId,
        toBranchId: dto.toBranchId,
        items: dto.items as any,
        status: 'REQUESTED',
      },
    });
  }

  listTransfers(branchId?: string) {
    return this.prisma.stockTransfer.findMany({
      where: branchId ? { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] } : undefined,
      include: { fromBranch: true, toBranch: true },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async approveTransfer(id: string) {
    return this.transitionTransfer(id, 'REQUESTED', 'APPROVED', { approvedAt: new Date() });
  }

  async dispatchTransfer(id: string) {
    const transfer = await this.getTransferOrThrow(id);
    if (transfer.status !== 'APPROVED') {
      throw new BadRequestException(`Cannot dispatch a transfer in status ${transfer.status}`);
    }

    const items = transfer.items as unknown as { productId: string; quantity: number }[];
    const sourceWarehouse = await this.prisma.warehouse.findFirst({
      where: { branchId: transfer.fromBranchId },
    });
    if (!sourceWarehouse) throw new BadRequestException('Source branch has no warehouse configured');

    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const stock = await tx.stock.findFirst({
          where: { productId: item.productId, warehouseId: sourceWarehouse.id },
        });
        if (!stock || Number(stock.quantity) < item.quantity) {
          throw new BadRequestException(`Insufficient stock for product ${item.productId} to dispatch`);
        }
        await tx.stock.update({ where: { id: stock.id }, data: { quantity: { decrement: item.quantity } } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'TRANSFER',
            quantity: -item.quantity,
            referenceType: 'StockTransfer',
            referenceId: transfer.id,
            notes: `Dispatched to ${transfer.toBranchId}`,
          },
        });
      }
      return tx.stockTransfer.update({
        where: { id },
        data: { status: 'DISPATCHED', dispatchedAt: new Date() },
      });
    }, { timeout: 30000 });
  }

  async receiveTransfer(id: string) {
    const transfer = await this.getTransferOrThrow(id);
    if (transfer.status !== 'DISPATCHED' && transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException(`Cannot receive a transfer in status ${transfer.status}`);
    }

    const items = transfer.items as unknown as { productId: string; quantity: number }[];
    const destWarehouse = await this.prisma.warehouse.findFirst({
      where: { branchId: transfer.toBranchId },
    });
    if (!destWarehouse) throw new BadRequestException('Destination branch has no warehouse configured');

    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.stock.upsert({
          where: {
            productId_warehouseId_batchNumber: {
              productId: item.productId,
              warehouseId: destWarehouse.id,
              batchNumber: '',
            },
          },
          update: { quantity: { increment: item.quantity } },
          create: {
            productId: item.productId,
            warehouseId: destWarehouse.id,
            branchId: transfer.toBranchId,
            quantity: item.quantity,
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'TRANSFER',
            quantity: item.quantity,
            referenceType: 'StockTransfer',
            referenceId: transfer.id,
            notes: `Received from ${transfer.fromBranchId}`,
          },
        });
      }
      return tx.stockTransfer.update({
        where: { id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
    }, { timeout: 30000 });
  }

  async rejectTransfer(id: string) {
    return this.transitionTransfer(id, 'REQUESTED', 'REJECTED', {});
  }

  private async getTransferOrThrow(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException('Stock transfer not found');
    return transfer;
  }

  private async transitionTransfer(
    id: string,
    expectedStatus: string,
    newStatus: 'APPROVED' | 'REJECTED',
    extra: Record<string, any>,
  ) {
    const transfer = await this.getTransferOrThrow(id);
    if (transfer.status !== expectedStatus) {
      throw new BadRequestException(
        `Cannot move transfer from ${transfer.status} to ${newStatus} (expected ${expectedStatus})`,
      );
    }
    return this.prisma.stockTransfer.update({ where: { id }, data: { status: newStatus, ...extra } });
  }
}
