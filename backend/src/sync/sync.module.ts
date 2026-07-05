import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
