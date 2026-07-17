import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/InfoPage";

export const metadata: Metadata = { title: "Community guidelines" };

export default function GuidelinesPage() {
  return (
    <InfoPage
      eyebrow="Community care"
      title="Help make Kondo a place students can trust."
      description="These principles apply to posts, comments, questions, answers, profiles, communities, and marketplace listings."
    >
      <section>
        <h2>Be generous and specific</h2>
        <p>
          Share what you know, say when your experience happened, and
          distinguish personal advice from an official requirement.
        </p>
      </section>
      <section>
        <h2>Protect people</h2>
        <ul>
          <li>
            No harassment, hate, threats, or unwanted disclosure of personal
            information.
          </li>
          <li>
            No scams, impersonation, deceptive listings, or requests for advance
            payment.
          </li>
          <li>
            No sexual exploitation, dangerous instructions, or content that puts
            students at risk.
          </li>
        </ul>
      </section>
      <section>
        <h2>Keep marketplace contact safe</h2>
        <p>
          Meet in a public place, inspect items before paying, and never treat a
          Kondo profile as a guarantee. Kondo does not process payments or
          request deposits.
        </p>
      </section>
      <section>
        <h2>Moderation</h2>
        <p>
          Members can report content. Moderators may limit visibility, remove
          content, suspend accounts, preserve audit records, or escalate a
          serious safety concern.
        </p>
      </section>
    </InfoPage>
  );
}
