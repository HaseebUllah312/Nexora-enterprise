import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeliveryChallanService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { salesOrderId: string; vehicleId?: string; driverName?: string; deliveredTo?: string; branchId: string; }) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: dto.salesOrderId },
      include: { items: { include: { product: true } }, customer: true },
    });
    if (!order) throw new NotFoundException('Sales order not found');

    const challanNo = `DC-${Date.now()}`;
    const items = order.items.map(i => ({
      productId: i.productId, productName: i.product.name,
      quantity: Number(i.quantity), unit: i.product.unit,
    }));

    return this.prisma.deliveryChallan.create({
      data: {
        challanNo, salesOrderId: dto.salesOrderId,
        vehicleId: dto.vehicleId, driverName: dto.driverName,
        deliveredTo: dto.deliveredTo ?? order.customer.name,
        items: items as any, branchId: dto.branchId,
      },
      include: { salesOrder: { include: { customer: true } }, vehicle: true, branch: true },
    });
  }

  findAll(branchId?: string) {
    return this.prisma.deliveryChallan.findMany({
      where: branchId ? { branchId } : {},
      include: { salesOrder: { include: { customer: true } }, vehicle: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.deliveryChallan.findUnique({
      where: { id },
      include: {
        salesOrder: { include: { customer: true, branch: true, items: { include: { product: true } } } },
        vehicle: true, branch: true,
      },
    });
    if (!c) throw new NotFoundException('Delivery challan not found');
    return c;
  }

  async markDelivered(id: string) {
    return this.prisma.deliveryChallan.update({
      where: { id },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
  }
}
