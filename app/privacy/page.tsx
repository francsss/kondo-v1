import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/InfoPage";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Privacy overview"
      title="Collect what helps. Protect what identifies."
      description="This MVP privacy overview explains the product’s current data boundaries. A jurisdiction-reviewed policy is required before public launch."
    >
      <section>
        <h2>Data Kondo uses</h2>
        <p>
          Account identity, study context, chosen interests, communities,
          content, guide progress, listings, reports, sessions, and a
          constrained set of engagement events.
        </p>
      </section>
      <section>
        <h2>Why it is used</h2>
        <ul>
          <li>Authenticate the account and keep sessions secure.</li>
          <li>Personalize relevant communities, guides, and local content.</li>
          <li>Operate marketplace, moderation, reporting, and support.</li>
          <li>Measure weekly engagement and product reliability.</li>
        </ul>
      </section>
      <section>
        <h2>What Kondo does not collect</h2>
        <p>
          The MVP has no wallet, payment, bank-transfer, settlement, KYC, or
          marketplace transaction data.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          Before launch, Kondo must provide verified account export, correction,
          deletion, retention, and contact workflows appropriate to the regions
          it serves.
        </p>
      </section>
    </InfoPage>
  );
}
