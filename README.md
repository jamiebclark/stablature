# stablature

Bass tablature capture for bands that build songs out of lettered parts.

The point is speed at band practice: when someone is showing you a riff, you
pull out your phone, tap it in, and it is saved — in a dead-zone rehearsal
space, with no signal, on a 5-string. And the point of the *reading* side is
density: a song is a short set of parts plus an arrangement that sequences
them (`A ×4, B, A ×4 with a flourish on the 4th, C first half, D`), so the
whole form fits on one screen instead of unrolling into metres of linear tab.

## Running it

```sh
cp .env.example .env.local        # host dev
cp .env.docker.example .env       # docker compose
npm install
npm run db:up                     # Postgres in docker
npm run db:migrate
npm run dev
```

Self-hosting:

```sh
docker compose up -d              # migrations run on container boot
```

Set `APP_URL` in `.env` to the address the **phone** will use, not
`localhost` — the session cookie will not stick otherwise.

### Two things that will bite you

**The database URL is `STABLATURE_DATABASE_URL`, not `DATABASE_URL`.** This is
deliberate. Ambient shell variables take precedence over `.env` files in both
Node's `--env-file` and Next, so on a machine running several projects a
generic `DATABASE_URL` means migrations silently run against whichever
database your shell happens to be pointing at. A unique name makes that
impossible.

**Postgres is on host port 5440**, not 5432, because this machine already has
other Postgres containers. Change `POSTGRES_PORT` if you like.

## How it works

Screens read **only** from IndexedDB, through Dexie's `useLiveQuery`. Postgres
is downstream of the local store, not upstream of it — which is the single
decision that makes capture work offline, because the network is not in the
read path at all.

Because several people can edit while offline, writes have to merge. There is
no CRDT library; instead the schema removes the hard cases:

| Problem | Why it cannot happen |
| --- | --- |
| Two offline inserts collide | Ids are client-minted UUIDv7 |
| Two offline reorders collide | Order is a fractional index string, not an integer position |
| A stale write clobbers a newer one | Every field carries its own hybrid logical clock |
| A delete cannot merge | Deletes are tombstones, never removals |

What remains is two people editing *the same field of the same row*, where
last-write-wins is the answer a band actually wants. Merging is commutative
and idempotent, so replicas converge regardless of delivery order — there is
a test that asserts this across all 24 orderings of four concurrent edits.

### Layout

```
src/lib/hlc.ts          hybrid logical clocks
src/lib/rank.ts         fractional index ordering
src/lib/pitch.ts        MIDI/note arithmetic
src/lib/tunings.ts      tunings and fretboard geometry
src/lib/model.ts        canonical row types + mergeable-field registry
src/lib/sync/merge.ts   field-level last-write-wins
src/lib/local/          Dexie mirror, write path, queries, hooks
src/db/schema/          Drizzle schema (Postgres side)
```

String index **0 is the highest-pitched string**, the opposite of the usual
convention. Bass extensions go downward — a 5-string is BEADG, adding a low B
below standard EADG — so numbering from the top means changing string count
never renumbers notes already captured. It also matches render order.

`src/db/schema/assert-model.ts` fails `npm run typecheck` if the SQL schema
drifts from `src/lib/model.ts`, naming the table that drifted.

## Scripts

| | |
| --- | --- |
| `npm run dev` | dev server |
| `npm test` | unit tests (vitest) |
| `npm run test:e2e` | end-to-end (playwright) |
| `npm run typecheck` | tsc, including the schema drift guard |
| `npm run db:generate` | generate a migration from schema changes |
| `npm run db:migrate` | apply migrations |
| `npm run db:studio` | drizzle studio |

Commits follow [Conventional Commits](https://www.conventionalcommits.org);
commitlint enforces it on `commit-msg` and releases are cut by
semantic-release.
