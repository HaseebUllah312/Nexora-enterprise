import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('branches')
@UseGuards(RolesGuard)
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER')
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Get()
  findAll() {
    return this.branchesService.findAll();
  }

  @Get('consolidated-summary')
  @Roles('SUPER_ADMIN', 'OWNER')
  consolidatedSummary() {
    return this.branchesService.consolidatedSummary();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OWNER')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'OWNER')
  remove(@Param('id') id: string) {
    return this.branchesService.remove(id);
  }
}
