import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue-names';
import { MessageService } from '../../message/message.service';
import type { SendTextMessageDto } from '../../message/dto';

interface ScheduledMessageJob {
  sessionId: string;
  dto: SendTextMessageDto;
}

@Processor(QUEUE_NAMES.SCHEDULED_MESSAGE)
export class ScheduledMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledMessageProcessor.name);

  constructor(private readonly messageService: MessageService) {
    super();
  }

  async process(job: Job<ScheduledMessageJob>): Promise<void> {
    const { sessionId, dto } = job.data;
    this.logger.log({ event: 'scheduled_message_send', jobId: job.id, sessionId, chatId: dto.chatId });
    await this.messageService.sendText(sessionId, dto);
  }
}
