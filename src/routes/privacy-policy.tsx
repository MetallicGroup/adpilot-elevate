import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({ meta: [{ title: "Privacy Policy — AdPilot" }, { name: "description", content: "How AdPilot collects, uses, stores and protects your personal data." }] }),
  component: () => (
    <LegalPage title="Privacy Policy" updated="June 10, 2026">
      <P>This Privacy Policy describes how AdPilot SRL ("AdPilot", "we", "us", or "our") collects, uses, stores, shares and protects personal data when you use the AdPilot platform, website and related services (collectively, the "Services"). By using the Services, you agree to the practices described in this Policy.</P>

      <H2>1. Who we are</H2>
      <P>AdPilot SRL is a company incorporated in Romania with its registered office at Romania, registered in Romania. For the purposes of EU data protection law, AdPilot is the data controller of the personal data described in this Policy. You can contact us at support@adpilot.ro for any privacy-related question.</P>

      <H2>2. Information we collect</H2>
      <P>We collect the following categories of information:</P>
      <UL>
        <li><strong>Account information</strong> — name, email address, password hash, profile photo.</li>
        <li><strong>Billing information</strong> — billing address, VAT number, payment method details (processed by Stripe; we do not store card numbers).</li>
        <li><strong>TikTok account data</strong> — OAuth access and refresh tokens, ad account IDs, campaign metadata, performance metrics, lead form responses collected through campaigns you operate.</li>
        <li><strong>Usage data</strong> — pages visited, features used, timestamps, IP address, user agent, device type.</li>
        <li><strong>Support data</strong> — messages you send to us via email, chat, or contact forms.</li>
      </UL>

      <H2>3. How we use your information</H2>
      <P>We use personal data for the following purposes and on the following legal bases:</P>
      <UL>
        <li><strong>To provide the Services</strong> (contract): create your account, connect your TikTok ad account, launch and manage campaigns, deliver leads, generate reports.</li>
        <li><strong>To improve the Services</strong> (legitimate interest): analyze aggregated usage to fix bugs, build features and optimize performance.</li>
        <li><strong>To communicate with you</strong> (contract / legitimate interest): send transactional emails, product updates and security alerts.</li>
        <li><strong>To send marketing</strong> (consent): only when you have opted in.</li>
        <li><strong>To comply with legal obligations</strong> (legal obligation): tax records, regulatory requests, fraud prevention.</li>
      </UL>
      <P>We do not use your personal data for automated decision-making with legal effects on you.</P>

      <H2>4. How we share your information</H2>
      <P>We do not sell or rent personal data to third parties. We share personal data only with the following categories of recipients, each bound by confidentiality and data processing agreements:</P>
      <UL>
        <li>Cloud hosting and database providers used to operate the platform.</li>
        <li>Payment processors (Stripe) for subscription billing.</li>
        <li>Email and messaging providers used for transactional communications.</li>
        <li>TikTok For Business, as required to operate the campaigns you authorize on your behalf.</li>
        <li>Analytics providers (e.g. Google Analytics) configured with IP anonymization where applicable.</li>
        <li>Authorities, when required by law or to protect our rights or those of users.</li>
      </UL>

      <H2>5. International data transfers</H2>
      <P>Some service providers we use are located outside the European Economic Area. When we transfer personal data outside the EEA, we rely on appropriate safeguards such as the European Commission's Standard Contractual Clauses or adequacy decisions. You can request a copy of the safeguards by contacting support@adpilot.ro.</P>

      <H2>6. Data retention</H2>
      <P>We retain personal data for as long as necessary to provide the Services and to comply with our legal obligations. Specifically:</P>
      <UL>
        <li>Account information: for the duration of your account, plus 24 months after deletion for legal and dispute-resolution purposes.</li>
        <li>Billing records: 10 years, as required by Romanian fiscal law.</li>
        <li>TikTok lead data: for the duration of your account or until you delete it from the platform, whichever comes first.</li>
        <li>Support correspondence: 24 months from the last interaction.</li>
      </UL>

      <H2>7. Your rights</H2>
      <P>Under the GDPR you have the right to: access your data; rectify inaccurate data; erase your data; restrict processing; object to processing; data portability; and to withdraw consent at any time. You also have the right to lodge a complaint with the Romanian Data Protection Authority (ANSPDCP) or your local supervisory authority. To exercise any of these rights, email support@adpilot.ro and we will respond within 30 days.</P>

      <H2>8. Security</H2>
      <P>We implement industry-standard security measures including TLS in transit, AES-256 encryption at rest, role-based access controls, audit logging, automated backups, and least-privilege production access. Despite these measures, no system is perfectly secure; we encourage you to use a strong, unique password and to enable two-factor authentication where available.</P>

      <H2>9. Children</H2>
      <P>AdPilot is not directed at children under the age of 16, and we do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact support@adpilot.ro and we will delete it.</P>

      <H2>10. Cookies</H2>
      <P>We use cookies and similar technologies as described in our Cookie Policy. You can manage your preferences via the cookie banner displayed on first visit.</P>

      <H2>11. TikTok-specific disclosures</H2>
      <P>When you connect your TikTok For Business account to AdPilot via OAuth, we receive an access token and refresh token that allow AdPilot to operate the TikTok Marketing API on your behalf. We use those tokens exclusively to perform the actions you instruct: creating campaigns, retrieving performance metrics, downloading lead form responses, and managing budgets. We never use your TikTok data to train AI models, build advertising profiles outside your account, or share TikTok data with third parties beyond what is described in this Policy. You can revoke AdPilot's access at any time from your TikTok Business Center settings.</P>

      <H2>12. Changes to this Policy</H2>
      <P>We may update this Policy from time to time. Material changes will be communicated via email and/or an in-app banner at least 14 days before they take effect. The "Last updated" date at the top reflects the most recent revision.</P>

      <H2>13. Contact</H2>
      <P>If you have any question about this Policy or our data practices, please contact: AdPilot SRL, support@adpilot.ro, Romania.</P>
    </LegalPage>
  ),
});