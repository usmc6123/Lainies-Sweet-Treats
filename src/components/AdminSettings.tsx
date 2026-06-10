import React, { useState, useEffect } from "react";
import { Settings, Save, AlertTriangle, HelpCircle, CheckCircle2 } from "lucide-react";
import { Settings as SettingsType } from "../types";

interface AdminSettingsProps {
  token: string;
  triggerRefresh: () => void;
}

export default function AdminSettings({ token, triggerRefresh }: AdminSettingsProps) {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Settings Form States
  const [businessName, setBusinessName] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [deliveryFeePerMile, setDeliveryFeePerMile] = useState(0);
  const [minimumLeadDays, setMinimumLeadDays] = useState(5);
  const [autoEmailTemplate, setAutoEmailTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
          
          setBusinessName(data.businessName);
          setTaxRate(data.taxRate);
          setDeliveryFeePerMile(data.deliveryFeePerMile);
          setMinimumLeadDays(data.minimumLeadDays);
          setAutoEmailTemplate(data.autoEmailTemplate);
        }
      } catch (err) {
        console.error("Failed to fetch settings keys", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    const payload = {
      businessName,
      taxRate: Number(taxRate),
      deliveryFeePerMile: Number(deliveryFeePerMile),
      minimumLeadDays: Number(minimumLeadDays),
      autoEmailTemplate
    };

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSaveSuccess(true);
        triggerRefresh();
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        alert("Failed to update system variables.");
      }
    } catch {
      alert("Error communication with settings service.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white border border-brand-pink/10 rounded-3xl">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-rosegold"></div>
        <p className="mt-4 text-xs text-brand-chocolate/85">Loading operational defaults...</p>
      </div>
    );
  }

  return (
    <div id="admin-settings-view" className="w-full space-y-6 animate-in fade-in duration-300">
      
      {/* Title */}
      <div className="flex items-center space-x-2 pb-4 border-b border-brand-pink/10">
        <Settings className="h-6 w-6 text-brand-rosegold" />
        <h2 className="text-2xl lg:text-3xl font-bold text-brand-chocolate font-heading">
          System Core Configuration
        </h2>
      </div>

      <form onSubmit={handleSaveSettings} className="bg-white border border-brand-pink/20 rounded-[2.5rem] p-8 sm:p-10 shadow-sm space-y-8">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
          {/* Business Name */}
          <div>
            <label className="text-xs uppercase font-bold text-brand-chocolate/70 tracking-wider block">
              Registered business name
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full text-sm bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3.5 mt-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-semibold text-brand-chocolate"
            />
            <p className="text-xs text-gray-400 mt-1.5">Displays layout title bars dynamically.</p>
          </div>

          {/* Texas Sales Tax Rate */}
          <div>
            <label className="text-xs uppercase font-bold text-brand-chocolate/70 tracking-wider block">
              TX Sales Tax surcharge (%)
            </label>
            <input
              type="number"
              required
              step="0.0001"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="w-full text-sm bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3.5 mt-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-semibold text-brand-chocolate"
            />
            <p className="text-xs text-gray-400 mt-1.5">Lainie's Sweet Treats is located in Royse City, TX (State tax rate 8.25%).</p>
          </div>

          {/* Surcharge mileage fee */}
          <div>
            <label className="text-xs uppercase font-bold text-brand-chocolate/70 tracking-wider block">
              Delivery mileage standard rate ($/mile)
            </label>
            <input
              type="number"
              required
              step="0.01"
              value={deliveryFeePerMile}
              onChange={(e) => setDeliveryFeePerMile(Number(e.target.value))}
              className="w-full text-sm bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3.5 mt-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-semibold text-brand-chocolate"
            />
            <p className="text-xs text-gray-400 mt-1.5">Multiplied by radial mileage input on shipping orders.</p>
          </div>

          {/* Lead dates */}
          <div>
            <label className="text-xs uppercase font-bold text-brand-chocolate/70 tracking-wider block">
              Minimum Custom Design Lead Times (Days)
            </label>
            <input
              type="number"
              required
              min="1"
              max="60"
              value={minimumLeadDays}
              onChange={(e) => setMinimumLeadDays(Number(e.target.value))}
              className="w-full text-sm bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3.5 mt-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-semibold text-brand-chocolate"
            />
            <p className="text-xs text-gray-400 mt-1.5">Blocks consumer checkout if the chosen event date is too near.</p>
          </div>
        </div>

        {/* Template formula */}
        <div className="space-y-2">
          <label className="text-xs uppercase font-bold text-brand-chocolate/70 tracking-wider block">
            Automatic confirmation client letter template
          </label>
          <textarea
            rows={6}
            required
            value={autoEmailTemplate}
            onChange={(e) => setAutoEmailTemplate(e.target.value)}
            className="w-full text-sm bg-brand-cream/10 border border-brand-pink/20 rounded-2xl p-4 mt-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold leading-relaxed font-mono text-brand-chocolate"
          />
          <p className="text-xs text-gray-400 mt-1.5 leading-normal">
            Used to draft uniform notifications. Injected automatically into Lainie's dispatch logs upon quote confirmation.
          </p>
        </div>

        {saveSuccess && (
          <div className="p-4 bg-green-50 text-green-800 rounded-xl text-sm font-semibold flex items-center space-x-2 border border-green-250 animate-bounce">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <span>Success! Operations variables written and deployed to firestore database.</span>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-chocolate text-brand-cream hover:opacity-95 py-3.5 rounded-xl text-sm font-bold transition shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Save className="h-5 w-5 text-brand-pink" />
          <span>{saving ? "Deploying Variables..." : "Save System Operational Settings"}</span>
        </button>
      </form>
    </div>
  );
}
