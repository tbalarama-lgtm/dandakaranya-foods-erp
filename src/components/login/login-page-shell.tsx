"use client";

import { motion } from "framer-motion";
import { LoginForm } from "@/components/login/login-form";
import { LoginHeroPanel } from "@/components/login/login-hero-panel";

function LoginParticles() {
  return (
    <div className="login-particles pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.span
          key={i}
          className="login-particle absolute h-1 w-1 rounded-full bg-[#B68D40]/40"
          style={{
            left: `${(i * 17) % 100}%`,
            top: `${(i * 23) % 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.15, 0.5, 0.15],
          }}
          transition={{
            duration: 4 + (i % 5),
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

export function LoginPageShell() {
  return (
    <div className="login-page relative flex min-h-screen min-h-[100dvh] flex-col bg-[#071226] lg:flex-row">
      <LoginParticles />

      {/* Left hero — desktop */}
      <div className="login-hero-panel relative hidden min-h-0 flex-1 lg:flex lg:max-w-[52%] xl:max-w-[55%]">
        <LoginHeroPanel />
      </div>

      {/* Mobile brand strip */}
      <div className="relative z-10 flex items-center justify-center border-b border-white/[0.06] bg-[#08182F]/90 px-6 py-4 backdrop-blur-md lg:hidden">
        <p className="text-sm font-semibold text-[#E5E7EB]">Dandakaranya Foods ERP</p>
      </div>

      {/* Right — login form */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-10 xl:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[440px]"
        >
          <LoginForm />
        </motion.div>
      </div>
    </div>
  );
}
