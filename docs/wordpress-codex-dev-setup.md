# WordPress and Codex Development Setup

This setup supports WordPress plugin development and local MCP tools such as the safer IMAP MCP server fork.

## Install

From this repository, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\setup-dev-tools.ps1
```

## What It Installs

- Git
- GitHub CLI
- Node.js LTS and npm
- Docker Desktop
- PHP 8.3
- Composer
- DDEV
- WP-CLI

## After Install

Open a new PowerShell window and run:

```powershell
gh auth login
docker --version
ddev version
php --version
composer --version
node --version
npm --version
wp --info
```

Start Docker Desktop before using DDEV.

## Recommended Folder Layout

```text
C:\Users\Jo\Documents\Codex\projects
```

Suggested layout:

```text
projects\
  mcp\
    saje-imap-mcp-server\
  wordpress\
    client-plugin-name\
```

## WordPress Plugin Workflow With DDEV

From a plugin or site folder:

```powershell
ddev config --project-type=wordpress --docroot=public --create-docroot
ddev start
ddev wp core download
ddev wp config create --dbname=db --dbuser=db --dbpass=db --dbhost=db
ddev wp core install --url=https://example.ddev.site --title="Client Plugin Dev" --admin_user=admin --admin_password=password --admin_email=admin@example.test
```

Then place or symlink plugins under:

```text
public\wp-content\plugins
```

## WordPress Plugin Quality Tools

For each plugin:

```powershell
composer require --dev wp-coding-standards/wpcs dealerdirect/phpcodesniffer-composer-installer phpstan/phpstan szepeviktor/phpstan-wordpress
```

Typical checks:

```powershell
composer exec phpcs
composer exec phpstan
```

## IMAP MCP Fork Workflow

```powershell
git clone https://github.com/deepwebdesignnz/saje-imap-mcp-server.git
cd saje-imap-mcp-server
git checkout codex/read-only-tools
npm install
npm run build
```

The safe branch is documented in `SAJE_SAFE_MODE.md`.

## Credential Rule

Do not commit mailbox passwords, API keys, client credentials, `.env` files, or local WordPress database dumps. Use app-specific passwords where available.
