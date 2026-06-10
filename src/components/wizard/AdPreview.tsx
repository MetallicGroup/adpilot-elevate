import { Facebook, MoreHorizontal, ThumbsUp, MessageCircle, Share2 } from "lucide-react";

type Props = {
  pageName: string;
  headline: string;
  description: string;
  cta: string;
  mediaUrl: string;
  landingUrl: string;
};

/** Facebook-feed style mockup of how the ad will appear. */
export function AdPreview({ pageName, headline, description, cta, mediaUrl, landingUrl }: Props) {
  let host = "";
  try { host = landingUrl ? new URL(landingUrl).hostname.replace(/^www\./, "") : ""; } catch {}
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 p-3">
        <div className="w-10 h-10 rounded-full bg-[#1877F2] text-white flex items-center justify-center">
          <Facebook className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate">{pageName || "Your Page"}</div>
          <div className="text-[11px] text-muted-foreground">Sponsored · 🌐</div>
        </div>
        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
      </div>
      {description && (
        <div className="px-3 pb-3 text-[13px] text-foreground whitespace-pre-wrap">{description}</div>
      )}
      <div className="bg-muted aspect-square w-full overflow-hidden">
        {mediaUrl ? (
          <img src={mediaUrl} alt="Ad creative" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            Upload an image to see it here
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-3 py-3 bg-secondary/50">
        <div className="min-w-0">
          {host && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{host}</div>}
          <div className="text-[14px] font-semibold leading-snug truncate">{headline || "Your headline"}</div>
        </div>
        <button className="shrink-0 px-3 py-1.5 rounded-md bg-foreground text-background text-[12px] font-medium">
          {cta || "Learn More"}
        </button>
      </div>
      <div className="flex items-center justify-around px-3 py-2 text-[12px] text-muted-foreground border-t border-border">
        <span className="flex items-center gap-1.5"><ThumbsUp className="w-3.5 h-3.5" /> Like</span>
        <span className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Comment</span>
        <span className="flex items-center gap-1.5"><Share2 className="w-3.5 h-3.5" /> Share</span>
      </div>
    </div>
  );
}