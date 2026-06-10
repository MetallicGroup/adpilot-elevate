import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/terms-of-service")({
  head: () => ({ meta: [{ title: "Terms of Service — AdPilot" }, { name: "description", content: "The terms and conditions that govern your use of the AdPilot platform." }] }),
  component: () => (
    <LegalPage title="Terms of Service" updated="June 10, 2026">
      <P>These Terms of Service ("Terms") form a legally binding agreement between you ("Customer" or "you") and AdPilot SRL ("AdPilot", "we", "us") and govern your access to and use of the AdPilot platform, website and related services (the "Services"). By creating an account or using the Services, you agree to be bound by these Terms.</P>

      <H2>1. The Services</H2>
      <P>AdPilot provides a software-as-a-service platform that helps businesses create, manage, optimize and report on advertising campaigns on TikTok For Business. The Services include campaign creation tools, AI-assisted asset generation, lead delivery, analytics dashboards, and a conversational assistant available via WhatsApp.</P>

      <H2>2. Account registration</H2>
      <P>To use the Services you must create an account. You agree to provide accurate, complete and current information, to keep your password confidential, and to notify us immediately of any unauthorized access. You are responsible for all activity that occurs under your account. You must be at least 18 years old and authorized to bind the business on whose behalf you register.</P>

      <H2>3. TikTok account connection</H2>
      <P>To operate campaigns, you must connect your TikTok For Business account to AdPilot via the official TikTok OAuth flow. You confirm that you have the right and the authority to grant AdPilot access to the TikTok ad account(s) you connect. Your TikTok account always remains your property — AdPilot acts solely on your instructions and within the permissions you grant.</P>

      <H2>4. Acceptable use</H2>
      <P>You agree not to use the Services to:</P>
      <UL>
        <li>Violate any law or regulation, including advertising laws in your jurisdiction.</li>
        <li>Run campaigns that promote illegal products, hate speech, harassment, misinformation, or sexually explicit material.</li>
        <li>Infringe any intellectual property, privacy or publicity right of any third party.</li>
        <li>Reverse-engineer, decompile, or attempt to extract source code from the Services.</li>
        <li>Probe, scan or test the vulnerability of the Services without our prior written consent.</li>
        <li>Use the Services to send spam, malware or any harmful code.</li>
        <li>Resell, sublicense or otherwise commercialize the Services without our written agreement.</li>
      </UL>
      <P>You must also comply with the TikTok Advertising Policies and the TikTok Business Products (Data) Terms at all times.</P>

      <H2>5. Subscriptions, billing and trials</H2>
      <P>AdPilot is offered as a paid monthly subscription. New customers may be eligible for a 14-day free trial. After the trial, subscriptions renew automatically each month at the then-current price until cancelled. You can cancel at any time from your account settings; cancellation takes effect at the end of the current billing period. Fees are non-refundable except where required by law. We may change pricing with at least 30 days' notice; price changes apply to renewals only.</P>
      <P>Subscription fees cover access to the AdPilot platform only. TikTok ad spend is billed directly by TikTok and is not included in your AdPilot subscription.</P>

      <H2>6. Customer content and data</H2>
      <P>You retain all rights in the content, creatives, copy, brand assets and data you upload to or generate through the Services ("Customer Data"). You grant AdPilot a limited, worldwide, non-exclusive license to host, process, transmit and display Customer Data for the sole purpose of providing and improving the Services. You are responsible for ensuring you have all necessary rights and consents to use Customer Data with the Services.</P>

      <H2>7. AI-generated content</H2>
      <P>The Services use third-party AI providers to generate suggested audiences, copy and campaign structures. AI output may be inaccurate, incomplete or unsuitable. You are responsible for reviewing all AI-generated content before publishing it. We do not warrant that AI-generated content is original, fit for any particular purpose, or free of third-party claims.</P>

      <H2>8. Confidentiality</H2>
      <P>Each party agrees to treat the other party's non-public information as confidential and to use it only for the purposes of these Terms. This obligation survives termination of these Terms for a period of 3 years.</P>

      <H2>9. Intellectual property</H2>
      <P>AdPilot, its logo, its codebase, its documentation and all related intellectual property are owned by AdPilot SRL. No rights are granted to you except the limited right to use the Services as described in these Terms.</P>

      <H2>10. Warranty disclaimer</H2>
      <P>The Services are provided "as is" and "as available". To the maximum extent permitted by law, AdPilot disclaims all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose and non-infringement. We do not guarantee specific advertising results, campaign performance, ROAS, lead volume or revenue.</P>

      <H2>11. Limitation of liability</H2>
      <P>To the maximum extent permitted by law, AdPilot's total aggregate liability arising out of or in connection with these Terms shall not exceed the fees you paid to AdPilot in the 12 months preceding the event giving rise to the claim. In no event shall AdPilot be liable for indirect, incidental, consequential, special, exemplary or punitive damages, including lost profits, lost revenue, or loss of data.</P>

      <H2>12. Indemnification</H2>
      <P>You agree to indemnify and hold AdPilot harmless from any claim, demand, loss or expense (including reasonable attorneys' fees) arising out of your use of the Services in violation of these Terms, applicable law or the rights of a third party.</P>

      <H2>13. Termination</H2>
      <P>You may terminate your account at any time. We may suspend or terminate your account if you breach these Terms, fail to pay fees, or engage in fraudulent or unlawful activity. Upon termination, your right to use the Services ceases immediately. Sections that by their nature should survive termination (confidentiality, IP, liability, indemnification, governing law) will survive.</P>

      <H2>14. Governing law and jurisdiction</H2>
      <P>These Terms are governed by the laws of Romania, without regard to its conflict-of-laws principles. Any dispute arising out of these Terms shall be subject to the exclusive jurisdiction of the competent courts of Bucharest, Romania.</P>

      <H2>15. Changes to these Terms</H2>
      <P>We may update these Terms from time to time. Material changes will be communicated at least 30 days in advance via email and/or an in-app notice. Your continued use of the Services after the effective date of the update constitutes acceptance of the revised Terms.</P>

      <H2>16. Contact</H2>
      <P>Questions about these Terms? Email legal@adpilot.ro or write to AdPilot SRL, Str. Exemplului 12, Bucharest, Romania.</P>
    </LegalPage>
  ),
});