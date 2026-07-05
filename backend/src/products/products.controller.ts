import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('products')
@UseGuards(RolesGuard)
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'FACTORY_MANAGER', 'WAREHOUSE_MANAGER')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query);
  }

  @Get('low-stock')
  lowStock() {
    return this.productsService.lowStock();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'FACTORY_MANAGER', 'WAREHOUSE_MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'OWNER')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Get(':id/stock-ledger')
  stockLedger(@Param('id') id: string) {
    return this.productsService.stockLedger(id);
  }
}
