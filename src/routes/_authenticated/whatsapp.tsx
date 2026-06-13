import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageCircle, Sparkles, Zap, Bell } from "lucide-react";
import { WhatsAppConnectionCard } from "@/components/whatsapp/WhatsAppConnectionCard";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  component: WhatsAppPage,
});

function WhatsAppPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-md mx-auto px-5 pt-10 pb-24 space-y-6"
    >
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#25D366]/10 border border-[#25D366]/20 text-[11px] font-medium text-[#25D366]">
          <MessageCircle className="w-3 h-3" /> WhatsApp Business
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Asistentul tău <span className="gradient-text">pe WhatsApp</span> 💬
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Controlează-ți campaniile, primește lead-uri și rapoarte — direct în chat. Fără să mai deschizi aplicația.
        </p>
      </div>

      <WhatsAppConnectionCard />

      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Ce poți face ✨</h2>
        <FeatureRow
          icon={<Bell className="w-4 h-4" />}
          title="Lead-uri instant"
          desc="Fiecare contact nou ajunge la tine în secunde, cu nume, telefon și sursa."
        />
        <FeatureRow
          icon={<Sparkles className="w-4 h-4" />}
          title="Comenzi AI 🤖"
          desc={'„cât am cheltuit săptămâna asta?", „pauză campania X", „arată-mi top lead-uri".'}
        />
        <FeatureRow
          icon={<Zap className="w-4 h-4" />}
          title="Lansează campanii din chat"
          desc="Trimite o poză + descriere și AdPilot creează draft-ul. Tu doar aprobi."
        />
      </div>
    </motion.div>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card-floating p-4 flex items-start gap-3">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      <div className="min-w-0">
        <p className="font-semibold text-sm">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}