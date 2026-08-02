# Self-hosted email on the droplet (ajira.online)

Mail stack on `209.38.225.150` (shared with efundo.org):

| Service | Role |
|---------|------|
| Postfix | SMTP (25), submission (587), SMTPS (465) |
| Dovecot | IMAPS (993) |
| OpenDKIM | DKIM signing |

## Mailboxes

- `info@ajira.online` — app / transactional mail
- `admin@ajira.online`
- `support@ajira.online`
- Aliases: `postmaster@`, `abuse@` → `admin@`; `noreply@` → `info@`

Passwords (root only on the droplet):

```bash
ssh root@209.38.225.150 'cat /root/ajira-mail-credentials.txt'
```

## DNS records (DigitalOcean DNS for ajira.online)

Add these at DigitalOcean → Networking → Domains → **ajira.online**:

| Type | Name / Host | Value |
|------|-------------|-------|
| **MX** | `@` | `10 ajira.online.` |
| **TXT** (SPF) | `@` | `v=spf1 ip4:209.38.225.150 -all` |
| **TXT** (DKIM) | `mail._domainkey` | see DKIM value below |
| **TXT** (DMARC) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:admin@ajira.online; adkim=r; aspf=r` |

### DKIM value

On the droplet:

```bash
python3 - <<'PY'
from pathlib import Path
import re
text = Path("/etc/opendkim/keys/ajira.online/mail.txt").read_text()
print("".join(re.findall(r'"([^"]*)"', text)))
PY
```

Paste as **one** TXT record (no line breaks).

Current public key (as generated on setup):

```text
v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAweb1CJ6+xLNJhs7U3oz7hCZNuWb0zeTDcv87oDiQmQaupe02QMzw5+kz3aphCQUBn16H8GQlWltKQV8o2PSxgYMTh7Pzd8fhx94EX3tpJUjwrF7pZZ7YI6ooVBXNyiREtTzFRQ1Twq92P7SjKA/ZyjcTfD1Mr3sAiDYxQ/AZD/iGT7mTmto7EM+feVzHmBe+56pv+BbBOqHkXs7ltAElNgp6ht16kwbcOBpEXS1EucctuWZTZheKCnpwGt0udO2Nn35ne/RDIPIjGrXFWMoUeYWrMTObiZdNAGEfZKwJePhAfznUTIrJd73/x4ndCPb0egiH2vqRZQAOKIMjg8wHZQIDAQAB
```

### Reverse DNS (PTR)

This droplet IP already has a PTR aimed at the efundo host. One IP can only have one PTR. Keep the primary PTR as-is; Ajira relies on SPF + DKIM + DMARC for deliverability.

## Mail client settings

| Setting | Value |
|---------|-------|
| Incoming | IMAP, `ajira.online`, port **993**, SSL/TLS |
| Outgoing | SMTP, `ajira.online`, port **587**, STARTTLS (or **465** SSL) |
| Username | full address (`info@ajira.online`) |
| Password | from `/root/ajira-mail-credentials.txt` |

## App SMTP

Production `/var/www/ajira/.env`:

```bash
SMTP_HOST=ajira.online
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@ajira.online
SMTP_PASS='(from credentials file)'
MAIL_FROM='Ajira <info@ajira.online>'
```

Welcome emails are sent on public registration and admin-created accounts. If SMTP vars are unset, messages are logged instead of sent.

## Verify after DNS propagates

```bash
dig +short MX ajira.online
dig +short TXT ajira.online
dig +short TXT mail._domainkey.ajira.online
dig +short TXT _dmarc.ajira.online

# Auth check on droplet
ssh root@209.38.225.150 'doveadm auth test info@ajira.online "$(awk "/^info@ajira.online/{print \$2}" /root/ajira-mail-credentials.txt)"'

# Send a test from Gmail to support@ajira.online, then:
ssh root@209.38.225.150 'find /var/mail/vhosts/ajira.online/support -type f | wc -l'
```

Outbound reputation: https://www.mail-tester.com

## Notes

- No webmail UI (use Thunderbird, Apple Mail, Outlook, or Gmail “Check mail from other accounts”).
- Shared ~2 GB droplet with efundo — keep spam filtering light.
- Let’s Encrypt renewals reload Postfix/Dovecot/OpenDKIM via `/etc/letsencrypt/renewal-hooks/deploy/reload-mail.sh`.
- TLS SNI serves the `ajira.online` certificate when clients connect as that hostname.
