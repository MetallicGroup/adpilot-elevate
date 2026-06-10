import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, H2, P, UL } from "@/components/marketing/LegalPage";

export const Route = createFileRoute("/gdpr")({
  head: () => ({ meta: [{ title: "GDPR Compliance — AdPilot" }, { name: "description", content: "How AdPilot complies with the EU General Data Protection Regulation." }] }),
  component: () => (
    <LegalPage title="GDPR Compliance" updated="June 10, 2026">
      <P>AdPilot SRL is an EU-based company and is fully committed to the General Data Protection Regulation (Regulation (EU) 2016/679, "GDPR"). This page summarizes how we implement GDPR principles. For full details, please read our Privacy Policy.</P>

      <H2>1. Lawful bases for processing</H2>
      <P>We process personal data only when one of the GDPR lawful bases applies — most commonly: performance of a contract with you, your consent, our legitimate interests (balanced against your rights), or compliance with a legal obligation.</P>

      <H2>2. Data Protection Officer</H2>
      <P>Although we are not strictly required to appoint a DPO under Article 37, we have nominated a privacy lead who can be reached at privacy@adpilot.ro for all data protection matters.</P>

      <H2>3. Your GDPR rights</H2>
      <UL>
        <li><strong>Right of access</strong> — request a copy of the personal data we hold about you.</li>
        <li><strong>Right to rectification</strong> — correct inaccurate or incomplete data.</li>
        <li><strong>Right to erasure</strong> — request deletion of your data, subject to legal retention obligations.</li>
        <li><strong>Right to restrict processing</strong> — limit how we use your data in specific circumstances.</li>
        <li><strong>Right to data portability</strong> — receive your data in a structured, commonly used format.</li>
        <li><strong>Right to object</strong> — object to processing based on legitimate interests or direct marketing.</li>
        <li><strong>Right to withdraw consent</strong> — at any time, without affecting the lawfulness of prior processing.</li>
        <li><strong>Right to lodge a complaint</strong> — with the Romanian DPA (ANSPDCP) or your local supervisory authority.</li>
      </UL>
      <P>To exercise any of these rights, email privacy@adpilot.ro. We respond to all requests within 30 days.</P>

      <H2>4. Data Processing Agreement (DPA)</H2>
      <P>When AdPilot acts as a data processor on your behalf (for example, processing leads collected via your TikTok campaigns), we offer a Data Processing Agreement that incorporates the GDPR-required clauses, including obligations regarding subprocessors, security measures, breach notification, and data subject requests. To request a copy, contact legal@adpilot.ro.</P>

      <H2>5. International data transfers</H2>
      <P>Where personal data is transferred outside the European Economic Area, we rely on European Commission adequacy decisions or Standard Contractual Clauses (SCCs) together with supplementary measures where appropriate.</P>

      <H2>6. Subprocessors</H2>
      <P>We maintain a list of subprocessors used to operate the Services. The current list is available upon request. We notify customers at least 14 days before adding a new subprocessor and give them the right to object.</P>

      <H2>7. Data breach notification</H2>
      <P>In the unlikely event of a personal data breach likely to result in a risk to the rights and freedoms of natural persons, AdPilot will notify the supervisory authority within 72 hours and, when required, inform affected individuals without undue delay.</P>

      <H2>8. Contact</H2>
      <P>For any GDPR-related question, contact privacy@adpilot.ro or write to AdPilot SRL, Str. Exemplului 12, Bucharest, Romania.</P>
    </LegalPage>
  ),
});