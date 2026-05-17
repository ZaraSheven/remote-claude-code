# Fix Network Profile - change Xiaomi network from Public to Private
# Run as Administrator

Write-Host "Checking network profiles..." -ForegroundColor Cyan
$profiles = Get-NetConnectionProfile
$profiles | Format-Table Name, NetworkCategory -AutoSize

# Change all Public profiles to Private
$changed = $false
foreach ($profile in $profiles) {
    if ($profile.NetworkCategory -eq 'Public') {
        Write-Host "Changing '$($profile.Name)' from Public to Private..." -ForegroundColor Yellow
        Set-NetConnectionProfile -InterfaceIndex $profile.InterfaceIndex -NetworkCategory Private
        $changed = $true
    }
}

if ($changed) {
    Write-Host "Network profile changed to Private." -ForegroundColor Green
} else {
    Write-Host "No Public profiles found (already Private)." -ForegroundColor Green
}

# Verify firewall rule
Write-Host ""
Write-Host "Checking firewall rule..." -ForegroundColor Cyan
$rule = Get-NetFirewallRule -DisplayName "Remote Claude Code" -ErrorAction SilentlyContinue
if ($rule) {
    $status = if ($rule.Enabled) { 'Enabled' } else { 'Disabled' }
    Write-Host "Firewall rule 'Remote Claude Code' exists and is $status." -ForegroundColor Green
    Write-Host "  Profile: $($rule.Profile)"
    Write-Host "  Direction: $($rule.Direction)"
} else {
    Write-Host "Firewall rule not found, adding..." -ForegroundColor Yellow
    New-NetFirewallRule -DisplayName "Remote Claude Code" -Direction Inbound -Protocol TCP -LocalPort 3456 -Action Allow -Profile Any
    Write-Host "Firewall rule added." -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Try connecting from your phone now." -ForegroundColor Green
Write-Host "URL: http://192.168.31.99:3456"
