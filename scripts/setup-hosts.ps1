$entries = "127.0.0.1 brand.localhost ecommerce.localhost growth.localhost webdev.localhost ai.localhost branding.localhost strategy.localhost finance.localhost engineering.localhost product.localhost video.localhost graphic.localhost"
$hostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
if (Select-String -Path $hostsFile -Pattern "ecommerce.localhost" -Quiet) {
  Write-Host "Already configured."; exit 0
}
# Requires elevated PowerShell
Add-Content -Path $hostsFile -Value $entries
Write-Host "Added 13 mjagency entries to $hostsFile"
