#!/usr/bin/env bash
set -euo pipefail
ENTRIES="127.0.0.1 brand.localhost ecommerce.localhost growth.localhost webdev.localhost ai.localhost branding.localhost strategy.localhost finance.localhost engineering.localhost product.localhost video.localhost graphic.localhost"
HOSTS_FILE=/etc/hosts
if grep -q "ecommerce.localhost" "$HOSTS_FILE"; then
  echo "Already configured."
  exit 0
fi
echo "$ENTRIES" | sudo tee -a "$HOSTS_FILE"
echo "Added 13 mjagency entries to /etc/hosts"
