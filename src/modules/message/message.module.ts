import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MessageService } from './message.service';
import { BulkMessageService } from './bulk-message.service';
import { MessageController } from './message.controller';
import { SessionModule } from '../session/session.module';
import { Message } from './entities/message.entity';
import { MessageBatch } from './entities/message-batch.entity';
import { ScheduledMessageProcessor } from '../queue/processors/scheduled-message.processor';
import { QUEUE_NAMES } from '../queue/queue-names';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageBatch], 'data'),
    SessionModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.SCHEDULED_MESSAGE }),
  ],
  controllers: [MessageController],
  providers: [MessageService, BulkMessageService, ScheduledMessageProcessor],
  exports: [MessageService, BulkMessageService],
})
export class MessageModule {}
