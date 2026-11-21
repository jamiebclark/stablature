/**
 * Every non-success answer of the memo audio routes, in one table.
 *
 * The server builds its JSON answers from this, and the client shows whatever
 * message arrived, so the two cannot drift.
 */

import { READ_ONLY_MESSAGE } from "../sync/protocol";

export type RefusalCode =
  | "signed_out"
  | "not_found"
  | "not_uploaded"
  | "read_only"
  | "format"
  | "format_mismatch"
  | "too_large"
  | "size_mismatch"
  | "content_mismatch"
  | "incomplete"
  | "deleted"
  | "erased"
  | "part_deleted"
  | "different_file"
  | "band_full";

export const REFUSALS: Record<RefusalCode, { status: number; message: string }> = {
  signed_out: {
    status: 401,
    message: "Sign in to sync. Your local changes are safe and will push once you do.",
  },
  not_found: { status: 404, message: "That memo is not on the server." },
  not_uploaded: { status: 404, message: "The recording device has not uploaded this memo yet." },
  read_only: { status: 403, message: READ_ONLY_MESSAGE },
  format: {
    status: 415,
    message:
      "This memo's format isn't one the server accepts. Memos must be MP4, WebM or Ogg audio.",
  },
  format_mismatch: {
    status: 415,
    message: "This memo's audio doesn't match the format it was saved with.",
  },
  too_large: { status: 413, message: "This memo is larger than 8 MB, the most the server accepts." },
  size_mismatch: {
    status: 422,
    message: "This memo's audio isn't the size it was saved with. Try recording it again.",
  },
  content_mismatch: {
    status: 422,
    message: "This memo's audio doesn't match the format it was saved with.",
  },
  incomplete: { status: 400, message: "The upload was cut off. It will be tried again." },
  deleted: { status: 410, message: "This memo was deleted." },
  erased: { status: 410, message: "This memo's audio was deleted." },
  part_deleted: { status: 410, message: "This memo's part was deleted." },
  different_file: {
    status: 409,
    message: "The server already has different audio for this memo.",
  },
  band_full: {
    status: 507,
    message:
      "This band's memos have used all 500 MB of room on the server. Delete some old memos to sync this one.",
  },
};
