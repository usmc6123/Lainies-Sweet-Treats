import React, { useState, useEffect } from "react";
import PublicHeader from "./components/PublicHeader";
import PublicOrderForm from "./components/PublicOrderForm";
import QuoteBuilder from "./components/QuoteBuilder";
import ClientQuotePortal from "./components/ClientQuotePortal";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import AdminOrders from "./components/AdminOrders";
import AdminQuotes from "./components/AdminQuotes";
import AdminProducts from "./components/AdminProducts";
import AdminCalendar from "./components/AdminCalendar";
import AdminIngredients from "./components/AdminIngredients";
import AdminCustomers from "./components/AdminCustomers";
import AdminSettings from "./components/AdminSettings";

import { 
  Sparkles, ShieldCheck, LogOut, LayoutDashboard, 
  ClipboardList, Heart, Calendar, Scale, Users, Settings, Tag, Gift
} from "lucide-react";

export default function App() {
  const [view, setView] = useState<string>("shop"); // 'shop', 'quote-request', 'client-portal', 'admin-login', 'admin-dashboard', 'admin-orders', etc.
  const [token, setToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [triggerRefreshCount, setTriggerRefreshCount] = useState(0);

  // Load token of admin if exists in localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem("lainie_admin_token");
    const storedEmail = localStorage.getItem("lainie_admin_email");
    if (storedToken && storedEmail) {
      setToken(storedToken);
      setAdminEmail(storedEmail);
      // default back to dashboard upon loading if was on an admin view
      setView("admin-dashboard");
    }
  }, []);

  const handleLoginSuccess = (newToken: string, email: string) => {
    localStorage.setItem("lainie_admin_token", newToken);
    localStorage.setItem("lainie_admin_email", email);
    setToken(newToken);
    setAdminEmail(email);
    setView("admin-dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("lainie_admin_token");
    localStorage.removeItem("lainie_admin_email");
    setToken(null);
    setAdminEmail(null);
    setView("shop");
  };

  const incrementRefresh = () => {
    setTriggerRefreshCount(prev => prev + 1);
  };

  const navigateTo = (newView: string) => {
    // If selecting admin-login and already have a token, take straight to dashboard
    if (newView === "admin-login" && token) {
      setView("admin-dashboard");
    } else {
      setView(newView);
    }
    // Scroll to view header smoothly
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isAdminView = view.startsWith("admin-");

  return (
    <div className="min-h-screen bg-brand-pink text-brand-chocolate font-sans flex flex-col justify-between selection:bg-brand-rosegold/30">
      
      {/* Top Welcome Ribbon */}
      <div className="bg-brand-chocolate text-brand-cream text-[10.5px] font-semibold tracking-wider text-center py-2 px-4 shadow-sm flex items-center justify-center space-x-1.5 shrink-0 z-40">
        <Sparkles className="h-3.5 w-3.5 text-brand-pink animate-pulse" />
        <span>Now taking custom graduation & bridal sweet requests for Royse City, Rockwall & Dallas communities!</span>
        <Gift className="h-3.5 w-3.5 text-brand-pink" />
      </div>

      {/* Main Header Integration */}
      {!isAdminView ? (
        <PublicHeader 
          currentView={
            view === "quote-request" ? "quote-builder" :
            view === "client-portal" ? "quote-portal" :
            view === "admin-login" ? "login" :
            view
          }
          setView={(headerView: string) => {
            if (headerView === "quote-builder") {
              navigateTo("quote-request");
            } else if (headerView === "quote-portal") {
              navigateTo("client-portal");
            } else if (headerView === "login") {
              navigateTo("admin-login");
            } else {
              navigateTo(headerView);
            }
          }}
          isAdminLoggedIn={!!token}
          onLogout={handleLogout}
        />
      ) : (
        /* Dynamic Header for Logged-In Admin with Tab Indicators */
        <header className="sticky top-0 bg-brand-cream/95 backdrop-blur-md border-b border-brand-pink/20 px-6 py-4 flex items-center justify-between z-50 shadow-xs shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg overflow-hidden border border-brand-pink/30 bg-black p-0.5 shadow-sm shrink-0">
              <img 
                src="https://github.com/usmc6123/images/blob/main/SweetTreatLogo.webp?raw=true" 
                alt="Lainie's Sweet Treats Logo" 
                className="h-full w-full object-contain rounded-md"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-sm font-extrabold uppercase tracking-wide text-brand-chocolate flex items-center space-x-1">
                <span>Lainie's Sweet treats</span>
                <span className="text-[9px] bg-brand-pink text-brand-chocolate font-bold rounded-sm px-1.5 py-0.5 ml-1">Office</span>
              </h1>
              <p className="text-[10px] text-gray-500 font-medium">Logged in: {adminEmail}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigateTo("shop")}
              className="text-[11px] font-bold text-gray-400 hover:text-brand-chocolate transition"
            >
              ← Back to Web Store
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition flex items-center space-x-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout Office</span>
            </button>
          </div>
        </header>
      )}

      {/* Dynamic Main Body */}
      <main className={`flex-1 w-full pb-16 pt-6 ${isAdminView && token ? "max-w-none px-6 md:px-10 lg:px-12 md:flex md:space-x-8" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"}`}>
        
        {/* Admin LEFT Navigation Sidebar: visible on md style screens */}
        {isAdminView && token && (
          <aside className="hidden md:flex w-72 lg:w-80 shrink-0 flex-col rounded-3xl bg-brand-chocolate text-white border border-brand-pink/20 shadow-lg p-6 md:min-h-[calc(100vh-140px)] sticky top-24">
            <div className="pb-4 border-b border-brand-pink/15 mb-6 text-center">
              <h2 className="font-heading text-2xl font-bold italic tracking-tight text-brand-pink">Lainie's</h2>
              <p className="text-[10px] text-brand-rosegold uppercase tracking-[0.2em] -mt-1 font-semibold">Sweet Treats</p>
            </div>
            
            <nav className="flex-1 space-y-1.5">
              <button
                onClick={() => navigateTo("admin-dashboard")}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition duration-200 text-left ${
                  view === "admin-dashboard"
                    ? "bg-brand-pink/10 text-brand-pink font-semibold border-l-4 border-brand-rosegold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <LayoutDashboard className="h-4 w-4 mr-3 opacity-80" />
                <span className="text-xs">Office Overview</span>
              </button>

              <button
                onClick={() => navigateTo("admin-orders")}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition duration-200 text-left ${
                  view === "admin-orders"
                    ? "bg-brand-pink/10 text-brand-pink font-semibold border-l-4 border-brand-rosegold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <ClipboardList className="h-4 w-4 mr-3 opacity-80" />
                <span className="text-xs">Orders Sheets</span>
              </button>

              <button
                onClick={() => navigateTo("admin-quotes")}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition duration-200 text-left ${
                  view === "admin-quotes"
                    ? "bg-brand-pink/10 text-brand-pink font-semibold border-l-4 border-brand-rosegold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Sparkles className="h-4 w-4 mr-3 opacity-80 text-brand-rosegold" />
                <span className="text-xs">Event Estimates</span>
              </button>

              <button
                onClick={() => navigateTo("admin-calendar")}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition duration-200 text-left ${
                  view === "admin-calendar"
                    ? "bg-brand-pink/10 text-brand-pink font-semibold border-l-4 border-brand-rosegold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Calendar className="h-4 w-4 mr-3 opacity-80" />
                <span className="text-xs">Calendar Limits</span>
              </button>

              <button
                onClick={() => navigateTo("admin-ingredients")}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition duration-200 text-left ${
                  view === "admin-ingredients"
                    ? "bg-brand-pink/10 text-brand-pink font-semibold border-l-4 border-brand-rosegold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Scale className="h-4 w-4 mr-3 opacity-80" />
                <span className="text-xs">Ingredients Library</span>
              </button>

              <button
                onClick={() => navigateTo("admin-products")}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition duration-200 text-left ${
                  view === "admin-products"
                    ? "bg-brand-pink/10 text-brand-pink font-semibold border-l-4 border-brand-rosegold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Tag className="h-4 w-4 mr-3 opacity-80" />
                <span className="text-xs">Products</span>
              </button>

              <button
                onClick={() => navigateTo("admin-customers")}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition duration-200 text-left ${
                  view === "admin-customers"
                    ? "bg-brand-pink/10 text-brand-pink font-semibold border-l-4 border-brand-rosegold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Users className="h-4 w-4 mr-3 opacity-80" />
                <span className="text-xs">Sweet Friends CRM</span>
              </button>

              <button
                onClick={() => navigateTo("admin-settings")}
                className={`w-full flex items-center px-4 py-3 rounded-xl transition duration-200 text-left ${
                  view === "admin-settings"
                    ? "bg-brand-pink/10 text-brand-pink font-semibold border-l-4 border-brand-rosegold"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Settings className="h-4 w-4 mr-3 opacity-80" />
                <span className="text-xs">System Settings</span>
              </button>
            </nav>

            <div className="mt-auto pt-6 border-t border-brand-pink/15">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full border border-brand-rosegold/50 overflow-hidden bg-black p-0.5 shadow-sm shrink-0">
                  <img 
                    src="https://github.com/usmc6123/images/blob/main/SweetTreatLogo.webp?raw=true" 
                    alt="Lainie's Sweet Treats Logo" 
                    className="h-full w-full object-contain rounded-full"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-white truncate">{adminEmail || "Lainie Smith"}</p>
                  <p className="text-[10px] text-brand-rosegold uppercase tracking-wider font-semibold">Owner / Admin</p>
                </div>
              </div>
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0">
          
          {/* Admin Navigation Mobile Tab Rail: visible ONLY on mobile/tablet */}
          {isAdminView && token && (
            <div className="md:hidden px-4 py-4 bg-white border border-brand-pink/20 rounded-2xl flex flex-wrap gap-1.5 justify-center mb-6 shadow-xs">
              <button
                onClick={() => navigateTo("admin-dashboard")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition ${
                  view === "admin-dashboard" 
                    ? "bg-brand-chocolate text-brand-cream" 
                    : "text-brand-chocolate/75 hover:bg-brand-pink/20"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => navigateTo("admin-orders")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition ${
                  view === "admin-orders" 
                    ? "bg-brand-chocolate text-brand-cream" 
                    : "text-brand-chocolate/75 hover:bg-brand-pink/20"
                }`}
              >
                Orders
              </button>
              <button
                onClick={() => navigateTo("admin-quotes")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition ${
                  view === "admin-quotes" 
                    ? "bg-brand-chocolate text-brand-cream" 
                    : "text-brand-chocolate/75 hover:bg-brand-pink/20"
                }`}
              >
                Quotes
              </button>
              <button
                onClick={() => navigateTo("admin-calendar")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition ${
                  view === "admin-calendar" 
                    ? "bg-brand-chocolate text-brand-cream" 
                    : "text-brand-chocolate/75 hover:bg-brand-pink/20"
                }`}
              >
                Limits
              </button>
              <button
                onClick={() => navigateTo("admin-ingredients")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition ${
                  view === "admin-ingredients" 
                    ? "bg-brand-chocolate text-brand-cream" 
                    : "text-brand-chocolate/75 hover:bg-brand-pink/20"
                }`}
              >
                Ingredients
              </button>
              <button
                onClick={() => navigateTo("admin-products")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition ${
                  view === "admin-products" 
                    ? "bg-brand-chocolate text-brand-cream" 
                    : "text-brand-chocolate/75 hover:bg-brand-pink/20"
                }`}
              >
                Products
              </button>
              <button
                onClick={() => navigateTo("admin-customers")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition ${
                  view === "admin-customers" 
                    ? "bg-brand-chocolate text-brand-cream" 
                    : "text-brand-chocolate/75 hover:bg-brand-pink/20"
                }`}
              >
                CRM
              </button>
              <button
                onClick={() => navigateTo("admin-settings")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition ${
                  view === "admin-settings" 
                    ? "bg-brand-chocolate text-brand-cream" 
                    : "text-brand-chocolate/75 hover:bg-brand-pink/20"
                }`}
              >
                Settings
              </button>
            </div>
          )}

          {/* Dynamic renders based on current active view keyword */}
          {view === "shop" && (
            <PublicOrderForm onSwitchToQuote={() => navigateTo("quote-request")} />
          )}
          {view === "quote-request" && <QuoteBuilder />}
          {view === "client-portal" && <ClientQuotePortal />}
          {view === "admin-login" && <AdminLogin onLoginSuccess={handleLoginSuccess} />}

          {/* Authenticated Admin Workspaces */}
          {isAdminView && !token && (
            <div className="p-8 text-center max-w-sm mx-auto space-y-4">
              <span className="bg-red-50 text-red-700 px-3 py-1 font-bold rounded-full text-xs">Access Denied</span>
              <p className="text-xs text-gray-500">You must establish authorized credentials first before inspecting Lainie's active sheets.</p>
              <button
                onClick={() => navigateTo("admin-login")}
                className="bg-brand-chocolate text-brand-cream hover:opacity-90 px-4 py-2 text-xs font-bold rounded-xl"
              >
                Take Me to Login Office
              </button>
            </div>
          )}

          {isAdminView && token && (
            <div>
              {view === "admin-dashboard" && <AdminDashboard token={token} setView={navigateTo} triggerRefresh={triggerRefreshCount} />}
              {view === "admin-orders" && <AdminOrders token={token} triggerRefresh={incrementRefresh} />}
              {view === "admin-quotes" && <AdminQuotes token={token} triggerRefresh={incrementRefresh} />}
              {view === "admin-products" && <AdminProducts token={token} triggerRefresh={incrementRefresh} />}
              {view === "admin-calendar" && <AdminCalendar token={token} triggerRefresh={incrementRefresh} />}
              {view === "admin-ingredients" && <AdminIngredients token={token} triggerRefresh={incrementRefresh} />}
              {view === "admin-customers" && <AdminCustomers token={token} />}
              {view === "admin-settings" && <AdminSettings token={token} triggerRefresh={incrementRefresh} />}
            </div>
          )}
        </div>

      </main>

      {/* Main Footer Block */}
      <footer className="bg-white border-t border-brand-pink/20 py-8 px-6 text-center text-xs text-brand-chocolate/60 shrink-0 z-40">
        <div className="max-w-2xl mx-auto space-y-3">
          <p className="font-heading italic text-sm text-brand-chocolate">Lainie's Sweet Treats</p>
          <p className="text-[10px] leading-relaxed">
            Delivering gorgeous, delicious mini cakes, custom cookies, cupcakes, dessert boxes & catering baskets in Royse City, Texas and surrounding Rockwall County. Made with organic butter, love, and sweet Texas charm.
          </p>
          <div className="pt-2 border-t border-brand-pink/10 text-[9px] text-gray-400">
            Lainie's Sweet Treats & Custom Design Bakery © 2026 • Secure Admin Office Protected by Cryptographic Token Lookups
          </div>
        </div>
      </footer>

    </div>
  );
}
