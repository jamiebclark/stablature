# Contract: rules and writes

## Shared declarations: `src/lib/model.ts`

```ts
export const GROUP_KINDS = ["tuplet", "plain"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export const MIN_GROUP_COLUMNS = 2;
export const MAX_TUPLET_COLUMNS = 16;

/** The three group fields of a column in no group. Spread, never restated. */
export const NO_GROUP = { tupletId: null, tupletCount: null, groupKind: null } as const;

/** The number a group prints, or null for none. See research R2. */
export function groupNumber(row: Pick<EventRow, "tupletCount" | "groupKind">): number | null;

export interface EventRow extends SyncMeta {
  // ...
  /** Which presentation the group uses. Absent on rows written before this field existed. */
  groupKind?: GroupKind | null;
}
```

`"groupKind"` joins `MERGEABLE_FIELDS.events` after `"tupletCount"`.

## Pure rules: `src/lib/capture/grouping.ts`

No Dexie, no React. Imports only `model.ts`.

```ts
export const TRIPLET_REFUSAL = "a triplet needs three columns in one bar";

export interface GroupOffer {
  /** The one counted tuplet on offer. Its length is the numeral and the stored count. */
  readonly tuplet: readonly EventRow[] | null;
  /** One run per bar holding at least two selected playable columns. */
  readonly plain: readonly (readonly EventRow[])[];
  readonly ungroup: boolean;
}

/** `selected` is a contiguous run in rank order, barlines included. */
export function groupOffer(selected: readonly EventRow[]): GroupOffer;

/**
 * The `count` rows ending at `endId`, or at the last playable row when `endId` is null.
 * Null if there are too few, if a barline falls among them, or if `count` is out of range.
 */
export function runEndingAt(
  rows: readonly EventRow[],
  endId: string | null,
  count: number,
): readonly EventRow[] | null;
```

The toolbar and the write both call `groupOffer`. No caller passes a count for a selection.

## Writes: `src/lib/local/editing.ts`

All are one `mutateBatch`, all read rows inside it through `listEvents(partId, inner.db)`, and
none takes a row's group fields from its caller. `groupAsTuplet` is removed: it has one caller,
no test imports it, and its contract let a caller state a false count.

```ts
/**
 * Group the selection between two columns, in either order. Recomputes `groupOffer` from stored
 * rows and acts on that. Returns the new group ids, which is empty when nothing was on offer.
 */
export async function groupSelection(
  partId: string,
  anchorId: string,
  headId: string,
  kind: GroupKind,
  ctx?: MutateContext,
): Promise<string[]>;

/** Make the `count` columns ending at `endId` a counted tuplet. Undefined means no write. */
export async function groupRunEndingAt(
  partId: string,
  endId: string | null,
  count: number,
  ctx?: MutateContext,
): Promise<string | undefined>;

/** Kept, per FR-025. Exactly `groupRunEndingAt(partId, null, count, ctx)`. */
export async function tripletFromTail(
  partId: string,
  count = 3,
  ctx?: MutateContext,
): Promise<string | undefined>;

/**
 * Dissolve every group any of these columns is in, across the part they belong to, whether or
 * not its columns are listed. Group ids come from stored rows. Same signature as today.
 */
export async function ungroupTuplet(
  events: readonly EventRow[],
  ctx?: MutateContext,
): Promise<void>;
```

### One private writer

`groupSelection` and `groupRunEndingAt` both end in one private function, so the rules exist
once:

```text
regroup(inner, rows, runs, kind):
  joining   = ids of every column in runs
  dissolved = every non-null tupletId among those columns
  for each row not joining, with a tupletId in dissolved: patch NO_GROUP
  for each run: mint one id, and patch every column with all three fields
```

Columns are patched with `patchRow`, so each gets one clock across all three fields, and an
outbox entry. Nothing else in the row is written.

### Creation paths

`insertColumn`, `appendColumn`, `appendBarline` spread `NO_GROUP`. `createVariant` copies all
three, with `groupKind: event.groupKind ?? null`. `pasteClipboard` writes
`groupKind: column.groupKind ?? null`.

## Wire: `src/lib/sync/protocol.ts`

```ts
tupletCount: z.number().int().min(MIN_GROUP_COLUMNS).max(MAX_TUPLET_COLUMNS).nullable(),
groupKind: z.enum(GROUP_KINDS).nullable().optional(),
```

No `.default()`. No change to the push or pull routes, `server/sync.ts`, or `merge.ts`.

## Schema: `src/db/schema/`

`domain.ts` gains `pgEnum("group_kind", ["tuplet", "plain"])` and
`groupKind: groupKind("group_kind")` after `tupletCount`. `assert-model.ts` gains:

```ts
// `groupKind` is optional on EventRow, so _Events alone cannot see this column go missing.
export type _EventGroupKind = AssertExtends<
  (typeof events.$inferSelect)["groupKind"],
  NonNullable<EventRow["groupKind"]> | null
>;
```

`_Events` itself is not touched.
