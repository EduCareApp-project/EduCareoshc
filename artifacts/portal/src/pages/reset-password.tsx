import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const organisationCode = new URLSearchParams(window.location.search).get("organisationCode");
  const companyQuery = organisationCode ? `?organisationCode=${encodeURIComponent(organisationCode)}` : "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #1a4731 0%, #2d6a4f 50%, #1b5e20 100%)" }}>
        <div className="flex items-center gap-3 px-8 py-5">
          <img src="/educare-logo.png" alt="EduCare" className="h-12 w-12 object-contain" />
          <span className="text-2xl font-bold text-white tracking-tight">EduCare</span>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #4CAF50, #2196F3, #F44336, #FF9800)" }} />
            <div className="px-8 py-8 text-center">
              <p className="text-sm text-muted-foreground mb-4">This reset link is invalid or has expired.</p>
              <Link href={`/forgot-password${companyQuery}`}>
                <Button className="w-full">Request a new link</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #1a4731 0%, #2d6a4f 50%, #1b5e20 100%)" }}>
      <div className="flex items-center gap-3 px-8 py-5">
        <img src="/educare-logo.png" alt="EduCare" className="h-12 w-12 object-contain" />
        <span className="text-2xl font-bold text-white tracking-tight">EduCare</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #4CAF50, #2196F3, #F44336, #FF9800)" }} />

            <div className="px-8 py-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-xl p-2.5 bg-primary/10">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground leading-tight">Set a new password</h1>
                  <p className="text-sm text-muted-foreground">Choose a strong password</p>
                </div>
              </div>

              {success ? (
                <div className="text-center py-4">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  </div>
                  <h2 className="text-base font-semibold text-foreground mb-2">Password updated</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Your password has been changed. You can now sign in with your new password.
                  </p>
                  <Link href={`/login${companyQuery}`}>
                    <Button className="w-full">Sign in</Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm">Confirm new password</Label>
                    <Input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
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
                    className="w-full h-10"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating…</>
                    ) : "Update password"}
                  </Button>

                  <Link href={`/login${companyQuery}`}>
                    <Button variant="ghost" className="w-full h-10 mt-1" type="button">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to sign in
                    </Button>
                  </Link>
                </form>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-white/60">
            Education & Care Portal · National Quality Framework
          </p>
        </div>
      </div>
    </div>
  );
}
