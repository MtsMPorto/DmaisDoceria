import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-3xl" : "max-w-xl"} bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col`}>
        <div className="bg-primary px-5 py-4 flex items-start justify-between flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-white font-black text-base leading-tight" style={{ fontFamily: "'Baloo 2', cursive" }}>{title}</h2>
            {subtitle && <div className="text-white/60 text-xs mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white flex-shrink-0 ml-3" aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-border flex gap-3 flex-shrink-0 flex-wrap">{footer}</div>}
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-red-600 text-sm font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">{message}</p>;
}
