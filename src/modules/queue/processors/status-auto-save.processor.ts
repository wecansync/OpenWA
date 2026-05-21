import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue-names';
import { StatusAutoSaveService } from '../../status/auto-save/status-auto-save.service';

@Processor(QUEUE_NAMES.STATUS_AUTO_SAVE)
export class StatusAutoSaveProcessor extends WorkerHost {
  private readonly logger = new Logger(StatusAutoSaveProcessor.name);

  constructor(private readonly autoSaveService: StatusAutoSaveService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log({ event: 'auto_save_job_start', jobId: job.id });
    const result = await this.autoSaveService.runAutoSave();
    this.logger.log({ event: 'auto_save_job_done', jobId: job.id, ...result });
  }
}
