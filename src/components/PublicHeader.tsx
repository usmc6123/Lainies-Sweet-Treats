import React from "react";
import { Cake, Sparkles, Calendar, ClipboardCheck, Lock, LogOut } from "lucide-react";

interface PublicHeaderProps {
  currentView: string;
  setView: (view: string) => void;
  isAdminLoggedIn: boolean;
  onLogout: () => void;
}

export default function PublicHeader({ currentView, setView, isAdminLoggedIn, onLogout }: PublicHeaderProps) {
  return (
    <header id="public-header" className="bg-brand-chocolate/95 backdrop-blur-md border-b border-brand-pink/10 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4 md:py-6 min-h-[7.5rem]">
          {/* Logo Brand */}
          <div 
            id="header-brand" 
            className="flex items-center space-x-5 cursor-pointer group"
            onClick={() => setView("shop")}
          >
            <div className="h-20 w-20 md:h-24 md:w-24 rounded-2xl overflow-hidden border-2 border-brand-pink/30 bg-black shadow-md p-1 hover:scale-[1.08] hover:rotate-3 transition-transform duration-300 shrink-0">
              <img 
                src="https://github.com/usmc6123/images/blob/main/SweetTreatLogo.webp?raw=true" 
                alt="Lainie's Sweet Treats Logo" 
                className="h-full w-full object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-brand-cream leading-none">
                Lainie's <span className="font-heading italic font-normal text-brand-pink">Sweet Treats</span>
              </h1>
              <p className="text-xs tracking-widest text-[#EDAEEF] uppercase font-extrabold mt-1.5">
                Bespoke Cottage Bakery • Royse City, TX
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav id="header-nav" className="hidden md:flex items-center space-x-1">
            <button
              id="nav-shop"
              onClick={() => setView("shop")}
              className={`px-4 py-2 rounded-full text-xs uppercase tracking-wider font-semibold transition-all duration-200 flex items-center space-x-1.5 ${
                currentView === "shop" 
                  ? "bg-brand-rosegold text-white shadow-xs" 
                  : "text-brand-cream/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Cake className="h-3.5 w-3.5" />
              <span>Shop & Order</span>
            </button>

            <button
              id="nav-quote"
              onClick={() => setView("quote-builder")}
              className={`px-4 py-2 rounded-full text-xs uppercase tracking-wider font-semibold transition-all duration-200 flex items-center space-x-1.5 ${
                currentView === "quote-builder" 
                  ? "bg-brand-rosegold text-white shadow-xs" 
                  : "text-brand-cream/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-brand-pink" />
              <span>Request Custom Quote</span>
            </button>

            <button
              id="nav-portal"
              onClick={() => setView("quote-portal")}
              className={`px-4 py-2 rounded-full text-xs uppercase tracking-wider font-semibold transition-all duration-200 flex items-center space-x-1.5 ${
                currentView === "quote-portal" 
                  ? "bg-brand-rosegold text-white shadow-xs" 
                  : "text-brand-cream/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>Interactive Client Portal</span>
            </button>
          </nav>

          {/* Right Action */}
          <div id="header-actions" className="flex items-center space-x-4">
            {isAdminLoggedIn ? (
              <div className="flex items-center space-x-2">
                <button
                  id="nav-admin"
                  onClick={() => setView("admin-dashboard")}
                  className="bg-brand-rosegold text-white px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all duration-200 shadow-xs"
                >
                  Admin Panel
                </button>
                <button
                  id="btn-logout"
                  onClick={onLogout}
                  className="border border-brand-cream/20 text-brand-cream p-2 rounded-full hover:bg-white/10 transition-all duration-200"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                id="btn-login-view"
                onClick={() => setView("login")}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border transition-all duration-200 ${
                  currentView === "login" 
                    ? "bg-brand-rosegold border-brand-rosegold text-white" 
                    : "border-brand-pink/40 text-brand-pink hover:border-brand-pink hover:bg-white/10"
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Navigation Rail */}
      <div className="md:hidden border-t border-brand-pink/10 bg-brand-chocolate/95 flex justify-around py-2">
        <button
          onClick={() => setView("shop")}
          className={`flex flex-col items-center text-[10px] uppercase font-bold py-1 ${
            currentView === "shop" ? "text-brand-pink" : "text-brand-cream/60"
          }`}
        >
          <Cake className="h-4 w-4 mb-0.5" />
          <span>Shop</span>
        </button>
        <button
          onClick={() => setView("quote-builder")}
          className={`flex flex-col items-center text-[10px] uppercase font-bold py-1 ${
            currentView === "quote-builder" ? "text-brand-pink" : "text-brand-cream/60"
          }`}
        >
          <Sparkles className="h-4 w-4 mb-0.5" />
          <span>Quote Request</span>
        </button>
        <button
          onClick={() => setView("quote-portal")}
          className={`flex flex-col items-center text-[10px] uppercase font-bold py-1 ${
            currentView === "quote-portal" ? "text-brand-pink" : "text-brand-cream/60"
          }`}
        >
          <ClipboardCheck className="h-4 w-4 mb-0.5" />
          <span>Portal</span>
        </button>
      </div>
    </header>
  );
}
