import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/cookie-policy")({
  head: () => ({ meta: [{ title: "Cookie Policy — AdPilot" }, { name: "description", content: "How AdPilot uses cookies and similar technologies." }] }),
  component: () => (
    <LegalPage title="Cookie Policy" updated="June 10, 2026">
      <P>This Cookie Policy explains how AdPilot SRL uses cookies and similar technologies when you visit our website or use the AdPilot platform. It should be read alongside our Privacy Policy.</P>

      <H2>1. What is a cookie?</H2>
      <P>A cookie is a small text file stored on your device by your browser when you visit a website. Cookies allow websites to remember your actions and preferences (such as language, login state and display settings) over time, so you don't have to keep re-entering them.</P>

      <H2>2. Categories of cookies we use</H2>
      <UL>
        <li><strong>Strictly necessary cookies</strong> — required for the website to function (authentication, security, load balancing). These cannot be switched off.</li>
        <li><strong>Functional cookies</strong> — remember your preferences (language, theme, dismissed banners) to give you a better experience.</li>
        <li><strong>Analytics cookies</strong> — help us understand how visitors use the site so we can improve it (e.g. Google Analytics with IP anonymization).</li>
        <li><strong>Marketing cookies</strong> — used by us and our partners (TikTok Pixel, Meta Pixel) to measure the effectiveness of campaigns. Only set with your consent.</li>
      </UL>

      <H2>3. Managing your cookie preferences</H2>
      <P>You can accept or reject non-essential cookies via the cookie banner displayed on your first visit. You can update your choices at any time from the footer "Cookie Preferences" link. You can also block or delete cookies in your browser settings; note that blocking strictly necessary cookies may prevent the Services from functioning correctly.</P>

      <H2>4. Third-party cookies</H2>
      <P>Some cookies are set by third parties (e.g. Stripe for payments, Google for analytics, TikTok and Meta for advertising measurement). These providers have their own privacy and cookie policies, which we encourage you to review.</P>

      <H2>5. Changes to this Policy</H2>
      <P>We may update this Cookie Policy from time to time. The "Last updated" date above reflects the most recent revision. For questions, contact support@adpilot.ro.</P>
    </LegalPage>
  ),
});