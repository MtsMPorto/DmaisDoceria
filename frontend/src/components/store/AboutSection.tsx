export function AboutSection() {
  return (
      <section className="py-16 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-accent text-xs font-black uppercase tracking-widest mb-2">📖 Conheça a D'mais</p>
            <h2 className="text-primary font-black text-2xl sm:text-3xl" style={{ fontFamily: "'Baloo 2', cursive" }}>
              Nossa história, nosso propósito
            </h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-xl mx-auto">Entenda quem somos, por que escolher a gente e como chegamos até você.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                img: "https://images.unsplash.com/photo-1534119428213-bd2626145164?w=600&h=400&fit=crop&auto=format",
                tag: "Nossa História",
                title: "O início dessa paixão",
                body: "A D'mais nasceu do sonho de Dionatan, que desde criança aprendeu com o pai a importância da simplicidade, do carisma e da qualidade. Percebendo a necessidade de um atendimento humano e eficiente, a empresa surgiu com um propósito claro: entregar o melhor em produtos e atendimento.",
                color: "#27408A",
              },
              {
                img: "https://images.unsplash.com/photo-1519087318609-bfb5c04c27f5?w=600&h=400&fit=crop&auto=format",
                tag: "Por que nos escolher",
                title: "Qualidade, variedade e preço de atacado",
                body: "A simplicidade, carisma e qualidade se conectam ao escolher a D'mais. Você nos escolhe por sabedoria, qualidade e amor pelo que fazemos. Você nos escolhe pelo nosso atendimento, rapidez, agilidade e confiança. Nada e ninguém supera quem decide fazer o melhor.",
                color: "#E42457",
              },
              {
                img: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&h=400&fit=crop&auto=format",
                tag: "Por que criamos o site",
                title: "Facilitar sua vida na hora de comprar",
                body: "Criamos este site para que você possa conhecer nosso catálogo completo a qualquer hora, de qualquer lugar, sem precisar ligar ou esperar resposta. Aqui você monta seu pedido com calma, escolhe os produtos e finaliza pelo WhatsApp em segundos.",
                color: "#1a9e5c",
              },
            ].map((card, i) => (
              <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col">
                {/* Image */}
                <div className="relative h-48 overflow-hidden flex-shrink-0">
                  <img src={card.img} alt={card.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 60%)" }} />
                  <span className="absolute bottom-3 left-4 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ background: card.color }}>
                    {card.tag}
                  </span>
                </div>
                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-primary font-black text-base leading-snug mb-2" style={{ fontFamily: "'Baloo 2', cursive" }}>
                    {card.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed flex-1">{card.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
  );
}
