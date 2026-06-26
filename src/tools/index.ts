import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ImapService } from '../services/imap-service.js';
import { AccountManager } from '../services/account-manager.js';
import { SmtpService } from '../services/smtp-service.js';
import { SpamService } from '../services/spam-service.js';
import { accountTools } from './account-tools.js';
import { emailTools } from './email-tools.js';
import { folderTools } from './folder-tools.js';

export function registerTools(
  server: McpServer,
  imapService: ImapService,
  accountManager: AccountManager,
  smtpService: SmtpService,
  _spamService: SpamService
): void {
  // Account tools are limited to setup, listing, connection, and test actions.
  accountTools(server, accountManager, imapService, smtpService);

  // Email tools are limited to read/search/thread lookup actions.
  emailTools(server, imapService, accountManager, smtpService);

  // Folder tools are limited to read-only discovery and status actions.
  folderTools(server, imapService, accountManager);
}
