import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AccountManager } from '../services/account-manager.js';
import { ImapService } from '../services/imap-service.js';
import { SmtpService } from '../services/smtp-service.js';
import { z } from 'zod';

export function accountTools(
  server: McpServer,
  accountManager: AccountManager,
  imapService: ImapService,
  smtpService: SmtpService
): void {
  server.registerTool('imap_add_account', {
    description: 'Add a new IMAP account configuration. Stores credentials locally in the server account store.',
    inputSchema: {
      name: z.string().describe('Friendly name for the account'),
      host: z.string().describe('IMAP server hostname'),
      port: z.coerce.number().default(993).describe('IMAP server port (default: 993)'),
      user: z.string().describe('Username for authentication'),
      password: z.string().describe('Password for authentication'),
      tls: z.boolean().default(true).describe('Use TLS/SSL (default: true)'),
      email: z.string().optional().describe('Email address. Defaults to user if omitted'),
    }
  }, async ({ name, host, port, user, password, tls, email }) => {
    const account = await accountManager.addAccount({
      name,
      host,
      port,
      user,
      password,
      tls,
      ...(email ? { email } : {}),
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          accountId: account.id,
          message: `Account "${name}" added successfully`,
        }, null, 2)
      }]
    };
  });

  server.registerTool('imap_update_account', {
    description: 'Update an existing IMAP account configuration. This changes local connection settings only; it does not alter mailbox contents.',
    inputSchema: {
      accountId: z.string().describe('ID of the account to update'),
      name: z.string().optional().describe('New friendly name'),
      host: z.string().optional().describe('IMAP host'),
      port: z.coerce.number().optional().describe('IMAP port'),
      user: z.string().optional().describe('IMAP username'),
      password: z.string().optional().describe('New password'),
      tls: z.boolean().optional().describe('Use TLS for IMAP'),
      email: z.string().optional().describe('Email address'),
    }
  }, async ({ accountId, name, host, port, user, password, tls, email }) => {
    const existing = accountManager.getAccount(accountId);
    if (!existing) {
      throw new Error(`Account ${accountId} not found`);
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (host !== undefined) updates.host = host;
    if (port !== undefined) updates.port = port;
    if (user !== undefined) updates.user = user;
    if (password !== undefined) updates.password = password;
    if (tls !== undefined) updates.tls = tls;
    if (email !== undefined) updates.email = email;

    await imapService.disconnect(accountId);
    smtpService.disconnect(accountId);

    const updated = await accountManager.updateAccount(accountId, updates);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          accountId: updated.id,
          message: `Account "${updated.name}" updated`,
        }, null, 2)
      }]
    };
  });

  server.registerTool('imap_list_accounts', {
    description: 'List all configured IMAP accounts without revealing passwords',
    inputSchema: {}
  }, async () => {
    const accounts = accountManager.getAllAccounts();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          accounts: accounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            host: acc.host,
            port: acc.port,
            user: acc.user,
            tls: acc.tls,
          })),
        }, null, 2)
      }]
    };
  });

  server.registerTool('imap_connect', {
    description: 'Connect to an IMAP account',
    inputSchema: {
      accountId: z.string().optional().describe('Account ID to connect to'),
      accountName: z.string().optional().describe('Account name to connect to'),
    }
  }, async ({ accountId, accountName }) => {
    let account;

    if (accountId) {
      account = accountManager.getAccount(accountId);
    } else if (accountName) {
      account = accountManager.getAccountByName(accountName);
    } else {
      throw new Error('Either accountId or accountName must be provided');
    }

    if (!account) {
      throw new Error('Account not found');
    }

    await imapService.connect(account);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Connected to account "${account.name}"`,
          accountId: account.id,
        }, null, 2)
      }]
    };
  });

  server.registerTool('imap_disconnect', {
    description: 'Disconnect from an IMAP account',
    inputSchema: {
      accountId: z.string().describe('Account ID to disconnect from'),
    }
  }, async ({ accountId }) => {
    await imapService.disconnect(accountId);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Disconnected from account ${accountId}`,
        }, null, 2)
      }]
    };
  });

  server.registerTool('imap_test_account', {
    description: 'Test an existing account connection without re-entering credentials. Validates IMAP connectivity and returns folder and message counts.',
    inputSchema: {
      accountId: z.string().describe('Account ID to test'),
    }
  }, async ({ accountId }) => {
    const account = accountManager.getAccount(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const result = await imapService.testConnection(account);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          accountId,
          accountName: account.name,
          host: account.host,
          ...result,
        }, null, 2)
      }]
    };
  });
}
