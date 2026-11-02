/**
 * Compile-time guard that the SQL schema still matches src/lib/model.ts.
 *
 * Client code deliberately never imports Drizzle, so the row types are
 * declared by hand in model.ts. This file is what stops the two drifting:
 * rename or retype a column and `npm run typecheck` fails here, naming the
 * table, instead of the mismatch surfacing as a runtime bug during sync.
 *
 * It has no runtime behaviour and is never imported.
 */

import type {
  AnnotationRow,
  ArrangementEntryRow,
  BandRow,
  EventRow,
  PartRow,
  SongRow,
  TuningRow,
} from "@/lib/model";
import { annotations, arrangementEntries, bands, events, parts, songs, tunings } from "./domain";

/** Fails to compile unless `A` is assignable to `B`. */
type AssertExtends<A extends B, B> = [A, B];

// Server-only extras (createdAt) are fine: assignability permits extra fields.
export type _Bands = AssertExtends<typeof bands.$inferSelect, BandRow>;
export type _Tunings = AssertExtends<typeof tunings.$inferSelect, TuningRow>;
export type _Songs = AssertExtends<typeof songs.$inferSelect, SongRow>;
export type _Parts = AssertExtends<typeof parts.$inferSelect, PartRow>;
export type _Events = AssertExtends<typeof events.$inferSelect, EventRow>;
export type _Annotations = AssertExtends<typeof annotations.$inferSelect, AnnotationRow>;
export type _Arrangement = AssertExtends<
  typeof arrangementEntries.$inferSelect,
  ArrangementEntryRow
>;
