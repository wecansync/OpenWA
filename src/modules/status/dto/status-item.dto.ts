import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StatusItemDto {
  @ApiProperty()
  messageId: string;

  @ApiProperty({ enum: ['text', 'image', 'video', 'audio', 'gif'] })
  type: 'text' | 'image' | 'video' | 'audio' | 'gif';

  @ApiProperty()
  hasMedia: boolean;

  @ApiPropertyOptional()
  caption?: string;

  @ApiPropertyOptional()
  text?: string;

  @ApiProperty()
  timestamp: string;

  @ApiProperty()
  expiresAt: string;
}

export class StatusItemsResponseDto {
  @ApiProperty({ type: [StatusItemDto] })
  items: StatusItemDto[];
}
