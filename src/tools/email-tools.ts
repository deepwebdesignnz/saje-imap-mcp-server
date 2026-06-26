import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ImapService } from '../services/imap-service.js';
import { AccountManager } from '../services/account-manager.js';
import { SmtpService } from '../services/smtp-service.js';
import { z } from 'zod';

const accountSelector = {
  accountId: z.string().optional().describe('Account ID (from imap_list_accounts). Optional if accountName is given or only one account is configured.'),
  accountName: z.string().optional().describe('Account name instead of accountId. Optional if accountId is given or only one account is configured.'),
};

export function emailTools(
  server: McpServer,
  imapService: ImapService,
  accountManager: AccountManager,
  _smtpService: SmtpService
): void {
  const parseDateOnly = (value: string): Date => {
    const parts = value.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) {
      return new Date(value);
    }
    const [year, month, day] = parts;
    return new Date(year, month - 1, day);
  };

  server.registerTool('imap_search_emails', {
    description: 'Search a mailbox folder for emails matching criteria. Returns lightweight headers only; call imap_get_email with a returned uid to read full content.',
    inputSchema: {
      ...accountSelector,
      folder: z.string().default('INBOX').describe('Folder name (default: INBOX)'),
      from: z.string().optional().describe('Search by sender'),
      to: z.string().optional().describe('Search by recipient'),
      subject: z.string().optional().describe('Search by subject'),
      body: z.string().optional().describe('Search in body text'),
      since: z.string().optional().describe('Search emails since date (YYYY-MM-DD)'),
      before: z.string().optional().describe('Search emails before date (YYYY-MM-DD)'),
      seen: z.boolean().optional().describe('Filter by read/unread status'),
      flagged: z.boolean().optional().describe('Filter by flagged status'),
      messageId: z.string().optional().describe('Search by RFC822 Message-ID header (substring match)'),
      limit: z.coerce.number().optional().default(50).describe('Maximum number of results'),
    }
  }, async ({ accountId: rawAccountId, accountName, folder, limit, ...searchCriteria }) => {
    const accountId = accountManager.resolveAccountId(rawAccountId, accountName);
    const criteria: any = {};

    if (searchCriteria.from) criteria.from = searchCriteria.from;
    if (searchCriteria.to) criteria.to = searchCriteria.to;
    if (searchCriteria.subject) criteria.subject = searchCriteria.subject;
    if (searchCriteria.body) criteria.body = searchCriteria.body;
    if (searchCriteria.since) criteria.since = parseDateOnly(searchCriteria.since);
    if (searchCriteria.before) criteria.before = parseDateOnly(searchCriteria.before);
    if (searchCriteria.seen !== undefined) criteria.seen = searchCriteria.seen;
    if (searchCriteria.flagged !== undefined) criteria.flagged = searchCriteria.flagged;
    if (searchCriteria.messageId) criteria.messageId = searchCriteria.messageId;

    const messages = await imapService.searchEmails(accountId, folder, criteria);
    const limitedMessages = messages.slice(0, limit);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          totalFound: messages.length,
          returned: limitedMessages.length,
          messages: limitedMessages,
        }, null, 2)
      }]
    };
  });

  server.registerTool('imap_get_email', {
    description: 'Read the full content of a single email by folder and UID. This tool does not mark, move, delete, send, or download attachments.',
    inputSchema: {
      ...accountSelector,
      folder: z.string().default('INBOX').describe('Folder name'),
      uid: z.coerce.number().describe('Email UID'),
      maxContentLength: z.coerce.number().default(10000).describe('Maximum characters to return for each body field'),
      bodyFormat: z.enum(['markdown', 'text', 'html', 'auto']).default('markdown').describe('How to return the body'),
      includeAttachmentText: z.boolean().default(true).describe('Include text attachment previews when available'),
      maxAttachmentTextChars: z.coerce.number().default(100000).describe('Maximum characters to return per text attachment'),
      includeHeaders: z.boolean().default(false).describe('Include raw email headers'),
    }
  }, async ({ accountId: rawAccountId, accountName, folder, uid, maxContentLength, bodyFormat, includeAttachmentText, maxAttachmentTextChars, includeHeaders }) => {
    const accountId = accountManager.resolveAccountId(rawAccountId, accountName);
    const email = await imapService.getEmailContent(accountId, folder, uid, {
      includeAttachmentText,
      maxAttachmentTextChars,
      bodyFormat,
    });
    const cap = (s?: string) => (s === undefined ? undefined : s.substring(0, maxContentLength));
    const textTruncated = email.textContent ? email.textContent.length > maxContentLength : false;
    const htmlTruncated = email.htmlContent ? email.htmlContent.length > maxContentLength : false;
    const markdownTruncated = email.markdownContent ? email.markdownContent.length > maxContentLength : false;
    const contentTruncated = (textTruncated || htmlTruncated || markdownTruncated)
      ? { text: textTruncated || undefined, html: htmlTruncated || undefined, markdown: markdownTruncated || undefined }
      : undefined;

    const { headers: rawHeaders, ...emailWithoutHeaders } = email;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          email: {
            ...emailWithoutHeaders,
            textContent: cap(email.textContent),
            htmlContent: cap(email.htmlContent),
            markdownContent: cap(email.markdownContent),
            contentTruncated,
            ...(includeHeaders ? { headers: rawHeaders } : {}),
          },
        }, null, 2)
      }]
    };
  });

  server.registerTool('imap_get_latest_emails', {
    description: 'Get the most recent emails from a folder, newest first. Returns lightweight headers only.',
    inputSchema: {
      ...accountSelector,
      folder: z.string().default('INBOX').describe('Folder name'),
      count: z.coerce.number().default(10).describe('Number of emails to retrieve'),
    }
  }, async ({ accountId: rawAccountId, accountName, folder, count }) => {
    const accountId = accountManager.resolveAccountId(rawAccountId, accountName);
    const sortedMessages = await imapService.getLatestEmails(accountId, folder, count);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ messages: sortedMessages }, null, 2)
      }]
    };
  });

  server.registerTool('imap_find_thread_messages', {
    description: 'Find messages in searchFolder that belong to the same conversation threads as messages already in sourceFolder. Uses read-only IMAP header search.',
    inputSchema: {
      ...accountSelector,
      sourceFolder: z.string().describe('Folder containing the already-sorted thread messages'),
      searchFolder: z.string().default('INBOX').describe('Folder to search for related thread messages'),
      searchReferences: z.boolean().optional().describe('Also search the References header for multi-level threads'),
    }
  }, async ({ accountId: rawAccountId, accountName, sourceFolder, searchFolder, searchReferences }) => {
    const accountId = accountManager.resolveAccountId(rawAccountId, accountName);
    try {
      const result = await imapService.findThreadMessages(accountId, sourceFolder, searchFolder, {
        searchReferences,
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            sourceFolder,
            searchFolder,
            sourceMessageIdCount: result.messageIds.length,
            threadMessageCount: result.uids.length,
            uids: result.uids,
          }, null, 2)
        }]
      };
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            sourceFolder,
            searchFolder,
            error: err instanceof Error ? err.message : 'Unknown error',
          }, null, 2)
        }]
      };
    }
  });

  server.registerTool('imap_find_email_by_message_id', {
    description: 'Locate an email by its RFC822 Message-ID across folders and return its current folder, uid, and basic envelope.',
    inputSchema: {
      ...accountSelector,
      messageId: z.string().describe('RFC822 Message-ID, with or without angle brackets'),
      folders: z.array(z.string()).optional().describe('Explicit folders to search, in order'),
    }
  }, async ({ accountId: rawAccountId, accountName, messageId, folders }) => {
    const accountId = accountManager.resolveAccountId(rawAccountId, accountName);
    const result = await imapService.findEmailByMessageId(accountId, messageId, folders);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  });
}
