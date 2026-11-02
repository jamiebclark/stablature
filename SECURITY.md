# Security

## Reporting something

Open a private security advisory on the repository, or contact the maintainer
directly. Please do not open a public issue for anything exploitable.

This is a small self-hosted project maintained in spare time — there is no
bounty and no SLA, but reports are genuinely welcome and will be acted on.

## What the threat model actually is

stablature is normally run by one person for one band on a home network. It is
not multi-tenant SaaS and has not been hardened as if it were. Worth being
clear about what that means in practice:

- **The operator can read everything.** They hold the database. There is no
  end-to-end encryption and the design does not pretend otherwise.
- **An invite link is a bearer token.** Anyone holding a valid, unexpired,
  unrevoked link can join that band and read it. Links last 30 days and can be
  revoked; treat one like a key.
- **Deletes are soft.** Rows are tombstoned rather than removed, so that an
  offline edit can still merge against them later. Deleted content remains in
  the database until purged.

## What the application does do

- Passwords are hashed by Better Auth; the plaintext is never stored.
- Sessions are HTTP-only cookies.
- Every sync request is authorised per row against band membership, and
  `bandId` is denormalised onto every row so that check cannot be skipped.
- Writes require an `editor` or `owner` role; `viewer` is read-only.
- Sign-in and sign-up are rate limited per IP. The limit is deliberately
  generous because a band behind one NAT address shares it — see
  `STABLATURE_AUTH_RATE_LIMIT`.
- Origins are checked. Anything not matching `BETTER_AUTH_URL` must be listed
  in `STABLATURE_TRUSTED_ORIGINS`, which is the CSRF boundary and is
  deliberately not wildcarded.

## If you expose it to the internet

The defaults assume a LAN. Before putting it on a public address:

- Put it behind TLS. Session cookies over plain HTTP are readable in transit.
- Set a strong `POSTGRES_PASSWORD` and a `BETTER_AUTH_SECRET` from
  `openssl rand -base64 32`. Never reuse the values in the example files.
- Do not publish the Postgres port. Compose maps it to the host for local
  development; that mapping has no business being reachable.
- Never set `STABLATURE_AUTH_RATE_LIMIT=off`. It exists for the test suite.
- Consider that anyone who can reach the sign-up page can create an account.
  There is no invite-only mode for registration yet.
