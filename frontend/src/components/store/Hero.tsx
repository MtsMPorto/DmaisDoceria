export function Hero() {
  return (
      <section className="relative overflow-hidden" style={{ background: "#27408A" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 65% 55% at 50% 38%, rgba(255,255,255,0.06) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {[
            { top: "12%", left: "8%", s: 6 }, { top: "25%", left: "18%", s: 4 },
            { top: "8%",  left: "72%", s: 5 }, { top: "18%", left: "85%", s: 7 },
            { top: "40%", left: "92%", s: 4 }, { top: "55%", left: "4%",  s: 5 },
            { top: "30%", left: "48%", s: 3 }, { top: "15%", left: "55%", s: 4 },
          ].map((dot, i) => (
            <div key={i} className="absolute rounded-full bg-white/70 animate-pulse"
              style={{ top: dot.top, left: dot.left, width: dot.s, height: dot.s, animationDelay: `${i * 0.4}s` }} />
          ))}
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 pb-4" style={{ paddingTop: "calc(max(env(safe-area-inset-top, 0px), var(--sat-fallback, 0px)) + 6.5rem)" }}>
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
            <div className="absolute rounded-full blur-3xl" style={{ width: "clamp(140px,28vw,320px)", height: "clamp(140px,28vw,320px)", background: "#F97316", opacity: 0.18, top: "30%", left: "-6%" }} />
            <div className="absolute rounded-full blur-3xl" style={{ width: "clamp(120px,22vw,260px)", height: "clamp(120px,22vw,260px)", background: "#ec4899", opacity: 0.13, bottom: "15%", right: "-5%" }} />
            <div className="absolute rounded-full blur-2xl" style={{ width: "clamp(100px,16vw,200px)", height: "clamp(100px,16vw,200px)", background: "#facc15", opacity: 0.09, bottom: "8%", left: "35%" }} />
            <div className="sm:hidden">
              {[
                { emoji: "🍭", top: "38%", left: "2%",  size: 32, rotate: -15, opacity: 0.7 },
                { emoji: "🍬", top: "55%", left: "3%",  size: 26, rotate:  10, opacity: 0.55 },
                { emoji: "🍫", top: "38%", right: "2%", size: 30, rotate:  12, opacity: 0.7 },
                { emoji: "🍡", top: "56%", right: "3%", size: 28, rotate: -10, opacity: 0.55 },
                { emoji: "🧁", top: "72%", left: "6%",  size: 24, rotate:   8, opacity: 0.45 },
                { emoji: "🍪", top: "73%", right: "5%", size: 24, rotate: -12, opacity: 0.45 },
              ].map((c, i) => (
                <span key={i} className="absolute" style={{ top: c.top, left: (c as any).left, right: (c as any).right, fontSize: c.size, opacity: c.opacity, transform: `rotate(${c.rotate}deg)`, filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.3))" }}>{c.emoji}</span>
              ))}
            </div>
            <div className="hidden sm:block">
              {[
                { emoji: "🍭", top: "12%", left: "4%",  size: 44, rotate: -20, opacity: 0.8 },
                { emoji: "🍬", top: "28%", left: "7%",  size: 30, rotate:  14, opacity: 0.6 },
                { emoji: "🍫", top: "14%", left: "80%", size: 38, rotate: -10, opacity: 0.75 },
                { emoji: "🍭", top: "10%", left: "91%", size: 28, rotate:  18, opacity: 0.6 },
                { emoji: "🧁", top: "52%", left: "3%",  size: 34, rotate:  -8, opacity: 0.55 },
                { emoji: "🍡", top: "55%", left: "93%", size: 36, rotate:  10, opacity: 0.6 },
                { emoji: "🍬", top: "72%", left: "12%", size: 28, rotate:  22, opacity: 0.45 },
                { emoji: "🍪", top: "70%", left: "82%", size: 30, rotate: -14, opacity: 0.5 },
                { emoji: "🍭", top: "36%", left: "1%",  size: 22, rotate:   5, opacity: 0.4 },
                { emoji: "🍫", top: "40%", left: "96%", size: 24, rotate: -11, opacity: 0.4 },
              ].map((c, i) => (
                <span key={i} className="absolute" style={{ top: c.top, left: c.left, fontSize: c.size, opacity: c.opacity, transform: `rotate(${c.rotate}deg)`, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>{c.emoji}</span>
              ))}
              <div className="absolute rounded-full" style={{ width: 180, height: 180, border: "1.5px solid rgba(255,255,255,0.07)", top: "18%", right: "11%" }} />
              <div className="absolute rounded-full" style={{ width: 100, height: 100, border: "1.5px solid rgba(249,115,22,0.14)", top: "21%", right: "14%" }} />
              <div className="absolute rounded-full" style={{ width: 130, height: 130, border: "1.5px solid rgba(255,255,255,0.05)", bottom: "20%", left: "7%" }} />
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-5 shadow-lg"
            style={{ background: "rgba(249,115,22,0.18)", border: "1px solid rgba(249,115,22,0.45)", color: "#F97316" }}>
            🎉 Atacado &amp; Varejo — Compre pelo WhatsApp
          </span>
          <h1 className="text-white font-black leading-tight mb-4" style={{ fontFamily: "'Baloo 2', cursive", fontSize: "clamp(2rem, 5vw, 3.5rem)", textShadow: "0 2px 24px rgba(0,0,0,0.35)" }}>
            Os melhores doces<br />
            <span style={{ color: "#F97316" }}>direto na sua mão!</span>
          </h1>
          <p className="text-white/70 text-sm max-w-lg leading-relaxed mb-2">
            Catálogo completo de confeitos para revenda. Adicione ao carrinho, preencha seus dados e finalize pelo WhatsApp — simples e rápido!
          </p>
          <p className="text-accent font-black text-sm mb-7">Preços consultados diretamente pelo WhatsApp.</p>
          <button onClick={() => document.getElementById("mais-vendidos")?.scrollIntoView({ behavior: "smooth" })}
            className="font-black text-white px-8 py-3 rounded-full text-base shadow-xl transition-all active:scale-95 mb-4"
            style={{ background: "linear-gradient(135deg,#F97316,#f54e00)", boxShadow: "0 6px 28px rgba(249,115,22,0.45)" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "")}>
            Ver Catálogo →
          </button>
        </div>

        <div className="relative z-10 flex items-end justify-center gap-2 sm:gap-4 -mt-10 px-4 overflow-hidden" style={{ height: 130 }}>
          {[
            { src: "https://images.unsplash.com/photo-1515007917921-cad9bf0e2e87?w=160&h=220&fit=crop&auto=format", alt: "Pirulito", h: 120, rotate: -12 },
            { src: "https://images.unsplash.com/photo-1633158832466-be592c721217?w=160&h=200&fit=crop&auto=format", alt: "Balas", h: 105, rotate: -5 },
            { src: "https://images.unsplash.com/photo-1576712967455-c8d22580e9be?w=200&h=200&fit=crop&auto=format", alt: "Gomas", h: 130, rotate: 0 },
            { src: "https://images.unsplash.com/photo-1622873904690-76c655368668?w=160&h=200&fit=crop&auto=format", alt: "Chocolate", h: 110, rotate: 5 },
            { src: "https://images.unsplash.com/photo-1612262501903-1add4a20dc04?w=160&h=220&fit=crop&auto=format", alt: "Balas sortidas", h: 120, rotate: 12 },
          ].map((item, i) => (
            <img key={i} src={item.src} alt={item.alt}
              className="rounded-2xl object-cover shadow-2xl flex-shrink-0 hidden sm:block"
              style={{ height: item.h, width: item.h * 0.75, transform: `rotate(${item.rotate}deg)`, objectPosition: "center top", border: "2px solid rgba(255,255,255,0.15)", marginBottom: -(item.h * 0.3) }} />
          ))}
          <img src="https://images.unsplash.com/photo-1576712967455-c8d22580e9be?w=300&h=200&fit=crop&auto=format" alt="Doces"
            className="rounded-2xl object-cover shadow-2xl sm:hidden"
            style={{ height: 110, width: 200, border: "2px solid rgba(255,255,255,0.15)", marginBottom: -33 }} />
        </div>
      </section>
  );
}
