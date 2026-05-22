import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
