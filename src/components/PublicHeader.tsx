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
    <header id="public-header" className="bg-[#FFF8F0]/95 backdrop-blur-md border-b border-brand-rosegold/10 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo Brand */}
          <div 
            id="header-brand" 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => setView("shop")}
          >
            <div className="bg-brand-pink/70 p-2.5 rounded-full text-brand-chocolate group-hover:scale-105 transition-transform duration-300">
              <Cake className="h-6 w-6 text-brand-rosegold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-brand-chocolate leading-none">
                Lainie's <span className="font-heading italic font-normal text-brand-rosegold">Sweet Treats</span>
              </h1>
              <p className="text-[10px] tracking-widest text-[#B76E79] uppercase font-bold mt-1">
                Royse City, TX • Custom Baking
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
                  : "text-brand-chocolate/80 hover:bg-brand-pink/30"
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
                  : "text-brand-chocolate/80 hover:bg-brand-pink/30"
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
                  : "text-brand-chocolate/80 hover:bg-brand-pink/30"
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
                  className="bg-brand-chocolate text-brand-cream px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-all duration-200 shadow-xs"
                >
                  Admin Panel
                </button>
                <button
                  id="btn-logout"
                  onClick={onLogout}
                  className="border border-brand-chocolate/20 text-brand-chocolate p-2 rounded-full hover:bg-brand-pink/20 transition-all duration-200"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                id="btn-login-view"
                onClick={() => setView("login")}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border border-brand-rosegold/30 hover:bg-brand-pink/20 transition-all duration-200 ${
                  currentView === "login" ? "bg-brand-rosegold text-white" : "text-brand-rosegold"
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
      <div className="md:hidden border-t border-brand-pink/10 bg-brand-cream/80 flex justify-around py-2">
        <button
          onClick={() => setView("shop")}
          className={`flex flex-col items-center text-[10px] uppercase font-bold py-1 ${
            currentView === "shop" ? "text-brand-rosegold" : "text-brand-chocolate/60"
          }`}
        >
          <Cake className="h-4 w-4 mb-0.5" />
          <span>Shop</span>
        </button>
        <button
          onClick={() => setView("quote-builder")}
          className={`flex flex-col items-center text-[10px] uppercase font-bold py-1 ${
            currentView === "quote-builder" ? "text-brand-rosegold" : "text-brand-chocolate/60"
          }`}
        >
          <Sparkles className="h-4 w-4 mb-0.5" />
          <span>Quote Request</span>
        </button>
        <button
          onClick={() => setView("quote-portal")}
          className={`flex flex-col items-center text-[10px] uppercase font-bold py-1 ${
            currentView === "quote-portal" ? "text-brand-rosegold" : "text-brand-chocolate/60"
          }`}
        >
          <ClipboardCheck className="h-4 w-4 mb-0.5" />
          <span>Portal</span>
        </button>
      </div>
    </header>
  );
}
