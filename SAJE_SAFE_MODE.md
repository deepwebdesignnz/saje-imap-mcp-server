# SAJE IMAP MCP Safe Mode

This branch narrows the MCP tool surface for a first self-hosted IMAP integration.

## Exposed tools

Account setup and connection:

- `imap_add_account`
- `imap_update_account`
- `imap_list_accounts`
- `imap_connect`
- `imap_disconnect`
- `imap_test_account`

Read-only mailbox access:

- `imap_search_emails`
- `imap_get_email`
- `imap_get_latest_emails`
- `imap_find_thread_messages`
- `imap_find_email_by_message_id`
- `imap_list_folders`
- `imap_folder_status`
- `imap_get_unread_count`

## Intentionally not exposed

Mailbox mutation and outbound mail tools are not registered in this branch:

- send, draft, reply, and forward email
- delete and bulk-delete email
- move email
- mark read or unread
- create folders
- upload or download attachments
- spam-domain mutation and spam deletion tools

The implementation removes these tools from MCP registration rather than relying on prompts or assistant behavior to avoid them.

## Recommended use

Start with an app-specific mailbox password where possible. Confirm that this branch can list folders, search mail, and read selected messages before considering any additional capabilities.
