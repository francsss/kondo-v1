import type { Metadata } from "next";
import { InfoPage } from "@/components/marketing/InfoPage";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <InfoPage
      eyebrow="Why Kondo exists"
      title="Student life should feel less lonely and less confusing."
      description="Kondo is building the trusted digital home African students can carry with them before, during, and after their studies in China."
    >
      <section>
        <h2>The problem</h2>
        <p>
          Essential advice is scattered across private chats, outdated
          documents, and word of mouth. New students repeat the same stressful
          searches while useful experience disappears when someone graduates.
        </p>
      </section>
      <section>
        <h2>The Kondo approach</h2>
        <p>
          Bring community, practical checklists, student Q&A, and nearby student
          listings into one calm product. Keep the experience useful, fast,
          privacy-aware, and free from payment complexity.
        </p>
      </section>
      <section>
        <h2>What guides us</h2>
        <ul>
          <li>Reliability and safety before feature count.</li>
          <li>Advice shaped by real student context.</li>
          <li>Useful engagement instead of noisy attention.</li>
          <li>Respect for the many cultures represented across Africa.</li>
        </ul>
      </section>
    </InfoPage>
  );
}
