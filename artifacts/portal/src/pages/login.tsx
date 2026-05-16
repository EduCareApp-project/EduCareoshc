import { useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";

export default function Login() {
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed. Please try again.");
      } else {
        setUser(data.user);
        window.location.href = "/";
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "linear-gradient(135deg, #1a4731 0%, #2d6a4f 50%, #1b5e20 100%)" }}>
      {/* Logo + branding above card */}
      <div className="flex items-center gap-4 mb-8">
        <img src="/educare-logo.png" alt="EduCare" className="h-16 w-16 object-contain drop-shadow-lg" />
        <span className="text-4xl font-bold text-white tracking-tight drop-shadow">EduCare</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Card header strip */}
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #4CAF50, #2196F3, #F44336, #FF9800)" }} />

            <div className="px-8 py-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-xl p-2.5 bg-primary/10">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground leading-tight">Welcome back</h1>
                  <p className="text-sm text-muted-foreground">Sign in to your portal</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="h-10"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-10 mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</>
                  ) : "Sign in"}
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                If you can't access your account, contact your service administrator.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-white/60">
            National Quality Framework
          </p>
        </div>
    </div>
  );
}
