import React, { useState, useEffect } from "react";
import { Settings, Save, CheckCircle2, Lock, Sparkles, Instagram, Upload, Sliders } from "lucide-react";
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
  const [deliveryFee, setDeliveryFee] = useState(15);
  const [deliveryFeePerMile, setDeliveryFeePerMile] = useState(0);
  const [minimumLeadDays, setMinimumLeadDays] = useState(5);
  const [autoEmailTemplate, setAutoEmailTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // FEATURE 3 States
  const [announcementBanner, setAnnouncementBanner] = useState("");
  const [bannerVisible, setBannerVisible] = useState(true);

  // FEATURE 7 States (Instagram Option B)
  const [instagramFeedUrls, setInstagramFeedUrls] = useState<string[]>([]);
  const [newInstaUrl, setNewInstaUrl] = useState("");

  // Webstore Background Settings States
  const [topBgUrl, setTopBgUrl] = useState("");
  const [topBgType, setTopBgType] = useState<"image" | "video">("image");
  const [topBgOpacity, setTopBgOpacity] = useState(0.65);
  const [bottomBgUrl, setBottomBgUrl] = useState("");
  const [bottomBgType, setBottomBgType] = useState<"image" | "video">("image");
  const [bottomBgOpacity, setBottomBgOpacity] = useState(0.15);

  // File uploading states for background setting
  const [uploadingTop, setUploadingTop] = useState(false);
  const [uploadingBottom, setUploadingBottom] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // FEATURE 4 Change Password States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
          
          setBusinessName(data.businessName || "Lainie's Sweet Treats");
          setTaxRate(data.taxRate || 0);
          setDeliveryFee(data.deliveryFee !== undefined ? Number(data.deliveryFee) : 15.00);
          setDeliveryFeePerMile(data.deliveryFeePerMile || 0);
          setMinimumLeadDays(data.minimumLeadDays || 5);
          setAutoEmailTemplate(data.autoEmailTemplate || "");

          // Feature 3
          setAnnouncementBanner(data.announcementBanner || "");
          setBannerVisible(data.bannerVisible !== false);

          // Feature 7
          setInstagramFeedUrls(data.instagramFeedUrls || []);

          // Webstore Backgrounds
          setTopBgUrl(data.topBgUrl || "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=1600&auto=format&fit=crop");
          setTopBgType(data.topBgType || "image");
          setTopBgOpacity(data.topBgOpacity !== undefined ? Number(data.topBgOpacity) : 0.65);
          setBottomBgUrl(data.bottomBgUrl || "https://firebasestorage.googleapis.com/v0/b/lainies-sweet-treats.firebasestorage.app/o/site-assets%2Fbackground2.jpg?alt=media&token=1d962c6e-eb11-4f47-b98e-3dbc5863f473");
          setBottomBgType(data.bottomBgType || "image");
          setBottomBgOpacity(data.bottomBgOpacity !== undefined ? Number(data.bottomBgOpacity) : 0.15);
        }
      } catch (err) {
        console.error("Failed to fetch settings keys", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>, position: "top" | "bottom") => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (limit to 15MB for video/image)
    if (file.size > 15 * 1024 * 1024) {
      setUploadError("File is too large. Please select a file under 15MB.");
      return;
    }

    setUploadError("");
    if (position === "top") setUploadingTop(true);
    else setUploadingBottom(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type || (file.type.includes("video") ? "video/mp4" : "image/jpeg"),
              base64: base64String,
              productId: "backgrounds"
            })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Upload failed");
          }

          const data = await res.json();
          if (data.url) {
            if (position === "top") {
              setTopBgUrl(data.url);
              setTopBgType(file.type.includes("video") ? "video" : "image");
            } else {
              setBottomBgUrl(data.url);
              setBottomBgType(file.type.includes("video") ? "video" : "image");
            }
          }
        } catch (err: any) {
          console.error("Upload error:", err);
          setUploadError(err.message || "Failed to upload background file.");
        } finally {
          if (position === "top") setUploadingTop(false);
          else setUploadingBottom(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || "Failed to read local file.");
      if (position === "top") setUploadingTop(false);
      else setUploadingBottom(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    const payload = {
      businessName,
      taxRate: Number(taxRate),
      deliveryFee: Number(deliveryFee),
      deliveryFeePerMile: Number(deliveryFeePerMile),
      minimumLeadDays: Number(minimumLeadDays),
      autoEmailTemplate,
      // Feature 3 & 7
      announcementBanner,
      bannerVisible,
      instagramFeedUrls,
      // Background styling options
      topBgUrl,
      topBgType,
      topBgOpacity: Number(topBgOpacity),
      bottomBgUrl,
      bottomBgType,
      bottomBgOpacity: Number(bottomBgOpacity)
    };

    try {
      const res = await fetch("/api/settings", {
        method: "POST", // The backend endpoint responds to POST or PUT
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Confirm password does not match new password.");
      return;
    }

    setPasswordChanging(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password.");
      }

      setPasswordSuccess("Admin password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "An error occurred.");
    } finally {
      setPasswordChanging(false);
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
    <div id="admin-settings-view" className="w-full space-y-8 animate-in fade-in duration-300">
      
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
            <p className="text-xs text-gray-400 mt-1.5 font-medium">Lainie's Sweet Treats is located in Royse City, TX (State tax rate 8.25%).</p>
          </div>

          {/* Local Delivery Flat Fee */}
          <div>
            <label className="text-xs uppercase font-bold text-brand-chocolate/70 tracking-wider block">
              Local Delivery Fee ($)
            </label>
            <input
              type="number"
              required
              step="0.01"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(Number(e.target.value))}
              className="w-full text-sm bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3.5 mt-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-semibold text-brand-chocolate"
            />
            <p className="text-xs text-gray-400 mt-1.5 font-medium">Flat local delivery fee (default: $15.00).</p>
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
            <p className="text-xs text-gray-400 mt-1.5 font-medium">Multiplied by radial mileage input on shipping orders.</p>
          </div>

          {/* Lead days */}
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
            <p className="text-xs text-gray-400 mt-1.5 font-medium">Blocks consumer checkout if the chosen event date is too near.</p>
          </div>

          {/* Feature 3 — Storefront Announcement Banner */}
          <div className="col-span-1 sm:col-span-2 border-t border-brand-pink/10 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-brand-rosegold" />
                <h3 className="font-heading text-lg font-bold text-brand-chocolate">Storefront Announcement Banner</h3>
              </div>
              <button
                type="button"
                onClick={() => setBannerVisible(!bannerVisible)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${bannerVisible ? 'bg-brand-rosegold' : 'bg-gray-200'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${bannerVisible ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>

            <div className="relative">
              <label className="text-xs uppercase font-extrabold text-brand-chocolate/65 tracking-wider block">
                Announcement Text (Max 200 characters)
              </label>
              <input
                type="text"
                maxLength={200}
                value={announcementBanner}
                onChange={(e) => setAnnouncementBanner(e.target.value)}
                placeholder="Now taking custom wedding cake request details for Fall season!"
                className="w-full text-sm bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3.5 mt-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-medium"
              />
              <div className="flex justify-between items-center mt-1.5 px-0.5">
                <span className="text-[10px] text-brand-chocolate/40 font-semibold italic">* Char count threshold:</span>
                <span className={`text-xs font-black ${announcementBanner.length > 180 ? 'text-red-500' : 'text-brand-chocolate/60'}`}>
                  {announcementBanner.length}/200
                </span>
              </div>
            </div>
          </div>

          {/* Feature 7 — Instagram Feed Option B */}
          <div className="col-span-1 sm:col-span-2 border-t border-brand-pink/10 pt-6 space-y-4">
            <div className="flex items-center space-x-2">
              <Instagram className="h-5 w-5 text-brand-rosegold" />
              <h3 className="font-heading text-lg font-bold text-brand-chocolate">Curate Instagram Feed Showcase (Up to 6)</h3>
            </div>
            <p className="text-xs text-gray-500 leading-normal">
              Josh is currently setting up the Facebook Developer app for automated syndication. In the meantime, use manual urls below to override and build an elegant gallery on the storefront!
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={newInstaUrl}
                onChange={(e) => setNewInstaUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600"
                className="flex-1 text-sm bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-medium"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newInstaUrl) return;
                  if (instagramFeedUrls.length >= 6) {
                    alert("Maximum limit of 6 curated posts. Delete an existing showcase first to add more.");
                    return;
                  }
                  setInstagramFeedUrls([...instagramFeedUrls, newInstaUrl]);
                  setNewInstaUrl("");
                }}
                className="bg-brand-chocolate text-brand-cream hover:opacity-90 font-bold text-xs px-5 rounded-xl cursor-pointer"
              >
                + Add Post
              </button>
            </div>

            {instagramFeedUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                {instagramFeedUrls.map((url, idx) => (
                  <div key={idx} className="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden border border-brand-pink/15 group shadow-xs">
                    <img src={url} alt={`Instagram curated post ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    <button
                      type="button"
                      onClick={() => setInstagramFeedUrls(instagramFeedUrls.filter((_, i) => i !== idx))}
                      className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-red-600 rounded-full w-5 h-5 flex items-center justify-center text-white text-[9px] font-black transition cursor-pointer"
                    >
                      ✕
                    </button>
                    <div className="absolute bottom-1.5 left-2 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Webstore Background Customizer Section */}
          <div className="col-span-1 sm:col-span-2 border-t border-brand-pink/10 pt-6 space-y-6">
            <div className="flex items-center space-x-2">
              <Sliders className="h-5 w-5 text-brand-rosegold" />
              <h3 className="font-heading text-lg font-bold text-brand-chocolate">Storefront Background Customizer</h3>
            </div>
            
            <p className="text-xs text-gray-500 leading-normal font-medium">
              Personalize your webstore's top hero banner and bottom catalog backgrounds by uploading images or looping MP4 videos. Use the transparency sliders to control contrast with the text.
            </p>

            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-150 text-red-700 text-xs font-semibold rounded-xl">
                {uploadError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Top Background Panel */}
              <div className="border border-brand-pink/10 rounded-2xl p-4 bg-brand-cream/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-chocolate/80">
                    Top Background (Hero Banner)
                  </h4>
                </div>

                {/* Preview */}
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-brand-pink/15 bg-black/5 flex items-center justify-center">
                  {topBgUrl ? (
                    topBgType === "video" ? (
                      <video
                        src={topBgUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        style={{ opacity: topBgOpacity }}
                      />
                    ) : (
                      <img
                        src={topBgUrl}
                        alt="Top Background Preview"
                        className="w-full h-full object-cover"
                        style={{ opacity: topBgOpacity }}
                      />
                    )
                  ) : (
                    <span className="text-xs text-gray-400">No background set</span>
                  )}
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                    {topBgType} Preview
                  </div>
                </div>

                {/* Media Controls */}
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block mb-1">
                      Manual Resource URL
                    </label>
                    <input
                      type="text"
                      value={topBgUrl}
                      onChange={(e) => setTopBgUrl(e.target.value)}
                      className="w-full text-xs bg-white border border-brand-pink/20 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-semibold"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block mb-1">
                        Media Type
                      </label>
                      <select
                        value={topBgType}
                        onChange={(e) => setTopBgType(e.target.value as "image" | "video")}
                        className="w-full text-xs bg-white border border-brand-pink/20 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-bold text-brand-chocolate"
                      >
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                      </select>
                    </div>

                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block mb-1">
                        Upload Local File
                      </label>
                      <label className="flex items-center justify-center gap-1.5 w-full text-xs bg-brand-pink/10 hover:bg-brand-pink/15 text-brand-rosegold border border-brand-pink/30 hover:border-brand-pink/50 rounded-lg p-2 font-bold cursor-pointer transition">
                        <Upload className="h-3.5 w-3.5" />
                        <span>{uploadingTop ? "Uploading..." : "Upload File"}</span>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          disabled={uploadingTop}
                          onChange={(e) => handleUploadBackground(e, "top")}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Opacity/Transparency Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-brand-chocolate/60 uppercase">
                      <span>Background Opacity (Transparency)</span>
                      <span className="text-brand-rosegold font-black">{Math.round(topBgOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={topBgOpacity}
                      onChange={(e) => setTopBgOpacity(Number(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-rosegold"
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Background Panel */}
              <div className="border border-brand-pink/10 rounded-2xl p-4 bg-brand-cream/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-chocolate/80">
                    Bottom Background (Catalog Backdrop)
                  </h4>
                </div>

                {/* Preview */}
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-brand-pink/15 bg-black/5 flex items-center justify-center">
                  {bottomBgUrl ? (
                    bottomBgType === "video" ? (
                      <video
                        src={bottomBgUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        style={{ opacity: bottomBgOpacity }}
                      />
                    ) : (
                      <img
                        src={bottomBgUrl}
                        alt="Bottom Background Preview"
                        className="w-full h-full object-cover"
                        style={{ opacity: bottomBgOpacity }}
                      />
                    )
                  ) : (
                    <span className="text-xs text-gray-400">No background set</span>
                  )}
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                    {bottomBgType} Preview
                  </div>
                </div>

                {/* Media Controls */}
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block mb-1">
                      Manual Resource URL
                    </label>
                    <input
                      type="text"
                      value={bottomBgUrl}
                      onChange={(e) => setBottomBgUrl(e.target.value)}
                      className="w-full text-xs bg-white border border-brand-pink/20 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-semibold"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block mb-1">
                        Media Type
                      </label>
                      <select
                        value={bottomBgType}
                        onChange={(e) => setBottomBgType(e.target.value as "image" | "video")}
                        className="w-full text-xs bg-white border border-brand-pink/20 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold font-bold text-brand-chocolate"
                      >
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                      </select>
                    </div>

                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-brand-chocolate/60 block mb-1">
                        Upload Local File
                      </label>
                      <label className="flex items-center justify-center gap-1.5 w-full text-xs bg-brand-pink/10 hover:bg-brand-pink/15 text-brand-rosegold border border-brand-pink/30 hover:border-brand-pink/50 rounded-lg p-2 font-bold cursor-pointer transition">
                        <Upload className="h-3.5 w-3.5" />
                        <span>{uploadingBottom ? "Uploading..." : "Upload File"}</span>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          disabled={uploadingBottom}
                          onChange={(e) => handleUploadBackground(e, "bottom")}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Opacity/Transparency Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-brand-chocolate/60 uppercase">
                      <span>Background Opacity (Transparency)</span>
                      <span className="text-brand-rosegold font-black">{Math.round(bottomBgOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={bottomBgOpacity}
                      onChange={(e) => setBottomBgOpacity(Number(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-rosegold"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Template formula */}
        <div className="space-y-2 border-t border-brand-pink/10 pt-6">
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
          <p className="text-xs text-gray-400 mt-1.5 leading-normal font-medium">
            Used to draft uniform notifications. Injected automatically into Lainie's dispatch logs upon quote confirmation.
          </p>
        </div>

        {saveSuccess && (
          <div className="p-4 bg-green-50 text-green-800 rounded-xl text-sm font-semibold flex items-center space-x-2 border border-green-200">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <span>Success! Operations variables written and deployed to firestore database.</span>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-chocolate text-brand-cream hover:opacity-95 py-4 rounded-xl text-sm font-bold transition shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Save className="h-5 w-5 text-brand-pink" />
          <span>{saving ? "Deploying Variables..." : "Save System Operational Settings"}</span>
        </button>
      </form>

      {/* FEATURE 4 — Change Password Option Gate */}
      <div className="bg-white border border-brand-pink/20 rounded-[2.5rem] p-8 sm:p-10 shadow-sm space-y-6">
        <div className="flex items-center space-x-2 border-b border-brand-pink/10 pb-4">
          <Lock className="h-5 w-5 text-brand-rosegold" />
          <h3 className="font-heading text-xl font-bold text-brand-chocolate">Administrative Credentials Gate</h3>
        </div>
        <p className="text-xs text-gray-500 leading-normal font-semibold">
          Reset password credentials to secure Lainie's cost structures, ingredients inventories, and consumer CRM registries.
        </p>

        <form onSubmit={handleChangePassword} className="space-y-4 text-sm max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase font-extrabold text-brand-chocolate/70 tracking-wider block">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3.5 mt-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-medium"
              />
            </div>
            
            <div>
              <label className="text-xs uppercase font-extrabold text-brand-chocolate/70 tracking-wider block">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 chars"
                className="w-full text-sm bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3.5 mt-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-medium"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-extrabold text-brand-chocolate/70 tracking-wider block">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Must match"
                className="w-full text-sm bg-brand-cream/10 border border-brand-pink/20 rounded-xl p-3.5 mt-2 focus:outline-none focus:ring-1 focus:ring-brand-rosegold text-brand-chocolate font-medium"
              />
            </div>
          </div>

          {passwordError && (
            <p className="text-xs text-red-600 font-semibold">{passwordError}</p>
          )}

          {passwordSuccess && (
            <p className="text-xs text-green-700 font-semibold">{passwordSuccess}</p>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={passwordChanging}
              className="px-6 py-3 bg-brand-chocolate hover:opacity-90 text-brand-cream font-bold text-xs rounded-xl transition cursor-pointer"
            >
              {passwordChanging ? "Updating Password..." : "Apply Credential Reset"}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
