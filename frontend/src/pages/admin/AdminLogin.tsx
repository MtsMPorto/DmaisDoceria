import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, ShieldCheck, Lock, User, ArrowLeft } from "lucide-react";
import logoImg from "@/assets/images/Logo_Doces-removebg-preview__1_.png";
import { CONNECTION_ERROR_MESSAGE, isAuthenticated, login } from "@/services/authService";

const REASON_MESSAGES: Record<string, string> = {
  sessao: "Sua sessão expirou ou é inválida. Entre novamente.",
  conexao: CONNECTION_ERROR_MESSAGE,
};

export default function AdminLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("motivo");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [credError, setCredError] = useState(reason ? (REASON_MESSAGES[reason] ?? "") : "");
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    // Com "motivo" na URL o painel acabou de recusar a sessão: não volta sozinho (evita laço).
    if (!reason && isAuthenticated()) {
      navigate("/admin/panel", { replace: true });
    }
  }, [navigate, reason]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setCredError("");
    try {
      await login(username, password);
      navigate("/admin/panel", { replace: true });
    } catch (err) {
      setCredError(err instanceof Error ? err.message : "Não foi possível conectar ao servidor. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center px-4" style={{ fontFamily: "'Nunito', sans-serif" }}>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none opacity-[0.04]">
        {["🍬","🍭","🍫","🍡","🍪","🧁"].map((e, i) => (
          <span key={i} className="absolute text-8xl" style={{ top: `${15 + i * 14}%`, left: `${5 + (i % 3) * 35}%` }}>{e}</span>
        ))}
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={logoImg} alt="D'mais" className="w-24 h-24 object-contain drop-shadow-xl mb-3" />
          <p className="text-white font-black text-2xl" style={{ fontFamily: "'Baloo 2', cursive" }}>D'mais Admin</p>
          <p className="text-white/50 text-sm">Painel de Administração</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Credentials */}
            <form onSubmit={handleCredentials} className="p-6 space-y-4">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <Lock size={22} className="text-primary" />
                </div>
                <h2 className="text-primary font-black text-lg">Acesso Restrito</h2>
                <p className="text-muted-foreground text-xs mt-1">Entre com suas credenciais de administrador</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-primary font-bold text-xs mb-1">Usuário</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" placeholder="Seu usuário" value={username} onChange={(e) => { setUsername(e.target.value); setCredError(""); }}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-border focus:border-primary outline-none text-sm bg-background transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-primary font-bold text-xs mb-1">Senha</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type={showPass ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => { setPassword(e.target.value); setCredError(""); }}
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl border-2 border-border focus:border-primary outline-none text-sm bg-background transition-colors" />
                    <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {credError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-red-500 text-sm">⚠️</span>
                  <p className="text-red-600 text-xs font-semibold">{credError}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/30">
                <ShieldCheck size={16} /> {loading ? "Entrando..." : "Entrar"}
              </button>

              <div className="text-center pt-1">
                <a href="/" className="text-muted-foreground text-xs hover:text-primary transition-colors flex items-center justify-center gap-1">
                  <ArrowLeft size={12} /> Voltar para a loja
                </a>
              </div>

            </form>
        </div>
      </div>
    </div>
  );
}
