import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [organisationCode, setOrganisationCode] = useState(new URLSearchParams(window.location.search).get("organisationCode") ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, organisationCode: organisationCode.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
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
                  <h1 className="text-xl font-bold text-foreground leading-tight">Reset your password</h1>
                  <p className="text-sm text-muted-foreground">We'll email you a reset link</p>
                </div>
              </div>

              {submitted ? (
                <div className="text-center py-4">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                    <Mail className="h-7 w-7 text-green-600" />
                  </div>
                  <h2 className="text-base font-semibold text-foreground mb-2">Check your email</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly. The link expires after 4 hours.
                  </p>
                  <Link href="/login">
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to sign in
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-sm text-muted-foreground -mt-2 mb-4">
                    Enter the email address associated with your account and we'll send you a link to reset your password.
                  </p>

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
                    <Label htmlFor="organisation-code">Organisation code (if supplied)</Label>
                    <Input id="organisation-code" value={organisationCode} onChange={(e) => setOrganisationCode(e.target.value)}
                      autoComplete="organization" className="h-10" />
                    <p className="text-xs text-muted-foreground">Required if you have accounts with more than one company.</p>
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
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
                    ) : "Send reset link"}
                  </Button>

                  <Link href="/login">
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
