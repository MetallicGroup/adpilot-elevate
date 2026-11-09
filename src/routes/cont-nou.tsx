import { createFileRoute } from "@tanstack/react-router";
import { FlowShell, v3Head } from "@/components/v3/ui";
import { PhoneAuth } from "@/components/v3/PhoneAuth";

export const Route = createFileRoute("/cont-nou")({
  head: () =>
    v3Head(
      "Cont nou — AdPilot",
      "Fă-ți contul AdPilot în 30 de secunde și pornește prima campanie azi.",
    ),
  component: SignupPage,
});

function SignupPage() {
  return (
    <FlowShell step={0} helpText="Salut Daniel, vreau să-mi fac cont pe AdPilot și am o întrebare.">
      <div className="auth">
        <PhoneAuth mode="signup" next={null} />
        <aside className="aside">
          <p className="kicker">Ce urmează</p>
          <ol className="next">
            <li>
              <b>Contul</b>
              <span>Numele și telefonul. 30 de secunde.</span>
            </li>
            <li>
              <b>Conectezi Facebook sau TikTok</b>
              <span>Un buton, fără parole.</span>
            </li>
            <li>
              <b>Faci campania</b>
              <span>Vezi reclama exact cum apare.</span>
            </li>
            <li className="key">
              <b>Plătești 495 lei</b>
              <span>Abia acum, după ce ai văzut-o gata.</span>
            </li>
            <li>
              <b>Activezi WhatsApp</b>
              <span>Aici îți vin clienții.</span>
            </li>
          </ol>
          <div className="quote">
            „Dacă te blochezi undeva, îmi scrii direct pe WhatsApp și te ajut eu.”
            <span>— Daniel, fondatorul AdPilot</span>
          </div>
        </aside>
      </div>
    </FlowShell>
  );
}
