import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { StatusAutoSaveService } from '../status/auto-save/status-auto-save.service';
import type { AutoSaveConfig } from '../status/auto-save/status-auto-save.service';
import { QUEUE_NAMES } from '../queue/queue-names';

interface Settings {
  general: {
    apiBaseUrl: string;
    sessionTimeout: number;
    autoReconnect: boolean;
    debugMode: boolean;
  };
  api: {
    rateLimit: number;
    rateLimitWindow: number;
    enableDocs: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    notificationEmail: string;
    webhookAlerts: boolean;
  };
}

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  private settings: Settings;

  constructor(
    private readonly configService: ConfigService,
    private readonly autoSaveService: StatusAutoSaveService,
    @InjectQueue(QUEUE_NAMES.STATUS_AUTO_SAVE) private readonly autoSaveQueue: Queue,
  ) {
    // Initialize with values from configuration (reads from .env)
    const port = this.configService.get<number>('port', 2785);

    this.settings = {
      general: {
        apiBaseUrl: `http://localhost:${port}`,
        sessionTimeout: Math.floor(this.configService.get<number>('webhook.timeout', 300000) / 60000),
        autoReconnect: this.configService.get<boolean>('engine.autoReconnect', false),
        debugMode: this.configService.get<boolean>('database.logging', false),
      },
      api: {
        rateLimit: this.configService.get<number>('api.rateLimit.mediumLimit', 100),
        rateLimitWindow: this.configService.get<number>('api.rateLimit.mediumTtl', 60000),
        enableDocs: true, // Swagger docs always enabled
      },
      notifications: {
        emailEnabled: false,
        notificationEmail: '',
        webhookAlerts: true,
      },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get application settings' })
  @ApiResponse({ status: 200, description: 'Current settings' })
  get(): Settings {
    return this.settings;
  }

  @Put()
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Update application settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  update(@Body() newSettings: Partial<Settings>): Settings {
    if (newSettings.general) {
      this.settings.general = {
        ...this.settings.general,
        ...newSettings.general,
      };
    }
    if (newSettings.api) {
      this.settings.api = { ...this.settings.api, ...newSettings.api };
    }
    if (newSettings.notifications) {
      this.settings.notifications = {
        ...this.settings.notifications,
        ...newSettings.notifications,
      };
    }
    return this.settings;
  }

  @Get('status-auto-save')
  @ApiOperation({ summary: 'Get status auto-save configuration' })
  @ApiResponse({ status: 200, description: 'Current auto-save config' })
  getAutoSave() {
    return this.autoSaveService.getConfig();
  }

  @Put('status-auto-save')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Update status auto-save configuration' })
  @ApiResponse({ status: 200, description: 'Config updated' })
  async updateAutoSave(@Body() body: Partial<AutoSaveConfig>) {
    const config = this.autoSaveService.setConfig(body);

    // Remove existing repeatable job and re-schedule if enabled
    const repeatKey = 'status-auto-save-repeat';
    await this.autoSaveQueue.removeRepeatableByKey(repeatKey);

    if (config.enabled) {
      const everyMs = config.intervalMinutes * 60 * 1000;
      await this.autoSaveQueue.add(
        'run',
        {},
        { repeat: { every: everyMs }, jobId: repeatKey },
      );
    }

    return config;
  }

  @Put('status-auto-save/run-now')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Trigger an immediate auto-save run' })
  @ApiResponse({ status: 200, description: 'Job queued' })
  async triggerAutoSave(): Promise<{ queued: boolean }> {
    await this.autoSaveQueue.add('run', {}, { jobId: `manual-${Date.now()}` });
    return { queued: true };
  }
}
