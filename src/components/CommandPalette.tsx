import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Home, Plus, Inbox, MessageCircle, Settings, BarChart3, Sparkles, Rocket, Search } from "lucide-react";

type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const CmdCtx = (() => {
  let listeners = new Set<() => void>();
  let state = false;
  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); },
    get() { return state; },
    set(v: boolean) { state = v; listeners.forEach((l) => l()); },
  };
})();

export function openCommandPalette() { CmdCtx.set(true); }

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(CmdCtx.get());

  useEffect(() => {
    const unsub = CmdCtx.subscribe(() => setOpen(CmdCtx.get()));
    return () => { unsub(); };
  }, []);
  useEffect(() => { CmdCtx.set(open); }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    setTimeout(() => navigate({ to }), 80);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Caută rapid: campanie, lead, comandă…" />
      <CommandList>
        <CommandEmpty>Niciun rezultat. Încearcă altă căutare.</CommandEmpty>
        <CommandGroup heading="Navigare">
          <CommandItem onSelect={() => go("/dashboard")}><Home className="mr-2 h-4 w-4" /> Dashboard <span className="ml-auto text-xs text-muted-foreground">G D</span></CommandItem>
          <CommandItem onSelect={() => go("/leads")}><Inbox className="mr-2 h-4 w-4" /> Lead-uri <span className="ml-auto text-xs text-muted-foreground">G L</span></CommandItem>
          <CommandItem onSelect={() => go("/whatsapp")}><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp <span className="ml-auto text-xs text-muted-foreground">G W</span></CommandItem>
          <CommandItem onSelect={() => go("/reports")}><BarChart3 className="mr-2 h-4 w-4" /> Rapoarte</CommandItem>
          <CommandItem onSelect={() => go("/settings")}><Settings className="mr-2 h-4 w-4" /> Setări</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Acțiuni">
          <CommandItem onSelect={() => go("/create")}><Plus className="mr-2 h-4 w-4" /> Creează campanie nouă <span className="ml-auto text-xs text-muted-foreground">N</span></CommandItem>
          <CommandItem onSelect={() => go("/leads")}><Sparkles className="mr-2 h-4 w-4" /> Vezi lead-uri noi</CommandItem>
          <CommandItem onSelect={() => go("/dashboard")}><Rocket className="mr-2 h-4 w-4" /> Performanță live</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tip-uri">
          <CommandItem disabled><Search className="mr-2 h-4 w-4" /> Apasă <kbd className="mx-1 px-1.5 py-0.5 rounded bg-muted text-[10px]">⌘K</kbd> oricând pentru a deschide</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}