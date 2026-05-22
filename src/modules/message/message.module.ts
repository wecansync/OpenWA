import { Module, DynamicModule, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { BulkMessageService } from './bulk-message.service';
import { MessageController } from './message.controller';
import { SessionModule } from '../session/session.module';
import { Message } from './entities/message.entity';
import { MessageBatch } from './entities/message-batch.entity';
import { QUEUE_NAMES } from '../queue/queue-names';

// Only wire up BullMQ if queue support is enabled (mirrors the guard in app.module.ts).
// This must be checked at module load time, so env-loader.ts must run first.
const queueImports: Array<DynamicModule> = [];
const queueProviders: Array<Type> = [];
if (process.env.QUEUE_ENABLED === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BullModule } = require('@nestjs/bullmq');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ScheduledMessageProcessor } = require('../queue/processors/scheduled-message.processor');
  queueImports.push(BullModule.registerQueue({ name: QUEUE_NAMES.SCHEDULED_MESSAGE }));
  queueProviders.push(ScheduledMessageProcessor);
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageBatch], 'data'),
    SessionModule,
    ...queueImports,
  ],
  controllers: [MessageController],
  providers: [MessageService, BulkMessageService, ...queueProviders],
  exports: [MessageService, BulkMessageService],
})
export class MessageModule {}
