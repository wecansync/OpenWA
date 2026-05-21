import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SessionService } from '../../session/session.service';
import type { Status, StatusContact } from '../../../engine/interfaces/whatsapp-engine.interface';

export interface AutoSaveConfig {
  enabled: boolean;
  intervalMinutes: number;
  savePath: string;
  sessions: string[];
}

const DEFAULT_CONFIG: AutoSaveConfig = {
  enabled: false,
  intervalMinutes: 60,
  savePath: './data/statuses',
  sessions: [],
};

@Injectable()
export class StatusAutoSaveService {
  private readonly logger = new Logger(StatusAutoSaveService.name);
  private config: AutoSaveConfig = { ...DEFAULT_CONFIG };

  constructor(private readonly sessionService: SessionService) {}

  getConfig(): AutoSaveConfig {
    return { ...this.config };
  }

  setConfig(partial: Partial<AutoSaveConfig>): AutoSaveConfig {
    if (partial.savePath !== undefined) {
      const resolved = path.resolve(partial.savePath);
      const cwd = path.resolve('.');
      if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
        // Allow absolute paths but not traversals above cwd
      }
      partial = { ...partial, savePath: resolved };
    }
    this.config = { ...this.config, ...partial };
    return { ...this.config };
  }

  async runAutoSave(): Promise<{ saved: number; skipped: number; errors: number }> {
    const { savePath, sessions } = this.config;
    const stats = { saved: 0, skipped: 0, errors: 0 };

    const targetSessions =
      sessions.length > 0
        ? sessions
        : this.sessionService.getActiveSessionIds();

    for (const sessionId of targetSessions) {
      const engine = this.sessionService.getEngine(sessionId);
      if (!engine) {
        this.logger.warn({ event: 'auto_save_session_skip', sessionId, reason: 'not_connected' });
        continue;
      }

      let contacts: StatusContact[];
      try {
        contacts = await engine.getContactStatuses();
      } catch (err) {
        this.logger.error({ event: 'auto_save_contacts_error', sessionId, err });
        stats.errors++;
        continue;
      }

      const seenPath = path.join(savePath, sessionId, '.seen.json');
      const seen = this.loadSeen(seenPath);

      for (const contact of contacts) {
        let items: Status[];
        try {
          items = await engine.getContactStatus(contact.contactId);
        } catch {
          stats.errors++;
          continue;
        }

        for (const item of items) {
          if (!item.hasMedia) continue;
          if (seen.has(item.messageId)) {
            stats.skipped++;
            continue;
          }

          try {
            const dl = await engine.downloadStatusMedia(contact.contactId, item.messageId);
            const ext = dl.mimetype.split('/')[1]?.split(';')[0] ?? 'bin';
            const contactPart = contact.contactId.replace(/@[cgs]\.us$/, '');
            const ts = Math.floor(item.timestamp.getTime() / 1000);
            const filename = dl.filename ?? `${contactPart}_${ts}_${item.messageId.slice(-8)}.${ext}`;
            const dir = path.join(savePath, sessionId, contactPart);
            fs.mkdirSync(dir, { recursive: true });

            // Atomic write: write to .tmp then rename
            const dest = path.join(dir, filename);
            const tmp = dest + '.tmp';
            fs.writeFileSync(tmp, Buffer.from(dl.data, 'base64'));
            fs.renameSync(tmp, dest);

            seen.add(item.messageId);
            stats.saved++;
            this.logger.log({ event: 'auto_save_file_saved', sessionId, contactId: contact.contactId, filename });
          } catch (err) {
            this.logger.warn({ event: 'auto_save_item_error', sessionId, messageId: item.messageId, err });
            stats.errors++;
          }
        }
      }

      this.persistSeen(seenPath, seen);
    }

    this.logger.log({ event: 'auto_save_run_complete', ...stats });
    return stats;
  }

  private loadSeen(seenPath: string): Set<string> {
    try {
      const raw = fs.readFileSync(seenPath, 'utf8');
      return new Set<string>(JSON.parse(raw) as string[]);
    } catch {
      return new Set<string>();
    }
  }

  private persistSeen(seenPath: string, seen: Set<string>): void {
    try {
      fs.mkdirSync(path.dirname(seenPath), { recursive: true });
      const tmp = seenPath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify([...seen]));
      fs.renameSync(tmp, seenPath);
    } catch (err) {
      this.logger.warn({ event: 'auto_save_seen_persist_error', err });
    }
  }
}
