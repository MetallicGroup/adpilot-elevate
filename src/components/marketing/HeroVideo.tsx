import { useRef, useState } from "react";
import { Play } from "lucide-react";

/**
 * Cardul cu clipul demo din hero. NU pornește singur — se vede posterul + butonul
 * de play; la click pornește INSTANT cu sunet (cerință). Când e pe pauză, reapare
 * overlay-ul; în timpul redării apar controalele native (volum, scrub).
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function play() {
    const v = ref.current;
    if (!v) return;
    v.muted = false; // sunet pornit la click
    v.volume = 1;
    const p = v.play();
    if (p && p.catch) {
      p.catch(() => {
        // dacă browserul refuză redarea cu sunet, pornim măcar mut
        v.muted = true;
        void v.play();
      });
    }
  }

  return (
    <div className="mt-8 w-full max-w-xl mx-auto md:mx-0">
      <div className="relative rounded-[20px] p-3.5 border border-white/[0.12] bg-gradient-to-br from-primary/10 to-fuchsia-500/[0.04] shadow-2xl">
        <div className="flex items-center gap-2 px-1 pb-2.5 text-sm font-semibold text-foreground">
          <span aria-hidden>🎥</span> Vezi cum funcționează AdPilot
        </div>
        <div className="relative rounded-[14px] overflow-hidden aspect-video bg-black border border-white/[0.08]">
          <video
            ref={ref}
            className="w-full h-full object-cover"
            playsInline
            preload="metadata"
            poster="/hero-demo-poster.jpg"
            controls={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              if (ref.current) ref.current.currentTime = 0;
              setPlaying(false);
            }}
          >
            <source src="/hero-demo.mp4" type="video/mp4" />
          </video>

          {!playing && (
            <button
              type="button"
              onClick={play}
              aria-label="Redă clipul demo"
              className="group absolute inset-0 grid place-items-center bg-black/25 transition-colors hover:bg-black/20"
            >
              <span className="grid h-[70px] w-[70px] place-items-center rounded-full border border-white/40 bg-black/40 backdrop-blur-sm shadow-2xl transition-transform group-hover:scale-105">
                <Play className="ml-1 h-7 w-7 fill-white text-white" />
              </span>
              <span className="absolute bottom-3 left-4 text-[13px] font-semibold text-white/90 drop-shadow">
                Demo rapid
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
