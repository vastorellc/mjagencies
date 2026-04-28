# infra/cloudflare/bot-fight-mode.tf
# Bot Fight Mode (free tier) — challenges automated traffic from known-bad
# ASNs. Pitfall 8.4: Cloudflare-verified bots (cf.client.bot=true) bypass via
# the skip rule defined in firewall-rules.tf.
#
# Free tier: bot_fight_mode is a simple on/off zone setting. Pro tier exposes
# super_bot_fight_mode_definitely_automated and per-bot-class controls — out
# of scope for v1 (see README.md §Pro tier upgrade trigger).
#
# Provider 4.40 exposes Bot Fight Mode via cloudflare_zone_setting with
# setting_id="bot_fight_mode" and value="on" / "off".

resource "cloudflare_zone_setting" "bot_fight_mode" {
  for_each   = var.zone_ids
  zone_id    = each.value
  setting_id = "bot_fight_mode"
  value      = "on"
}

# Increase challenge_ttl so users solving a Cloudflare CAPTCHA aren't
# re-challenged constantly (default 30min is fine, set explicit for clarity).
resource "cloudflare_zone_setting" "challenge_ttl" {
  for_each   = var.zone_ids
  zone_id    = each.value
  setting_id = "challenge_ttl"
  value      = "1800" # 30 minutes
}
