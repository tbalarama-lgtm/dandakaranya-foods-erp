"use client";

import { Suspense, useEffect, useId, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  HelpCircle,
  Loader2,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { BrandLogoImage } from "@/components/brand/brand-logo-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { cn } from "@/lib/utils";

const REMEMBER_KEY = "dandakaranya-erp-remember-email";
const ERP_VERSION = "1.0.0";

type AuthStep = "credentials" | "mfa";

function LoginFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const emailFromQuery = params.get("email") ?? "";
  const authError = params.get("error");
  const emailId = useId();
  const passwordId = useId();
  const rememberId = useId();
  const mfaId = useId();

  const [authStep, setAuthStep] = useState<AuthStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; mfa?: string }>({});
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    } else if (emailFromQuery) {
      setEmail(emailFromQuery);
    }
  }, [emailFromQuery]);

  useEffect(() => {
    if (authError) {
      setError(
        authError === "CredentialsSignin"
          ? "Invalid email or password. Please try again."
          : "Sign in failed. Please try again.",
      );
      setShake(true);
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [authError]);

  const validateCredentials = () => {
    const next: typeof fieldErrors = {};
    if (!email.trim()) next.email = "Work email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return false;
    }
    return true;
  };

  const completeLogin = async () => {
    if (rememberMe) localStorage.setItem(REMEMBER_KEY, email.trim());
    else localStorage.removeItem(REMEMBER_KEY);
    router.push(callbackUrl);
    router.refresh();
  };

  const onSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateCredentials()) return;

    setLoading(true);
    const res = await signIn("credentials", { email: email.trim(), password, redirect: false });
    setLoading(false);

    if (res?.error) {
      setError("Invalid email or password. Please try again.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    // MFA-ready: when backend returns mfaRequired, switch step instead of redirecting
    const mfaEnabled = process.env.NEXT_PUBLIC_ERP_MFA_ENABLED === "true";
    if (mfaEnabled) {
      setAuthStep("mfa");
      return;
    }

    await completeLogin();
  };

  const onSubmitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mfaCode.trim().length < 6) {
      setFieldErrors({ mfa: "Enter the 6-digit verification code." });
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    // Placeholder for future MFA verification API
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    await completeLogin();
  };

  return (
    <motion.div
      animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.45 }}
      className="login-glass-card w-full max-w-[440px]"
    >
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BrandLogoImage size={44} priority className="ring-2 ring-[#B68D40]/25 lg:hidden" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#B68D40]">
              Secure access
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#E5E7EB]">
              {authStep === "credentials" ? "Sign in to ERP" : "Verify identity"}
            </h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              {authStep === "credentials"
                ? "Dandakaranya Foods · Enterprise console"
                : "Enter your authenticator code to continue"}
            </p>
          </div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#B68D40]/25 bg-[#B68D40]/10">
          <Shield className="h-5 w-5 text-[#B68D40]" strokeWidth={ICON_STROKE} aria-hidden />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {authStep === "credentials" ? (
          <motion.form
            key="credentials"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
            onSubmit={onSubmitCredentials}
            className="space-y-5"
            noValidate
          >
            <div>
              <Label htmlFor={emailId} className="text-[#E5E7EB]">
                Work email
              </Label>
              <div className="relative mt-2">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                  strokeWidth={ICON_STROKE}
                  aria-hidden
                />
                <Input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((f) => ({ ...f, email: undefined }));
                  }}
                  required
                  autoComplete="username"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
                  className={cn(
                    "login-input h-11 pl-10",
                    fieldErrors.email && "border-red-500/60 focus-visible:ring-red-500/30",
                  )}
                  placeholder="name@dandakaranyafoods.com"
                />
              </div>
              <AnimatePresence>
                {fieldErrors.email && (
                  <motion.p
                    id={`${emailId}-error`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-1.5 text-xs text-red-400"
                    role="alert"
                  >
                    {fieldErrors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor={passwordId} className="text-[#E5E7EB]">
                  Password
                </Label>
                <a
                  href="mailto:admin@dandakaranyafoods.com?subject=ERP%20Password%20Reset%20Request"
                  className="text-xs font-medium text-[#B68D40] transition hover:text-[#C9A55A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B68D40]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071226] rounded"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative mt-2">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
                  strokeWidth={ICON_STROKE}
                  aria-hidden
                />
                <Input
                  id={passwordId}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((f) => ({ ...f, password: undefined }));
                  }}
                  required
                  autoComplete="current-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? `${passwordId}-error` : undefined}
                  className={cn(
                    "login-input h-11 pl-10 pr-11",
                    fieldErrors.password && "border-red-500/60 focus-visible:ring-red-500/30",
                  )}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-white/5 hover:text-[#E5E7EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B68D40]/40"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" strokeWidth={ICON_STROKE} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={ICON_STROKE} />
                  )}
                </button>
              </div>
              <AnimatePresence>
                {fieldErrors.password && (
                  <motion.p
                    id={`${passwordId}-error`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-1.5 text-xs text-red-400"
                    role="alert"
                  >
                    {fieldErrors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <label
              htmlFor={rememberId}
              className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-[#94A3B8]"
            >
              <input
                id={rememberId}
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="login-checkbox h-4 w-4 rounded border-white/20 bg-[#102544] text-[#B68D40] focus:ring-[#B68D40]/40 focus:ring-offset-[#071226]"
              />
              Remember me on this device
            </label>

            <AnimatePresence>
              {(error || authError) && !fieldErrors.email && !fieldErrors.password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-300" role="alert">
                    {error || "Sign in failed. Please try again."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              variant="premium"
              className="h-11 w-full text-base font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={ICON_STROKE} />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>

            <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#B68D40]" strokeWidth={ICON_STROKE} />
              <p className="text-[11px] leading-relaxed text-[#94A3B8]">
                Enterprise-grade security. Sessions are encrypted and monitored. Unauthorized access is prohibited
                and logged per company policy.
              </p>
            </div>
          </motion.form>
        ) : (
          <motion.form
            key="mfa"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
            onSubmit={onSubmitMfa}
            className="space-y-5"
            noValidate
          >
            <div className="rounded-xl border border-[#B68D40]/20 bg-[#B68D40]/5 px-3 py-2.5 text-xs text-[#94A3B8]">
              Multi-factor authentication step — enter the code from your authenticator app.
            </div>
            <div>
              <Label htmlFor={mfaId} className="text-[#E5E7EB]">
                Verification code
              </Label>
              <Input
                id={mfaId}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => {
                  setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setFieldErrors((f) => ({ ...f, mfa: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.mfa)}
                className={cn(
                  "login-input mt-2 h-11 text-center text-lg tracking-[0.35em]",
                  fieldErrors.mfa && "border-red-500/60",
                )}
                placeholder="000000"
              />
              {fieldErrors.mfa && (
                <p className="mt-1.5 text-xs text-red-400" role="alert">
                  {fieldErrors.mfa}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setAuthStep("credentials");
                  setMfaCode("");
                }}
              >
                Back
              </Button>
              <Button type="submit" variant="premium" className="flex-1" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Verify & continue"
                )}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <LoginFooter />
    </motion.div>
  );
}

function LoginFooter() {
  return (
    <footer className="mt-8 border-t border-white/[0.06] pt-6">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
        <a
          href="mailto:support@dandakaranyafoods.com"
          className="inline-flex items-center gap-1 text-[#94A3B8] transition hover:text-[#B68D40] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B68D40]/40 rounded"
        >
          <HelpCircle className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
          Help &amp; support
        </a>
        <a
          href="https://dandakaranyafoods.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#94A3B8] transition hover:text-[#B68D40] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B68D40]/40 rounded"
        >
          Company website
        </a>
        <a
          href="mailto:admin@dandakaranyafoods.com?subject=ERP%20Access%20Issue"
          className="text-[#94A3B8] transition hover:text-[#B68D40] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B68D40]/40 rounded"
        >
          Contact IT
        </a>
      </div>
      <p className="mt-4 text-center text-[10px] text-[#94A3B8]/70">
        © {new Date().getFullYear()} Dandakaranya Foods Pvt. Ltd. · ERP v{ERP_VERSION}
      </p>
    </footer>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="login-glass-card flex h-[420px] w-full max-w-[440px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#B68D40]" strokeWidth={ICON_STROKE} />
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
