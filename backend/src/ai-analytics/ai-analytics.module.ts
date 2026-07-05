import { Module } from '@nestjs/common';
import { AiAnalyticsService } from './ai-analytics.service';
import { AiAnalyticsController } from './ai-analytics.controller';

@Module({ providers: [AiAnalyticsService], controllers: [AiAnalyticsController] })
export class AiAnalyticsModule {}
