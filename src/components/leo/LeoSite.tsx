import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";
import { Experience } from "./Experience";
import { scrollState } from "./scrollState";
import type { Colorway } from "./Shoe";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const SECTIONS = [
  { id: "hero", kicker: "01 — Reveal", title: "LEO FOOTWEAR", sub: "Future Starts From Your Feet." },
  { id: "exploded", kicker: "02 — Architecture", title: "Engineered in Layers", sub: "Every component, deconstructed." },
  { id: "materials", kicker: "03 — Materials", title: "Touch the Detail", sub: "Premium fabrics. Surgical stitching." },
  { id: "performance", kicker: "04 — Performance", title: "Built for Velocity", sub: "Energy return, redefined." },
  { id: "colorways", kicker: "05 — Colorways", title: "Choose Your Signal", sub: "Four editions. One silhouette." },
  { id: "orbit", kicker: "06 — 360°", title: "Inspect Everything", sub: "From every angle, in full fidelity." },
  { id: "technology", kicker: "07 — Inside", title: "The Engine Within", sub: "Inside the LEO performance core." },
  { id: "finale", kicker: "08 — Available Now", title: "LEO FOOTWEAR", sub: "Shop the future." },
];

const COLORWAYS: { id: Colorway; label: string; swatch: string }[] = [
  { id: "white", label: "White Edition", swatch: "#f5f5f5" },
  { id: "grey", label: "Grey Edition", swatch: "#6b7280" },
  { id: "red", label: "Red Edition", swatch: "#dc2626" },
  { id: "volt", label: "Volt Edition", swatch: "#d4ff00" },
];

export function LeoSite() {
  const wrap = useRef<HTMLDivElement>(null);
  const [activeColor, setActiveColor] = useState<Colorway>("white");

  useEffect(() => {
    if (!wrap.current) return;
    const ctx = gsap.context(() => {
      const sections = gsap.utils.toArray<HTMLElement>(".leo-section");
      const total = sections.length;

      ScrollTrigger.create({
        trigger: wrap.current!,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          scrollState.progress = self.progress;
        },
      });

      sections.forEach((sec, i) => {
        ScrollTrigger.create({
          trigger: sec,
          start: "top center",
          end: "bottom center",
          onToggle: (self) => {
            if (self.isActive) scrollState.section = i;
          },
        });
        // Explode driven by section scroll for both architecture and materials
        if (sec.dataset.section === "exploded" || sec.dataset.section === "materials") {
          ScrollTrigger.create({
            trigger: sec,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
            onUpdate: (self) => {
              // ease in then hold then ease out so parts are fully separated mid-section
              const p = self.progress;
              const eased = p < 0.5 ? p * 2 : (1 - p) * 2;
              scrollState.explode = Math.min(1, Math.max(0, eased));
            },
          });
        } else {
          // ensure explode collapses back outside these sections
          ScrollTrigger.create({
            trigger: sec,
            start: "top center",
            end: "bottom center",
            onEnter: () => { scrollState.explode = 0; },
            onEnterBack: () => { scrollState.explode = 0; },
          });
        }
      });

      void total;
    }, wrap);
    return () => ctx.revert();
  }, []);

  const pickColor = (c: Colorway) => {
    setActiveColor(c);
    scrollState.colorway = c;
  };

  return (
    <div ref={wrap} className="relative bg-[#06070a] text-white">
      {/* Fixed 3D canvas */}
      <div className="fixed inset-0 z-0">
        <Experience />
      </div>

      {/* Top nav */}
      <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-5 md:px-10">
        <div className="text-xs tracking-[0.35em] font-medium">LEO</div>
        <nav className="hidden md:flex gap-8 text-[11px] tracking-[0.25em] text-white/60">
          <a href="#exploded" className="hover:text-white transition">ARCHITECTURE</a>
          <a href="#materials" className="hover:text-white transition">MATERIALS</a>
          <a href="#colorways" className="hover:text-white transition">EDITIONS</a>
          <a href="#finale" className="hover:text-white transition">SHOP</a>
        </nav>
        <div className="text-[11px] tracking-[0.25em] text-white/60">FW / 26</div>
      </header>

      {/* Scroll progress bar */}
      <div className="fixed left-6 top-1/2 z-30 hidden md:block -translate-y-1/2">
        <div className="h-40 w-px bg-white/15 relative overflow-hidden">
          <div id="leo-progress" className="absolute top-0 left-0 w-full bg-white h-0" />
        </div>
      </div>

      {/* Sections */}
      <main className="relative z-10">
        {SECTIONS.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            data-section={s.id}
            className="leo-section relative min-h-screen flex items-center"
            style={{ height: s.id === "exploded" ? "180vh" : "100vh" }}
          >
            <div className="w-full px-6 md:px-16">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.4 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className={
                  s.id === "hero"
                    ? "max-w-sm pt-28 md:pt-36 text-left"
                    : s.id === "finale"
                    ? "max-w-lg ml-auto text-right"
                    : i % 2 === 0
                    ? "max-w-xl"
                    : "max-w-xl ml-auto text-right"
                }
              >
                <div className="text-[11px] tracking-[0.4em] text-white/50 mb-6">{s.kicker}</div>
                <h2
                  className={
                    s.id === "hero"
                      ? "text-4xl md:text-6xl font-black tracking-tight leading-none"
                      : s.id === "finale"
                      ? "text-5xl md:text-7xl font-black tracking-tight leading-none"
                      : "text-4xl md:text-6xl font-bold tracking-tight leading-tight"
                  }
                >
                  {s.title}
                </h2>
                <p className="mt-6 text-base md:text-lg text-white/70 max-w-md mx-auto">
                  {s.sub}
                </p>

                {s.id === "hero" && (
                  <div className="mt-12 text-[11px] tracking-[0.3em] text-white/40 animate-pulse">
                    SCROLL TO EXPERIENCE ↓
                  </div>
                )}

                {s.id === "colorways" && (
                  <div className="mt-10 flex gap-3 justify-end">
                    {COLORWAYS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => pickColor(c.id)}
                        className={`group flex flex-col items-center gap-2 ${
                          activeColor === c.id ? "opacity-100" : "opacity-50 hover:opacity-100"
                        } transition`}
                      >
                        <span
                          className="block w-10 h-10 rounded-full border border-white/30"
                          style={{ background: c.swatch }}
                        />
                        <span className="text-[10px] tracking-[0.2em]">{c.label.split(" ")[0].toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                )}

                {s.id === "technology" && (
                  <ul className="mt-8 space-y-2 text-sm text-white/60">
                    <li>— Carbon energy plate</li>
                    <li>— Adaptive foam core</li>
                    <li>— Reinforced heel cradle</li>
                  </ul>
                )}

                {s.id === "finale" && (
                  <button className="mt-12 inline-flex items-center gap-3 bg-white text-black px-10 py-4 text-sm tracking-[0.3em] font-medium hover:bg-white/90 transition">
                    SHOP NOW →
                  </button>
                )}
              </motion.div>
            </div>

            {/* Section index */}
            <div className="absolute right-6 bottom-8 text-[10px] tracking-[0.3em] text-white/30">
              0{i + 1} / 0{SECTIONS.length}
            </div>
          </section>
        ))}
      </main>

      {/* Bottom gradient on finale for extra drama */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#06070a] to-transparent z-20" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-32 bg-gradient-to-b from-[#06070a] to-transparent z-20" />
    </div>
  );
}
