import { useState } from "react";
import { Quote } from "lucide-react";
import { Stars } from "@/components/ui/Stars";
import { useProducts } from "@/contexts/ProductsContext";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// Só aparece se houver depoimentos PUBLICADOS no banco. Nada é inventado.
export function ReviewsSection() {
  const { testimonials } = useProducts();
  const [reviewPage, setReviewPage] = useState(0);

  if (testimonials.length === 0) return null;

  const reviewsPerPage = 3;
  const totalReviewPages = Math.ceil(testimonials.length / reviewsPerPage);
  const visibleReviews = testimonials.slice(reviewPage * reviewsPerPage, reviewPage * reviewsPerPage + reviewsPerPage);
  const mobileReview = testimonials[reviewPage % testimonials.length];

  return (
      <section className="py-16 px-4" style={{ background: "#27408A" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-accent text-xs font-black uppercase tracking-widest mb-2">💬 Depoimentos</p>
            <h2 className="text-white font-black text-2xl sm:text-3xl" style={{ fontFamily: "'Baloo 2', cursive" }}>
              O que nossos clientes dizem
            </h2>
            <p className="text-white/60 text-sm mt-2">Revendedores que confiam na D'mais todos os meses</p>
          </div>

          {/* Reviews grid — 3 cards desktop, scroll mobile */}
          <div className="hidden sm:grid grid-cols-3 gap-5">
            {visibleReviews.map((review) => (
              <div key={review.id} className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-5 flex flex-col gap-3">
                <Quote size={20} className="text-accent opacity-70" />
                <p className="text-white/85 text-sm leading-relaxed flex-1">"{review.text}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                  <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-accent font-black text-sm">{review.avatar ?? initialsOf(review.name)}</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{review.name}</p>
                    {review.city && <p className="text-white/50 text-xs">{review.city}</p>}
                    <Stars count={review.stars} size={11} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: single review with dots */}
          <div className="sm:hidden">
            <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-5 flex flex-col gap-3">
              <Quote size={20} className="text-accent opacity-70" />
              <p className="text-white/85 text-sm leading-relaxed">"{mobileReview.text}"</p>
              <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent font-black text-sm">{mobileReview.avatar ?? initialsOf(mobileReview.name)}</span>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{mobileReview.name}</p>
                  {mobileReview.city && <p className="text-white/50 text-xs">{mobileReview.city}</p>}
                  <Stars count={mobileReview.stars} size={11} />
                </div>
              </div>
            </div>
          </div>

          {/* Pagination dots */}
          {totalReviewPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button onClick={() => setReviewPage((p) => Math.max(0, p - 1))} disabled={reviewPage === 0}
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/50 disabled:opacity-30 transition-all">
                ←
              </button>
              {Array.from({ length: totalReviewPages }).map((_, i) => (
                <button key={i} onClick={() => setReviewPage(i)} aria-label={`Página ${i + 1}`}
                  className="w-2.5 h-2.5 rounded-full transition-all"
                  style={{ background: i === reviewPage ? "#F97316" : "rgba(255,255,255,0.25)" }} />
              ))}
              <button onClick={() => setReviewPage((p) => Math.min(totalReviewPages - 1, p + 1))} disabled={reviewPage === totalReviewPages - 1}
                className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/50 disabled:opacity-30 transition-all">
                →
              </button>
            </div>
          )}
        </div>
      </section>
  );
}
