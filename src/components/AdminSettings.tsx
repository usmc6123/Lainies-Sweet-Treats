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
    <div id="admin-settings-view" className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Title */}
      <div className="flex items-center space-x-2 pb-4 border-b border-brand-pink/10">
        <Settings className="h-5 w-5 text-brand-rosegold" />
        <h2 className="text-xl font-bold text-brand-chocolate font-heading">
          System Core Configuration
        </h2>
      </div>

      <form onSubmit={handleSaveSettings} className="bg-white border border-brand-pink/20 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          {/* Business Name */}
          <div>
            <label className="text-[10px] uppercase font-bold text-brand-chocolate/70 block">
              Registered business name
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full text-xs bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3 mt-1.5 focus:outline-none"
            />
            <p className="text-[9.5px] text-gray-400 mt-1">Displays layout title bars dynamically.</p>
          </div>

          {/* Texas Sales Tax Rate */}
          <div>
            <label className="text-[10px] uppercase font-bold text-brand-chocolate/70 block">
              TX Sales Tax surcharge (%)
            </label>
            <input
              type="number"
              required
              step="0.0001"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="w-full text-xs bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3 mt-1.5 focus:outline-none"
            />
            <p className="text-[9.5px] text-gray-400 mt-1">Lainie's Sweet Treats is located in Royse City, TX (State tax rate 8.25%).</p>
          </div>

          {/* Surcharge mileage fee */}
          <div>
            <label className="text-[10px] uppercase font-bold text-brand-chocolate/70 block">
              Delivery mileage standard rate ($/mile)
            </label>
            <input
              type="number"
              required
              step="0.01"
              value={deliveryFeePerMile}
              onChange={(e) => setDeliveryFeePerMile(Number(e.target.value))}
              className="w-full text-xs bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3 mt-1.5 focus:outline-none"
            />
            <p className="text-[9.5px] text-gray-400 mt-1">Multiplied by radial mileage input on shipping orders.</p>
          </div>

          {/* Lead dates */}
          <div>
            <label className="text-[10px] uppercase font-bold text-brand-chocolate/70 block">
              Minimum Custom Design Lead Times (Days)
            </label>
            <input
              type="number"
              required
              min="1"
              max="60"
              value={minimumLeadDays}
              onChange={(e) => setMinimumLeadDays(Number(e.target.value))}
              className="w-full text-xs bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3 mt-1.5 focus:outline-none"
            />
            <p className="text-[9.5px] text-gray-400 mt-1">Blocks consumer checkout if the chosen event date is too near.</p>
          </div>
        </div>

        {/* Template formula */}
        <div>
          <label className="text-[10px] uppercase font-bold text-brand-chocolate/70 block">
            Automatic confirmation client letter template
          </label>
          <textarea
            rows={5}
            required
            value={autoEmailTemplate}
            onChange={(e) => setAutoEmailTemplate(e.target.value)}
            className="w-full text-xs bg-brand-cream/10 border border-brand-pink/20 rounded-2xl p-4 mt-2 focus:outline-none leading-relaxed font-mono"
          />
          <p className="text-[9.5px] text-gray-400 mt-1 leading-normal">
            Used to draft uniform notifications. Injected automatically into Lainie's dispatch logs upon quote confirmation.
          </p>
        </div>

        {saveSuccess && (
          <div className="p-3.5 bg-green-50 text-green-700 rounded-xl text-xs font-semibold flex items-center space-x-2 border border-green-250 animate-bounce">
            <CheckCircle2 className="h-4 w-4" />
            <span>Success! Operations variables written and deployed to firestore database.</span>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-chocolate text-brand-cream hover:bg-brand-chocolate/90 py-3 rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center space-x-2"
        >
          <Save className="h-4 w-4 text-brand-pink" />
          <span>{saving ? "Deploying Variables..." : "Save System Operational Settings"}</span>
        </button>
      </form>
    </div>
  );
}
