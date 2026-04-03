# GHL Custom Menu Embed Configuration

Create both menu items manually in GHL → Settings → Custom Menus.

---

## 1. Customer Portal — Support Chat

| Field       | Value |
|-------------|-------|
| **Name**    | Support |
| **URL**     | `https://legacy-fusion-support.hector-0b9.workers.dev/chat.html?userId={{user.id}}&locationId={{location.id}}` |
| **Open in** | Iframe |
| **Visibility** | Contacts only (hide from team/agents) |

**Notes:**
- `{{contact.token}}` is the GHL magic variable that injects the contact's session token at render time.
- The page reads `?token=` from the URL query string and scopes all ticket/message queries to that contact's identity.
- No login screen is shown when a valid token is present.

---

## 2. Agent Control Center

| Field       | Value |
|-------------|-------|
| **Name**    | Support Center |
| **URL**     | `https://legacy-fusion-support.hector-0b9.workers.dev/control.html?userId={{user.id}}&locationId={{location.id}}` |
| **Open in** | Iframe |
| **Visibility** | Team only (hide from contacts) |

**Notes:**
- `{{user.token}}` injects the GHL team member's session token.
- The page validates role = 'agent' from the Supabase profiles table before showing the control center.
- If the user is not an agent, they see an access denied screen.

---

## Worker URL

```
https://legacy-fusion-support.hector-0b9.workers.dev
```

Deploy with:
```
wrangler publish --env production
```

---

## iframe Security Headers

The Worker sets the following headers on all HTML responses to allow GHL to embed the pages:

```
Content-Security-Policy: frame-ancestors https://app.gohighlevel.com
```

`X-Frame-Options` is intentionally omitted — it would block iframe embedding.

---

## Troubleshooting

- **Blank iframe:** Check that `SUPPORT_CORS_ORIGIN` secret is set to the GHL app origin (`https://app.gohighlevel.com`).
- **Token missing:** Confirm the GHL custom menu URL uses the exact variable syntax `{{contact.token}}` or `{{user.token}}`.
- **Access denied in control center:** The user's Supabase profile row must have `role = 'agent'` — set this manually in the Supabase dashboard or via a migration.
