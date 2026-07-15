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

  async importProducts(dtoList: any[]) {
    const results: any[] = [];
    const firstWarehouse = await this.prisma.warehouse.findFirst();

    for (const item of dtoList) {
      // 1. Resolve or create category if name is provided
      let categoryId: string | null = null;
      if (item.categoryName) {
        let cat = await this.prisma.category.findFirst({
          where: { name: item.categoryName }
        });
        if (!cat) {
          cat = await this.prisma.category.create({
            data: { name: item.categoryName }
          });
        }
        categoryId = cat.id;
      }

      // 2. Format product fields
      const productCode = String(item.productCode || '').trim();
      const sku = String(item.sku || productCode || '').trim();
      const name = String(item.name || '').trim();
      const unit = String(item.unit || 'PCS').trim();
      const purchasePrice = Number(item.purchasePrice || 0);
      const salePrice = Number(item.salePrice || 0);
      const openingStock = Number(item.openingStock || 0);
      const brand = item.brand ? String(item.brand).trim() : null;

      // 3. Skip if code or name is missing
      if (!productCode || !name) continue;

      // 4. Find if product already exists
      const existingProduct = await this.prisma.product.findFirst({
        where: { OR: [{ productCode }, { sku }] }
      });

      if (existingProduct) {
        // Update price, name, brand
        const updated = await this.prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            name,
            purchasePrice,
            salePrice,
            brand,
            categoryId
          }
        });
        results.push({ ...updated, status: 'updated' });
      } else {
        // Create new product
        const newProduct = await this.prisma.product.create({
          data: {
            sku,
            productCode,
            name,
            unit,
            purchasePrice,
            salePrice,
            openingStock,
            brand,
            categoryId
          }
        });

        // 5. Create initial stock record if opening stock > 0
        if (openingStock > 0 && firstWarehouse) {
          await this.prisma.stock.create({
            data: {
              productId: newProduct.id,
              warehouseId: firstWarehouse.id,
              branchId: firstWarehouse.branchId,
              quantity: openingStock,
              batchNumber: ''
            }
          });
          
          await this.prisma.stockMovement.create({
            data: {
              productId: newProduct.id,
              quantity: openingStock,
              type: 'STOCK_IN',
              notes: 'Opening stock from Excel import'
            }
          });
        }
        results.push({ ...newProduct, status: 'created' });
      }
    }
    return { success: true, count: results.length, data: results };
  }
}

