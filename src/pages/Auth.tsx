import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast({ title: "Login realizado com sucesso!" });
      } else {
        await signUp(email, password, fullName);
        toast({
          title: "Conta criada!",
          description: "Verifique seu email para confirmar o cadastro.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ─── Left panel — Branding ─── */}
      <div className="relative lg:w-[55%] flex items-center justify-center overflow-hidden bg-[#0a0a0a] min-h-[320px] lg:min-h-screen">
        {/* Animated background effects */}
        <div className="absolute inset-0">
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }} />

          {/* Animated gold orbs */}
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-[0.07] blur-[100px] animate-[float_8s_ease-in-out_infinite]"
            style={{ background: 'radial-gradient(circle, #d4a017, transparent 70%)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[80px] animate-[float_10s_ease-in-out_infinite_reverse]"
            style={{ background: 'radial-gradient(circle, #c49000, transparent 70%)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] blur-[120px] animate-[pulse_6s_ease-in-out_infinite]"
            style={{ background: 'radial-gradient(circle, #e8b800, transparent 60%)' }} />

          {/* Decorative lines */}
          <div className="absolute top-0 left-[20%] w-px h-full bg-gradient-to-b from-transparent via-amber-500/10 to-transparent" />
          <div className="absolute top-0 right-[30%] w-px h-full bg-gradient-to-b from-transparent via-amber-500/5 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center px-8 lg:px-16 max-w-lg py-12 lg:py-0">
          {/* Logo with glow + pulse */}
          <div className="relative inline-block mb-8">
            <div className="absolute inset-0 scale-150 blur-3xl opacity-30 animate-[pulse_3s_ease-in-out_infinite]"
              style={{ background: 'radial-gradient(circle, #d4a017, transparent 70%)' }} />
            <img
              src="/logo-jg.png"
              alt="JG Logo"
              className="relative w-28 h-28 lg:w-44 lg:h-44 object-contain drop-shadow-[0_0_40px_rgba(212,160,23,0.3)] animate-[logoPulse_4s_ease-in-out_infinite]"
            />
          </div>

          <h1 className="text-3xl lg:text-5xl font-black text-white tracking-tight mb-2">
            Joni Gontijo
          </h1>
          <p className="text-sm lg:text-base text-amber-500/60 font-semibold tracking-[0.3em] uppercase mb-8">
            Gestão & Tráfego Pago
          </p>

          {/* Animated divider */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-amber-500/40" />
            <div className="w-2 h-2 rounded-full bg-amber-500/50 animate-[pulse_2s_ease-in-out_infinite]" />
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-amber-500/40" />
          </div>

          <p className="text-white/30 text-sm lg:text-base leading-relaxed max-w-sm mx-auto hidden lg:block">
            Sistema completo de propostas comerciais.
            Crie, gerencie e acompanhe suas propostas com eficiência profissional.
          </p>

          {/* Stats badges — desktop only */}
          <div className="hidden lg:flex items-center justify-center gap-6 mt-12">
            {[
              { label: "Propostas", icon: "📄" },
              { label: "Kanban", icon: "📊" },
              { label: "PDF Pro", icon: "📑" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-sm">
                <span className="text-sm">{item.icon}</span>
                <span className="text-xs text-white/40 font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Right panel — Login Form ─── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-gradient-to-br from-neutral-50 to-neutral-100 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-amber-100/30 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full bg-amber-50/40 blur-[80px]" />

        <div className="w-full max-w-[400px] lg:max-w-[460px] relative z-10">
          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-neutral-100 p-8 lg:p-12">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl lg:text-[2rem] font-extrabold text-neutral-900 tracking-tight">
                {isLogin ? "Bem-vindo" : "Criar conta"}
              </h2>
              <p className="text-neutral-400 mt-2 text-sm">
                {isLogin ? "Acesse o painel de propostas" : "Junte-se à equipe JG"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                    Nome completo
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    required={!isLogin}
                    className="h-12 bg-neutral-50 border-neutral-200 rounded-xl focus:border-amber-400 focus:ring-amber-400/20 transition-all placeholder:text-neutral-300"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="h-12 bg-neutral-50 border-neutral-200 rounded-xl focus:border-amber-400 focus:ring-amber-400/20 transition-all placeholder:text-neutral-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="h-12 bg-neutral-50 border-neutral-200 rounded-xl focus:border-amber-400 focus:ring-amber-400/20 transition-all pr-11 placeholder:text-neutral-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl font-bold text-sm tracking-wide gold-gradient text-white shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 border-0 group"
                disabled={loading}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Entrar" : "Criar conta"}
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-neutral-100" />
              <span className="text-[11px] text-neutral-300 uppercase tracking-wider">ou</span>
              <div className="flex-1 h-px bg-neutral-100" />
            </div>

            {/* Toggle */}
            <button
              type="button"
              className="w-full text-center text-sm text-neutral-500 hover:text-neutral-700 transition-colors py-2"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Não tem conta? " : "Já tem conta? "}
              <span className="font-bold text-amber-600 hover:text-amber-700">
                {isLogin ? "Cadastre-se" : "Faça login"}
              </span>
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-[11px] text-neutral-300 mt-6 tracking-wide">
            © {new Date().getFullYear()} Joni Gontijo — Gestão & Tráfego Pago
          </p>
        </div>
      </div>

      {/* ─── Global keyframe animations ─── */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes logoPulse {
          0%, 100% { 
            transform: scale(1);
            filter: drop-shadow(0 0 30px rgba(212,160,23,0.2));
          }
          50% { 
            transform: scale(1.04);
            filter: drop-shadow(0 0 50px rgba(212,160,23,0.4));
          }
        }
      `}</style>
    </div>
  );
}
