import { Controller, Post, Get, Body, Headers, HttpCode, HttpStatus, ConflictException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Public } from './decorators/auth.decorators';
import { AuthService } from './auth.service';
import { createLogger } from '../../common/services/logger.service';

@ApiTags('auth')
@Controller('auth')
export class AuthValidateController {
  private readonly logger = createLogger('AuthValidateController');

  constructor(private readonly authService: AuthService) {}

  @Get('setup-status')
  @Public()
  @ApiOperation({ summary: 'Check if first-time setup is required (no auth needed)' })
  @ApiResponse({ status: 200, description: 'Setup status' })
  async setupStatus(): Promise<{ setupRequired: boolean }> {
    const count = await this.authService.countKeys();
    return { setupRequired: count === 0 };
  }

  @Post('setup')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create the first admin key — only works when no keys exist (no auth needed)' })
  @ApiResponse({ status: 201, description: 'First admin key created' })
  @ApiResponse({ status: 409, description: 'Setup already completed' })
  async setup(@Body() body: { name?: string }): Promise<{ apiKey: string }> {
    const count = await this.authService.countKeys();
    if (count > 0) {
      throw new ConflictException('Setup already completed. Use the dashboard to manage API keys.');
    }
    const rawKey = await this.authService.createFirstKey(body.name || 'Admin Key');
    return { apiKey: rawKey };
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate an API key' })
  @ApiHeader({ name: 'X-API-Key', description: 'API key to validate' })
  @ApiResponse({ status: 200, description: 'API key is valid' })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  async validate(@Headers('x-api-key') apiKey?: string): Promise<{ valid: boolean; role?: string }> {
    if (!apiKey) {
      return { valid: false };
    }

    try {
      const keyEntity = await this.authService.validateApiKey(apiKey);
      if (keyEntity && keyEntity.isActive) {
        return { valid: true, role: keyEntity.role };
      }
      return { valid: false };
    } catch (error) {
      this.logger.warn('API key validation error', { error: error instanceof Error ? error.message : String(error) });
      return { valid: false };
    }
  }
}
