import { IsUUID, IsString, IsArray, ValidateNested, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

class BomComponentDto {
  @IsUUID() productId: string;  // raw material
  @IsNumber() @IsPositive() quantity: number;
}

export class CreateBomDto {
  @IsUUID() finishedProductId: string;
  @IsString() name: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => BomComponentDto)
  components: BomComponentDto[];
}
