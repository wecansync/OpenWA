// Queue names used across the application
// Extracted to separate file to avoid circular dependency with processors
export const QUEUE_NAMES = {
  MESSAGE: 'message-queue',
  WEBHOOK: 'webhook-queue',
  STATUS_AUTO_SAVE: 'status-auto-save',
  SCHEDULED_MESSAGE: 'scheduled-message',
} as const;
