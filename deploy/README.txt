update.txt        the short update block for the live game, pasted after a pull request is merged
beta-setup.txt    one-time setup of https://beta.potatobrawl.cloud (second copy on 127.0.0.1:8081)
beta-update.txt   put any branch on the beta address to try it before it goes live
first-setup.txt   first-time install of Node, the potatobrawl user, the repo and the systemd unit
https-setup-inner.sh  the Caddy/HTTPS setup that was run on 2026-10-13 (paste wrapped in bash <<'EOF' ... EOF)
accounts-setup.txt  one-time: switches on accounts (sync codes). Paste it once as root, after update.txt has put the version with accounts.js live. It creates /var/lib/potatobrawl/accounts, tells the game about it (systemd drop-in, game listens on 127.0.0.1 only), installs a nightly backup (14 days in /var/backups/potatobrawl), restarts the game, prints "accounts are on" and "the site still works", and then closes port 8080 in the firewall. Until it is pasted the game works as before and the Account sheet says "Saving to an account isn't available yet."
