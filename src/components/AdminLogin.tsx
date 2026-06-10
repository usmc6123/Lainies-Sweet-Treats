import React, { useState } from "react";
import { Lock, Mail, AlertTriangle, Key } from "lucide-react";

interface AdminLoginProps {
  onLoginSuccess: (token: string, email: string) => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        onLoginSuccess(data.token, data.admin.email);
      } else {
        setErrorText(data.error || "Login credentials failed.");
      }
    } catch {
      setErrorText("Unable to communicate with verification backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="admin-login-view" className="max-w-md mx-auto px-4 py-16 animate-in fade-in duration-300">
      <div className="bg-white border border-brand-pink/20 rounded-[2.5rem] p-8 shadow-xs text-center">
        <div className="mx-auto h-20 w-20 rounded-full overflow-hidden border-2 border-brand-pink bg-white shadow-xs p-1 hover:scale-105 transition-transform duration-300 shrink-0 mb-4">
          <img 
            src="https://images.squarespace-cdn.com/content/v1/6a0b183aaec8f87f9644a515/4a01bf37-b09f-4987-8495-e4876d754270/ChatGPT+Image+May+19%2C+2026%2C+09_01_51+AM.png?format=1500w" 
            alt="Lainie's Sweet Treats Logo" 
            className="h-full w-full object-cover rounded-full"
            referrerPolicy="no-referrer"
          />
        </div>
        <h2 className="text-2xl font-black text-brand-chocolate font-heading">
          Lainie's Sweet Office
        </h2>
        <p className="text-xs text-brand-chocolate/60 mt-1.5 font-semibold">
          Authorized bakery administrative personnel only
        </p>

        <form onSubmit={handleSubmit} className="mt-8 text-left space-y-4">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-brand-chocolate/70 block">
              Admin Email Address
            </label>
            <div className="relative mt-1">
              <Mail className="h-4 w-4 text-brand-chocolate/40 absolute left-3 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lainie@sweet-treats.com"
                className="w-full text-xs bg-brand-cream/20 border border-brand-pink/15 rounded-xl pl-9 pr-3 py-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-brand-chocolate/70 block">
              Secret Password
            </label>
            <div className="relative mt-1">
              <Key className="h-4 w-4 text-brand-chocolate/40 absolute left-3 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs bg-brand-cream/20 border border-brand-pink/15 rounded-xl pl-9 pr-3 py-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold"
              />
            </div>
          </div>

          {errorText && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-semibold flex items-center space-x-2 border border-red-150 mt-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorText}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-chocolate text-brand-cream hover:bg-brand-chocolate/90 py-3 rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center justify-center space-x-2 mt-4"
          >
            {loading ? "Authenticating Office..." : "Log In to Dashboard"}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-brand-pink/10 text-[10px] text-brand-chocolate/50 italic">
          Default developer login credentials: <br />
          Email: <span className="font-semibold text-brand-rosegold">lainie@sweet-treats.com</span> • Password: <span className="font-semibold text-brand-rosegold">password123</span>
        </div>
      </div>
    </div>
  );
}
