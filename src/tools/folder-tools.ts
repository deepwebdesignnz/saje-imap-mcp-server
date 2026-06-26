import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ImapService } from '../services/imap-service.js';
import { AccountManager } from '../services/account-manager.js';
import { z } from 'zod';

const accountSelector = {
  accountId: z.string().optional().describe('Account ID (from imap_list_accounts). Optional if accountName is given or only one account is configured.'),
  accountName: z.string().optional().describe('Account name instead of accountId. Optional if accountId is given or only one account is configured.'),
};

export function folderTools(
  server: McpServer,
  imapService: ImapService,
  accountManager: AccountManager
): void {
  server.registerTool('imap_list_folders', {
    description: 'List all folders/mailboxes for an account. Use this first to discover exact folder names before searching.',
    inputSchema: {
      ...accountSelector,
    }
  }, async ({ accountId: rawAccountId, accountName }) => {
    const accountId = accountManager.resolveAccountId(rawAccountId, accountName);
    const folders = await imapService.listFolders(accountId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          folders: folders.map(folder => ({
            name: folder.name,
            delimiter: folder.delimiter,
            attributes: folder.attributes,
            hasChildren: !!folder.children && folder.children.length > 0,
          })),
        }, null, 2)
      }]
    };
  });

  server.registerTool('imap_folder_status', {
    description: 'Get read-only status information about a folder',
    inputSchema: {
      ...accountSelector,
      folder: z.string().describe('Folder name'),
    }
  }, async ({ accountId: rawAccountId, accountName, folder }) => {
    const accountId = accountManager.resolveAccountId(rawAccountId, accountName);
    const box = await imapService.selectFolder(accountId, folder);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          folder,
          messages: {
            total: box.messages.total,
            new: box.messages.new,
            unseen: box.messages.unseen || 0,
          },
          uidvalidity: box.uidvalidity,
          uidnext: box.uidnext,
          flags: box.flags,
          permanentFlags: box.permanentFlags,
        }, null, 2)
      }]
    };
  });

  server.registerTool('imap_get_unread_count', {
    description: 'Count unread emails per folder, plus a total. Defaults to all folders; pass a folder list to limit scope.',
    inputSchema: {
      ...accountSelector,
      folders: z.array(z.string()).optional().describe('List of folders to check (default: all)'),
    }
  }, async ({ accountId: rawAccountId, accountName, folders }) => {
    const accountId = accountManager.resolveAccountId(rawAccountId, accountName);
    const allFolders = await imapService.listFolders(accountId);
    const foldersToCheck = folders || allFolders.map(f => f.name);

    const unreadCounts: Record<string, number> = {};
    let totalUnread = 0;

    for (const folderName of foldersToCheck) {
      try {
        const unreadMessages = await imapService.searchEmails(accountId, folderName, { seen: false });
        const count = unreadMessages.length;
        unreadCounts[folderName] = count;
        totalUnread += count;
      } catch {
        unreadCounts[folderName] = 0;
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          totalUnread,
          byFolder: unreadCounts,
        }, null, 2)
      }]
    };
  });
}
