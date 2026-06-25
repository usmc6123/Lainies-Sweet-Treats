import React from "react";
import { Cake, Sparkles, ClipboardCheck, LogOut, LogIn } from "lucide-react";

interface PublicHeaderProps {
  currentView: string;
  setView: (view: string) => void;
  isAdminLoggedIn: boolean;
  onLogout: () => void;
}

export default function PublicHeader({ currentView, setView, isAdminLoggedIn, onLogout }: PublicHeaderProps) {
  return (
    <header id="public-header" className="bg-brand-cream border-b border-brand-pink/20 sticky top-0 z-40 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4 min-h-[5.5rem]">
          
          {/* Logo Brand */}
          <div 
            id="header-brand" 
            className="flex items-center space-x-3.5 cursor-pointer group"
            onClick={() => {
              sessionStorage.setItem("lainie_shop_category", "All");
              setView("shop");
              window.dispatchEvent(new Event("lainie_category_change"));
            }}
          >
            <div className="h-11 w-11 md:h-12 md:w-12 rounded-lg overflow-hidden border border-brand-chocolate/15 bg-brand-chocolate hover:scale-105 transition-all duration-300 shrink-0 p-0.5">
              <img 
                src="https://github.com/usmc6123/images/blob/main/SweetTreatLogo.webp?raw=true" 
                alt="Lainie's Sweet Treats Logo" 
                className="h-full w-full object-contain rounded-md"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-xl md:text-[25px] font-medium tracking-tight text-brand-chocolate font-heading leading-tight">
                Lainie's Sweet Treats
              </h1>
            </div>
          </div>

          {/* Navigation Links */}
          <nav id="header-nav" className="hidden md:flex items-center space-x-4 lg:space-x-5 text-brand-chocolate">
            <button
              id="nav-shop"
              onClick={() => {
                sessionStorage.setItem("lainie_shop_category", "All");
                setView("shop");
                window.dispatchEvent(new Event("lainie_category_change"));
              }}
              className={`text-xs uppercase tracking-widest font-black transition-all duration-200 hover:scale-105 ${
                currentView === "shop" ? "text-brand-pink" : "text-brand-chocolate hover:text-brand-rosegold"
              }`}
            >
              Shop All
            </button>

            <span className="text-brand-chocolate/20">|</span>


            <button
              id="nav-quote"
              onClick={() => setView("quote-builder")}
              className="group flex flex-col items-center justify-center text-center transition-all duration-200 leading-none hover:scale-105"
            >
              <span className={`text-[11px] uppercase tracking-widest font-black transition-colors duration-200 ${
                currentView === "quote-builder" ? "text-brand-pink" : "text-brand-chocolate group-hover:text-brand-rosegold"
              }`}>
                Wedding & Events
              </span>
              <span className="text-[11px] font-semibold text-brand-pink underline mt-0.5 group-hover:text-brand-rosegold transition-colors">
                Request Quote
              </span>
            </button>

            <span className="text-brand-chocolate/20">|</span>

            <button
              id="nav-portal"
              onClick={() => setView("quote-portal")}
              className={`text-xs uppercase tracking-widest font-black transition-all duration-200 hover:scale-105 ${
                currentView === "quote-portal" ? "text-brand-pink" : "text-brand-chocolate hover:text-brand-rosegold"
              }`}
            >
              Client Portal
            </button>

            <span className="text-brand-chocolate/20">|</span>

            {isAdminLoggedIn ? (
              <button
                id="nav-admin"
                onClick={() => setView("admin-dashboard")}
                className="text-xs uppercase tracking-widest font-black text-brand-chocolate hover:text-brand-rosegold transition-all duration-200 hover:scale-105"
              >
                Admin
              </button>
            ) : (
              <button
                id="nav-admin-login"
                onClick={() => setView("login")}
                className="text-xs uppercase tracking-widest font-black text-brand-chocolate hover:text-brand-rosegold transition-all duration-200 hover:scale-105"
              >
                Admin
              </button>
            )}
          </nav>

          {/* Right Action */}
          <div id="header-actions" className="flex items-center space-x-4">
            {isAdminLoggedIn ? (
              <div className="flex items-center space-x-3">
                <button
                  id="btn-logout"
                  onClick={onLogout}
                  className="flex items-center space-x-1.5 text-xs font-black uppercase tracking-widest text-brand-chocolate hover:text-brand-pink transition-all duration-200 hover:scale-105"
                >
                  <LogOut className="h-4 w-4" />
                  <span>LOGOUT</span>
                </button>
              </div>
            ) : (
              <button
                id="btn-login-view"
                onClick={() => setView("login")}
                className={`flex items-center space-x-1.5 text-xs font-black uppercase tracking-widest text-brand-chocolate hover:text-brand-rosegold transition-all duration-200 hover:scale-105 ${
                  currentView === "login" ? "text-brand-pink" : ""
                }`}
              >
                <LogIn className="h-4.5 w-4.5" />
                <span>LOGIN</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Navigation Rail */}
      <div className="md:hidden border-t border-brand-pink/20 bg-brand-cream flex justify-around py-3">
        <button
          onClick={() => {
            sessionStorage.setItem("lainie_shop_category", "All");
            setView("shop");
            window.dispatchEvent(new Event("lainie_category_change"));
          }}
          className={`flex flex-col items-center text-[10px] uppercase font-bold py-1 ${
            currentView === "shop" ? "text-brand-pink" : "text-brand-chocolate/60"
          }`}
        >
          <Cake className="h-4 w-4 mb-0.5" />
          <span>Shop All</span>
        </button>
        <button
          onClick={() => setView("quote-builder")}
          className={`flex flex-col items-center text-[10px] uppercase font-bold py-1 ${
            currentView === "quote-builder" ? "text-brand-pink" : "text-brand-chocolate/60"
          }`}
        >
          <Sparkles className="h-4 w-4 mb-0.5" />
          <span>Quote</span>
        </button>
        <button
          onClick={() => setView("quote-portal")}
          className={`flex flex-col items-center text-[10px] uppercase font-bold py-1 ${
            currentView === "quote-portal" ? "text-brand-pink" : "text-brand-chocolate/60"
          }`}
        >
          <ClipboardCheck className="h-4 w-4 mb-0.5" />
          <span>Portal</span>
        </button>
      </div>
    </header>
  );
}
