import type { EmailAdapter } from './adapter';
import { ConsoleAdapter } from './adapters/console';
import { SMTPAdapter } from './adapters/smtp';
import { ResendAdapter } from './adapters/resend';
import { SESAdapter } from './adapters/ses';

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console';

function createEmailAdapter(): EmailAdapter {
  switch (EMAIL_PROVIDER.toLowerCase()) {
    case 'smtp':
      return new SMTPAdapter();
    case 'resend':
      return new ResendAdapter();
    case 'ses':
      return new SESAdapter();
    case 'console':
      return new ConsoleAdapter();
    default:
      console.warn(`Unknown EMAIL_PROVIDER: ${EMAIL_PROVIDER}, defaulting to console`);
      return new ConsoleAdapter();
  }
}

export const emailService = createEmailAdapter();
// Email verification is required if EMAIL_PROVIDER is explicitly set (including 'console')
// Only when EMAIL_PROVIDER is undefined/empty should verification be disabled
export const isEmailConfigured = !!EMAIL_PROVIDER;
