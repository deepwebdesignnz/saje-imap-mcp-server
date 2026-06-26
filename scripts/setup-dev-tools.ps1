# Development tool setup for Codex, MCP servers, and WordPress plugins.
# Run in PowerShell as your normal user. Some installers may prompt for elevation.

$ErrorActionPreference = "Stop"

function Test-Tool {
    param([Parameter(Mandatory = $true)][string] $Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-WingetPackage {
    param(
        [Parameter(Mandatory = $true)][string] $Tool,
        [Parameter(Mandatory = $true)][string] $PackageId
    )

    if (Test-Tool $Tool) {
        Write-Host "[ok] $Tool is already installed"
        return
    }

    Write-Host "[install] $Tool via winget package $PackageId"
    winget install --id $PackageId --exact --source winget --accept-package-agreements --accept-source-agreements
}

if (-not (Test-Tool "winget")) {
    Write-Error "winget is not available. Install App Installer from Microsoft Store, then rerun this script."
}

Install-WingetPackage -Tool "git" -PackageId "Git.Git"
Install-WingetPackage -Tool "gh" -PackageId "GitHub.cli"
Install-WingetPackage -Tool "node" -PackageId "OpenJS.NodeJS.LTS"
Install-WingetPackage -Tool "docker" -PackageId "Docker.DockerDesktop"
Install-WingetPackage -Tool "php" -PackageId "PHP.PHP.8.3"
Install-WingetPackage -Tool "composer" -PackageId "Composer.Composer"
Install-WingetPackage -Tool "ddev" -PackageId "DDEVFoundation.DDEV"

if (-not (Test-Tool "wp")) {
    Write-Host "[install] WP-CLI"
    $wpCliDir = Join-Path $env:USERPROFILE "bin"
    New-Item -ItemType Directory -Force -Path $wpCliDir | Out-Null
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar" -OutFile (Join-Path $wpCliDir "wp-cli.phar")
    Set-Content -Path (Join-Path $wpCliDir "wp.bat") -Encoding ASCII -Value '@php "%USERPROFILE%\bin\wp-cli.phar" %*'

    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$wpCliDir*") {
        [Environment]::SetEnvironmentVariable("Path", "$userPath;$wpCliDir", "User")
        Write-Host "[path] Added $wpCliDir to your user PATH. Open a new terminal before using wp."
    }
} else {
    Write-Host "[ok] wp is already installed"
}

Write-Host ""
Write-Host "Installed versions:"
foreach ($tool in @("git", "gh", "node", "npm", "php", "composer", "docker", "ddev", "wp")) {
    $cmd = Get-Command $tool -ErrorAction SilentlyContinue
    if ($cmd) {
        try {
            $version = & $tool --version 2>$null | Select-Object -First 1
        } catch {
            $version = "installed"
        }
        Write-Host " - $tool: $version"
    } else {
        Write-Host " - $tool: missing"
    }
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Restart PowerShell."
Write-Host "2. Run: gh auth login"
Write-Host "3. Start Docker Desktop."
Write-Host "4. Run: ddev version"
