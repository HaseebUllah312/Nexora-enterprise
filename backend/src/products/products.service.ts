import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const clash = await this.prisma.product.findFirst({
      where: {
        OR: [
          { sku: dto.sku },
          { productCode: dto.productCode },
          ...(dto.barcode ? [{ barcode: dto.barcode }] : []),
        ],
      },
    });
    if (clash) throw new ConflictException('SKU, product code, or barcode already in use');

    return this.prisma.product.create({ data: dto, include: { category: true } });
  }

  findAll(query: QueryProductDto) {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.isRawMaterial !== undefined ? { isRawMaterial: query.isRawMaterial === 'true' } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { sku: { contains: query.search } },
              { productCode: { contains: query.search } },
              { barcode: { contains: query.search } },
            ],
          }
        : {}),
    };

    return this.prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, stock: { include: { branch: true, warehouse: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto, include: { category: true } });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Products are referenced by sales/purchase/production history — deactivate, don't destroy
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  // Used by the dashboard's low-stock widget and AI analytics module later
  async lowStock() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { stock: true },
    });
    return products
      .map((p) => ({
        ...p,
        totalStock: p.stock.reduce((sum, s) => sum + Number(s.quantity), 0),
      }))
      .filter((p) => p.totalStock <= Number(p.minimumStock));
  }


  // Full movement history for one product — the "stock card" / ledger view
  async stockLedger(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { stock: { include: { warehouse: true, branch: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');

    const movements = await this.prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });

    let runningBalance = 0;
    const ledger = movements.map(m => {
      runningBalance += Number(m.quantity);
      return {
        date: m.createdAt, type: m.type, quantity: Number(m.quantity),
        referenceType: m.referenceType, referenceId: m.referenceId,
        notes: m.notes, runningBalance,
      };
    });

    const currentStock = product.stock.reduce((s, st) => s + Number(st.quantity), 0);

    return { product, currentStock, byWarehouse: product.stock, ledger: ledger.reverse() };
  }
}

