import { Controller, Get, Post, Delete, Param, Body, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import type { Response } from 'express';
import { StatusService } from './status.service';
import { SendTextStatusDto } from './dto/send-text-status.dto';
import { SendImageStatusDto, SendVideoStatusDto } from './dto/send-media-status.dto';
import { StatusContactsResponseDto } from './dto/status-contact.dto';
import { StatusItemsResponseDto } from './dto/status-item.dto';

@ApiTags('Status')
@ApiBearerAuth()
@ApiSecurity('x-api-key')
@Controller('sessions/:sessionId/status')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Get()
  @ApiOperation({ summary: 'List all contacts with active status updates' })
  @ApiResponse({ status: 200, type: StatusContactsResponseDto })
  @ApiResponse({ status: 404, description: 'Session not found or not connected' })
  async getStatusContacts(@Param('sessionId') sessionId: string): Promise<StatusContactsResponseDto> {
    return this.statusService.getStatusContacts(sessionId);
  }

  @Get(':contactId/items')
  @ApiOperation({ summary: 'Get individual status items for a contact' })
  @ApiResponse({ status: 200, type: StatusItemsResponseDto })
  @ApiResponse({ status: 404, description: 'No active statuses found for contact' })
  async getStatusItems(
    @Param('sessionId') sessionId: string,
    @Param('contactId') contactId: string,
  ): Promise<StatusItemsResponseDto> {
    return this.statusService.getStatusItems(sessionId, contactId);
  }

  @Get(':contactId/:messageId/download')
  @ApiOperation({ summary: 'Download the media file for a status item' })
  @ApiResponse({ status: 200, description: 'Binary file stream' })
  @ApiResponse({ status: 400, description: 'Status item has no downloadable media' })
  @ApiResponse({ status: 404, description: 'Status media not found or has expired' })
  @ApiResponse({ status: 408, description: 'Media download timed out' })
  async downloadStatusMedia(
    @Param('sessionId') sessionId: string,
    @Param('contactId') contactId: string,
    @Param('messageId') messageId: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.statusService.downloadStatusMedia(sessionId, contactId, messageId);
    const ext = result.mimetype.split('/')[1]?.split(';')[0] ?? 'bin';
    const contactPart = contactId.replace('@c.us', '').replace('@g.us', '');
    const timestamp = Math.floor(Date.now() / 1000);
    const filename = result.filename ?? `status-${contactPart}-${timestamp}.${ext}`;
    res.set('Content-Type', result.mimetype);
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(result.data, 'base64'));
  }

  @Get('download-all')
  @ApiOperation({ summary: 'Download all status media across all contacts as a ZIP' })
  @ApiResponse({ status: 200, description: 'ZIP archive stream' })
  @ApiResponse({ status: 404, description: 'Session not found or no media available' })
  async downloadAllStatuses(@Param('sessionId') sessionId: string, @Res() res: Response): Promise<void> {
    await this.statusService.streamAllStatusesZip(sessionId, res);
  }

  @Get(':contactId/download-all')
  @ApiOperation({ summary: 'Download all media from a single contact as a ZIP' })
  @ApiResponse({ status: 200, description: 'ZIP archive stream' })
  @ApiResponse({ status: 404, description: 'No downloadable media for contact' })
  async downloadAllContactStatuses(
    @Param('sessionId') sessionId: string,
    @Param('contactId') contactId: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.statusService.streamContactStatusZip(sessionId, contactId, res);
  }

  @Get(':contactId')
  @ApiOperation({ summary: 'Get status updates from a specific contact (legacy — prefer /:contactId/items)' })
  @ApiResponse({ status: 200, type: StatusItemsResponseDto })
  @ApiResponse({ status: 404, description: 'No active statuses found for contact' })
  async getContactStatus(@Param('sessionId') sessionId: string, @Param('contactId') contactId: string) {
    return this.statusService.getStatusItems(sessionId, contactId);
  }

  @Post('send-text')
  @ApiOperation({ summary: 'Post a text status' })
  @ApiResponse({ status: 201, description: 'Status posted' })
  @ApiResponse({ status: 501, description: 'Not yet implemented in whatsapp-web.js adapter' })
  async sendTextStatus(@Param('sessionId') sessionId: string, @Body() dto: SendTextStatusDto) {
    return this.statusService.postTextStatus(sessionId, dto.text, {
      backgroundColor: dto.backgroundColor,
      font: dto.font,
    });
  }

  @Post('send-image')
  @ApiOperation({ summary: 'Post an image status' })
  @ApiResponse({ status: 201, description: 'Status posted' })
  @ApiResponse({ status: 501, description: 'Not yet implemented in whatsapp-web.js adapter' })
  async sendImageStatus(@Param('sessionId') sessionId: string, @Body() dto: SendImageStatusDto) {
    return this.statusService.postImageStatus(sessionId, dto.image, dto.caption);
  }

  @Post('send-video')
  @ApiOperation({ summary: 'Post a video status' })
  @ApiResponse({ status: 201, description: 'Status posted' })
  @ApiResponse({ status: 501, description: 'Not yet implemented in whatsapp-web.js adapter' })
  async sendVideoStatus(@Param('sessionId') sessionId: string, @Body() dto: SendVideoStatusDto) {
    return this.statusService.postVideoStatus(sessionId, dto.video, dto.caption);
  }

  @Delete(':statusId')
  @ApiOperation({ summary: 'Delete own status' })
  @ApiResponse({ status: 200, description: 'Status deleted' })
  @ApiResponse({ status: 501, description: 'Not yet implemented in whatsapp-web.js adapter' })
  async deleteStatus(@Param('sessionId') sessionId: string, @Param('statusId') statusId: string) {
    await this.statusService.deleteStatus(sessionId, statusId);
    return { message: 'Status deleted successfully' };
  }
}
