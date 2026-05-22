import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as archiver from 'archiver';
import { SessionService } from '../session/session.service';
import type {
  MediaDownloadResult,
  Status,
  StatusContact,
  StatusResult,
  TextStatusOptions,
} from '../../engine/interfaces/whatsapp-engine.interface';
import { StatusContactDto, StatusContactsResponseDto, StatusItemDto, StatusItemsResponseDto } from './dto';

@Injectable()
export class StatusService {
  private readonly logger = new Logger(StatusService.name);

  constructor(private readonly sessionService: SessionService) {}

  async getStatusContacts(sessionId: string): Promise<StatusContactsResponseDto> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }
    const contacts: StatusContact[] = await engine.getContactStatuses();
    this.logger.log({ event: 'status_contacts_fetched', sessionId, count: contacts.length });
    const dtos: StatusContactDto[] = contacts.map((c) => ({
      contactId: c.contactId,
      name: c.name,
      pushName: c.pushName,
      profilePicUrl: c.profilePicUrl,
      totalCount: c.totalCount,
      unreadCount: c.unreadCount,
      lastTimestamp: c.lastTimestamp.toISOString(),
    }));
    return { contacts: dtos };
  }

  async getStatusItems(sessionId: string, contactId: string): Promise<StatusItemsResponseDto> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }
    const items: Status[] = await engine.getContactStatus(contactId);
    if (!items || items.length === 0) {
      throw new NotFoundException(`No active statuses found for contact ${contactId}`);
    }
    this.logger.log({ event: 'status_items_fetched', sessionId, contactId, count: items.length });
    const dtos: StatusItemDto[] = items.map((s) => ({
      messageId: s.messageId,
      type: s.type,
      hasMedia: s.hasMedia,
      caption: s.caption,
      text: s.type === 'text' ? (s.caption ?? '') : undefined,
      timestamp: s.timestamp.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    }));
    return { items: dtos };
  }

  async downloadStatusMedia(sessionId: string, contactId: string, messageId: string): Promise<MediaDownloadResult> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }
    const items: Status[] = await engine.getContactStatus(contactId);
    const item = items.find((s) => s.messageId === messageId);
    if (item && !item.hasMedia) {
      throw new BadRequestException('This status item has no downloadable media');
    }
    this.logger.log({ event: 'status_media_download', sessionId, contactId, messageId });
    return engine.downloadStatusMedia(contactId, messageId);
  }

  async postTextStatus(sessionId: string, text: string, options?: TextStatusOptions): Promise<StatusResult> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }
    return engine.postTextStatus(text, options);
  }

  async postImageStatus(
    sessionId: string,
    media: { url?: string; base64?: string },
    caption?: string,
  ): Promise<StatusResult> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }
    return engine.postImageStatus(
      {
        mimetype: this.detectImageMimetype(media),
        data: media.url || media.base64 || '',
      },
      caption,
    );
  }

  async postVideoStatus(
    sessionId: string,
    media: { url?: string; base64?: string },
    caption?: string,
  ): Promise<StatusResult> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }
    return engine.postVideoStatus(
      {
        mimetype: this.detectVideoMimetype(media),
        data: media.url || media.base64 || '',
      },
      caption,
    );
  }

  private detectImageMimetype(media: { url?: string; base64?: string }): string {
    if (media.base64?.startsWith('data:')) {
      return media.base64.split(';')[0].slice(5);
    }
    if (media.url) {
      const ext = media.url.split('?')[0].split('.').pop()?.toLowerCase();
      if (ext === 'png') return 'image/png';
      if (ext === 'gif') return 'image/gif';
      if (ext === 'webp') return 'image/webp';
    }
    return 'image/jpeg';
  }

  private detectVideoMimetype(media: { url?: string; base64?: string }): string {
    if (media.base64?.startsWith('data:')) {
      return media.base64.split(';')[0].slice(5);
    }
    if (media.url) {
      const ext = media.url.split('?')[0].split('.').pop()?.toLowerCase();
      if (ext === 'webm') return 'video/webm';
      if (ext === 'mov') return 'video/quicktime';
    }
    return 'video/mp4';
  }

  async deleteStatus(sessionId: string, statusId: string): Promise<void> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }
    return engine.deleteStatus(statusId);
  }

  async streamContactStatusZip(sessionId: string, contactId: string, res: Response): Promise<void> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }
    const items: Status[] = await engine.getContactStatus(contactId);
    const mediaItems = items.filter((s) => s.hasMedia);
    if (mediaItems.length === 0) {
      throw new NotFoundException(`No downloadable media found for contact ${contactId}`);
    }
    const contactPart = contactId.replace(/@[cgs]\.us$/, '');
    const zipName = `statuses-${contactPart}.zip`;
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver.default('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    for (const item of mediaItems) {
      try {
        const dl = await engine.downloadStatusMedia(contactId, item.messageId);
        const ext = dl.mimetype.split('/')[1]?.split(';')[0] ?? 'bin';
        const ts = Math.floor(item.timestamp.getTime() / 1000);
        const filename = dl.filename ?? `${contactPart}_${ts}_${item.messageId.slice(-8)}.${ext}`;
        archive.append(Buffer.from(dl.data, 'base64'), { name: filename });
        this.logger.log({ event: 'status_bulk_item_added', sessionId, contactId, messageId: item.messageId });
      } catch (err) {
        this.logger.warn({ event: 'status_bulk_item_skip', sessionId, contactId, messageId: item.messageId, err });
      }
    }

    await archive.finalize();
  }

  async streamAllStatusesZip(sessionId: string, res: Response): Promise<void> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }
    const contacts: StatusContact[] = await engine.getContactStatuses();
    const zipName = `all-statuses-${sessionId}.zip`;
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver.default('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    for (const contact of contacts) {
      try {
        const items: Status[] = await engine.getContactStatus(contact.contactId);
        const mediaItems = items.filter((s) => s.hasMedia);
        const contactPart = contact.contactId.replace(/@[cgs]\.us$/, '');
        for (const item of mediaItems) {
          try {
            const dl = await engine.downloadStatusMedia(contact.contactId, item.messageId);
            const ext = dl.mimetype.split('/')[1]?.split(';')[0] ?? 'bin';
            const ts = Math.floor(item.timestamp.getTime() / 1000);
            const filename = dl.filename ?? `${contactPart}_${ts}_${item.messageId.slice(-8)}.${ext}`;
            archive.append(Buffer.from(dl.data, 'base64'), { name: `${contactPart}/${filename}` });
          } catch (err) {
            this.logger.warn({ event: 'status_all_item_skip', sessionId, contactId: contact.contactId, messageId: item.messageId, err });
          }
        }
      } catch (err) {
        this.logger.warn({ event: 'status_all_contact_skip', sessionId, contactId: contact.contactId, err });
      }
    }

    this.logger.log({ event: 'status_all_bulk_download', sessionId, contactCount: contacts.length });
    await archive.finalize();
  }
}
