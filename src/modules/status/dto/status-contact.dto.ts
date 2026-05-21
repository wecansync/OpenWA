import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StatusContactDto {
  @ApiProperty()
  contactId: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  pushName?: string;

  @ApiPropertyOptional()
  profilePicUrl?: string;

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  unreadCount: number;

  @ApiProperty()
  lastTimestamp: string;
}

export class StatusContactsResponseDto {
  @ApiProperty({ type: [StatusContactDto] })
  contacts: StatusContactDto[];
}
