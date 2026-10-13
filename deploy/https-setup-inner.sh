set -e
DOMAIN=potatobrawl.cloud
[ "$(id -u)" = 0 ] || { echo "Please run as root (type: sudo -i), then paste again."; exit 1; }
MYIP=$(hostname -I | tr ' ' '\n' | grep -E '^[0-9]+\.' | head -1)
DNSIP=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')
if [ "$DNSIP" != "$MYIP" ]; then
  echo "$DOMAIN points to '${DNSIP:-nothing yet}', but this server is $MYIP."
  echo "Set the DNS records in hPanel, wait 10-30 minutes, then paste this again."
  exit 1
fi
SITES="$DOMAIN"
[ "$(getent ahostsv4 "www.$DOMAIN" | awk 'NR==1{print $1}')" = "$MYIP" ] && SITES="$DOMAIN, www.$DOMAIN"
systemctl is-active --quiet potatobrawl || { echo "The game server isn't running. Paste the earlier setup block first."; exit 1; }
BUSY=$(ss -ltnpH '( sport = :80 or sport = :443 )' | grep -v caddy || true)
[ -z "$BUSY" ] || { echo "Something else already uses port 80 or 443:"; echo "$BUSY"; echo "Send me this output before going on."; exit 1; }
apt-get update -qq
if ! apt-get install -y caddy; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y caddy
fi
cat > /etc/caddy/Caddyfile <<CADDY
$SITES {
    reverse_proxy 127.0.0.1:8080
}
CADDY
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy
echo "Getting the certificate, this can take up to a minute..."
for i in $(seq 1 30); do
  curl -sf "https://$DOMAIN/health" >/dev/null && break
  sleep 3
done
echo "----- health check -----"
curl -s "https://$DOMAIN/health" || echo "Not reachable over https yet. Send me the output of: journalctl -u caddy --no-pager | tail -30"
echo "----- send this link to your friends -----"
echo "https://$DOMAIN"
