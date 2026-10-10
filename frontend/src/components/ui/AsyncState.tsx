import type { ReactNode } from "react";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";

export function LoadingBox({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm font-semibold">
      <Loader2 size={18} className="animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-10 px-4">
      <AlertTriangle size={28} className="mx-auto mb-2 text-amber-500" />
      <p className="text-primary font-bold text-sm mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors"
        >
          <RotateCw size={14} /> Tentar de novo
        </button>
      )}
    </div>
  );
}

// Mostra carregamento ou erro (com "Tentar de novo") e só então o conteúdo.
export function AsyncBoundary({
  loading,
  error,
  onRetry,
  hasData,
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  hasData: boolean;
  children: ReactNode;
}) {
  if (error && !hasData) return <ErrorBox message={error} onRetry={onRetry} />;
  if (loading && !hasData) return <LoadingBox />;
  return <>{children}</>;
}
