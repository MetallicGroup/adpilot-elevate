import logoAsset from "@/assets/adpilot-logo.png.asset.json";

export function Logo({ className = "h-8 w-8", showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img src={logoAsset.url} alt="AdPilot" className={`${className} object-contain`} />
      {showWordmark && <span className="font-semibold tracking-tight">AdPilot</span>}
    </div>
  );
}