import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/InfoPage";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="MVP terms overview"
      title="Use Kondo to help—not to harm."
      description="These draft product rules describe the current MVP boundary. Formal terms reviewed for the launch jurisdictions are required before public release."
    >
      <section>
        <h2>Your account</h2>
        <p>
          Provide accurate information, protect your credentials, and use one
          account for your own student identity. Kondo may suspend access where
          safety or misuse requires it.
        </p>
      </section>
      <section>
        <h2>Community content</h2>
        <p>
          You remain responsible for what you post. Do not upload content you
          cannot share, and do not present personal experience as official
          legal, medical, immigration, or financial advice.
        </p>
      </section>
      <section>
        <h2>Marketplace boundary</h2>
        <p>
          Kondo introduces students and displays listings. It is not the seller,
          buyer, payment processor, escrow provider, delivery service, or
          guarantor of a transaction.
        </p>
      </section>
      <section>
        <h2>Service changes</h2>
        <p>
          The MVP may change as Kondo learns from students. Material policy
          changes must be communicated clearly, with appropriate consent where
          required.
        </p>
      </section>
    </InfoPage>
  );
}
