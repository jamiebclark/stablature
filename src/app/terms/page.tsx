import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/app/Prose";

export const metadata: Metadata = {
  title: "Terms · stablature",
  description: "The short version: it is self-hosted software, your tab is yours.",
};

export default function TermsPage() {
  return (
    <Prose title="Terms" updated="2 November 2026">
      <p>
        stablature is software you run yourself. These terms are between you and whoever
        operates the installation you are using — there is no company in the middle.
      </p>

      <h2>Your work is yours</h2>
      <p>
        The tablature, arrangements and notes you write remain entirely yours. Nothing here
        claims any licence over them. The export button exists so that leaving is never
        blocked on anyone&apos;s cooperation.
      </p>

      <h2>Accounts</h2>
      <p>
        You are responsible for your password and for who you hand invite links to. An
        invite link admits anyone holding it to that band, so treat one as a key rather
        than an announcement.
      </p>
      <p>
        Band owners can see and remove anything in their band. If you join someone
        else&apos;s band, you are a guest in their data.
      </p>

      <h2>No warranty</h2>
      <p>
        The software is provided as it is, with no warranty of any kind. It is a notebook,
        not a backup service: keep your own copy of anything you would be upset to lose.
        The export button is the intended way to do that.
      </p>
      <p>
        Neither the operator nor the authors are liable for lost data, lost work, or a
        riff you forgot because the phone was flat.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not use someone else&apos;s installation to store material that is illegal where
        they live, and do not try to reach bands you were not invited to. Operators can
        remove accounts and content on their own installations at their discretion.
      </p>

      <h2>Changes</h2>
      <p>
        These terms can change; the date at the top says when they last did, and the
        history is in the repository.
      </p>

      <p>
        See also{" "}
        <Link href="/privacy" className="text-accent hover:underline">
          privacy
        </Link>
        , which covers what is stored and who can see it.
      </p>
    </Prose>
  );
}
