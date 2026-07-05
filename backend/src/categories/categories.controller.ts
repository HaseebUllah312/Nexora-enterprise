import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('categories')
@UseGuards(RolesGuard)
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'FACTORY_MANAGER', 'WAREHOUSE_MANAGER')
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get('tree')
  findTree() {
    return this.categoriesService.findTree();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'FACTORY_MANAGER', 'WAREHOUSE_MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'OWNER')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
