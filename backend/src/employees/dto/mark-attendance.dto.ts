import { IsUUID, IsString, IsDateString, IsOptional } from 'class-validator';

export class MarkAttendanceDto {
  @IsUUID() employeeId: string;
  @IsDateString() date: string;
  @IsString() status: string;  // PRESENT | ABSENT | LEAVE | HALF_DAY
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
}
