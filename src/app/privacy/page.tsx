import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/app/Prose";

export const metadata: Metadata = {
  title: "Privacy · stablature",
  description: "What stablature stores, where it stores it, and who can see it.",
};

/**
 * Written plainly and specifically rather than from a template.
 *
 * Most of what a privacy policy usually has to disclose does not apply here:
 * there are no third parties, no analytics, and no advertising, because the
 * software talks to exactly one server and that server belongs to whoever
 * installed it. What *is* worth spelling out is the part people would not
 * guess -- that deletes are soft, and that a copy of everything lives in the
 * browser.
 */
export default function PrivacyPage() {
  return (
    <Prose title="Privacy" updated="2 November 2026">
      <p>
        stablature is self-hosted software. There is no company behind it and no central
        service: it runs on a server somebody set up, and that person — the{" "}
        <strong>operator</strong> — holds the data. If you were invited to a band on
        someone&apos;s installation, they are the operator, not us.
      </p>
      <p>
        This page describes what the software does with your data. It is written to be
        accurate about this application, not to be comprehensive about the law.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li>
          <strong>Your account</strong> — the name and email address you sign up with, and
          a hash of your password. The password itself is never stored.
        </li>
        <li>
          <strong>What you write</strong> — bands, songs, tunings, tablature, arrangements
          and the notes you add to them.
        </li>
        <li>
          <strong>Session records</strong> — so you stay signed in, with the approximate
          time, your IP address and your browser&apos;s user-agent string.
        </li>
      </ul>
      <p>
        There is no analytics, no tracking, no advertising, and no third-party service of
        any kind. Nothing is sent anywhere except the server you signed in to.
      </p>

      <h2>Where it is stored</h2>
      <p>
        In two places. A copy lives <strong>in your browser</strong>, so the app keeps
        working with no signal — this is the whole point of it, and it means your
        tablature is on your device whether or not you ever sign in. A second copy lives
        in the operator&apos;s <strong>database</strong>, which is what lets your bandmates
        see it.
      </p>
      <p>
        If you never sign in, nothing leaves your device. Signing in is what enables
        syncing, and nothing else.
      </p>

      <h2>Who can see it</h2>
      <p>
        Members of a band can see and edit everything in that band. Anyone holding a valid
        invite link can join a band and thereby see its contents, so treat an invite link
        as you would a key. The operator has access to the database and can therefore read
        anything in it.
      </p>

      <h2>Deleting things</h2>
      <p>
        Worth knowing, because it is unusual: <strong>deleting does not immediately
        erase</strong>. When you delete a part, song or band it is marked as deleted and
        hidden everywhere, but the row is kept. This is how an edit made on a phone with no
        signal can still merge correctly days later — a record that vanished outright could
        not be reconciled with a change made against it.
      </p>
      <p>
        Deleted records remain in the database until the operator purges them. If you need
        something genuinely erased, ask the operator to remove it at the database level.
      </p>

      <h2>Cookies</h2>
      <p>
        One, and only when you sign in: a session cookie that keeps you signed in. There
        are no analytics or advertising cookies, so there is nothing to consent to and no
        banner to dismiss.
      </p>

      <h2>Getting your data out</h2>
      <p>
        Any song can be exported as plain text from its page — the arrangement and every
        part, in a format that will still open in ten years. You do not need anyone&apos;s
        permission or an export request to do it.
      </p>

      <h2>Children</h2>
      <p>
        There is no age gate. The software is a notebook for musicians and collects nothing
        beyond what is described above.
      </p>

      <h2>Changes</h2>
      <p>
        If this page changes, the date at the top changes with it. The history is in the
        repository, so you can see exactly what changed and when.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about your data go to whoever runs the installation you are using. For
        the software itself, see{" "}
        <Link href="/terms" className="text-accent hover:underline">
          the terms
        </Link>
        .
      </p>
    </Prose>
  );
}
