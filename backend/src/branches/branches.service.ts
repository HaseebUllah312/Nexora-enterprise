import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateBranchDto) {
    const existing = await this.prisma.branch.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('A branch with this code already exists');
    return this.prisma.branch.create({ data: dto });
  }

  findAll() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      include: { _count: { select: { users: true, warehouses: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: { warehouses: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Branches carry too much downstream history to hard-delete — deactivate instead
    return this.prisma.branch.update({ where: { id }, data: { isActive: false } });
  }

  // Owner's consolidated cross-branch view
  async consolidatedSummary() {
    const branches = await this.prisma.branch.findMany({ where: { isActive: true } });
    const summaries = await Promise.all(
      branches.map(async (branch) => {
        const [customerCount, supplierCount, warehouseCount] = await Promise.all([
          this.prisma.customer.count({ where: { branchId: branch.id } }),
          this.prisma.supplier.count({ where: { branchId: branch.id } }),
          this.prisma.warehouse.count({ where: { branchId: branch.id } }),
        ]);
        return { branch, customerCount, supplierCount, warehouseCount };
      }),
    );
    return summaries;
  }
}
