import { Module, DynamicModule, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { BulkMessageService } from './bulk-message.service';
import { MessageController } from './message.controller';
import { SessionModule } from '../session/session.module';
import { Message } from './entities/message.entity';
import { MessageBatch } from './entities/message-batch.entity';
import { QUEUE_NAMES } from '../queue/queue-names';

const queueEnabled = process.env.QUEUE_ENABLED === 'true';

const bullImports = queueEnabled
  ? [require('@nestjs/bullmq').BullModule.registerQueue({ name: QUEUE_NAMES.SCHEDULED_MESSAGE })]
  : [];

const processorProviders = queueEnabled
  ? [require('../queue/processors/scheduled-message.processor').ScheduledMessageProcessor]
  : [];

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageBatch], 'data'),
    SessionModule,
    ...bullImports,
  ],
  controllers: [MessageController],
  providers: [MessageService, BulkMessageService, ...processorProviders],
  exports: [MessageService, BulkMessageService],
})
export class MessageModule {}
