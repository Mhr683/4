import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  Video, 
  Image as ImageIcon, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Download, 
  Check, 
  Share2, 
  ShieldCheck, 
  Layers, 
  Camera, 
  Smartphone, 
  Monitor, 
  Square,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Flame,
  Truck,
  MessageSquare,
  Copy,
  Hash,
  TrendingUp,
  Send,
  CheckCheck,
  Wand2,
  RefreshCw,
  Tag
} from 'lucide-react';
import { Product, CurrencyCode } from '../types/dropship';
import { formatPKR, usdToPkr } from '../utils/currency';
import { 
  getAiPhotosForProduct, 
  generateDynamicStudioCanvas, 
  generateVideoAdStoryboard, 
  CommercialAudioSynth, 
  GeneratedPhotoAngle,
  VideoAdScene,
  AI_STUDIO_GENERATED_PHOTOS,
  generateSocialMediaCaptionsAndHashtags,
  SocialCaptionOption,
  GeneratedSocialMediaBundle
} from '../utils/aiMediaGenerator';

interface AiMediaStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  currency: CurrencyCode;
  onUpdateProductImages?: (productId: string, newImages: string[]) => void;
  resellerBrandName?: string;
}

export const AiMediaStudioModal: React.FC<AiMediaStudioModalProps> = ({
  isOpen,
  onClose,
  product,
  currency,
  onUpdateProductImages,
  resellerBrandName = 'Apna Reseller Store',
}) => {
  if (!isOpen || !product) return null;

  const [activeTab, setActiveTab] = useState<'photos' | 'video' | 'captions'>('photos');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>(product.images[0] || AI_STUDIO_GENERATED_PHOTOS.earbuds);
  const [photoAngles, setPhotoAngles] = useState<GeneratedPhotoAngle[]>([]);
  const [isGeneratingPhoto, setIsGeneratingPhoto] = useState(false);
  const [customStyle, setCustomStyle] = useState<'studio-white' | 'luxury-dark' | 'lifestyle'>('studio-white');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Video Ad states
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '1:1' | '16:9'>('9:16');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [sceneProgress, setSceneProgress] = useState(0); // 0 to 100%
  const [subtitleLang, setSubtitleLang] = useState<'urdu' | 'english'>('urdu');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Social Media Captions & Trending Hashtags states
  const [selectedCaptionId, setSelectedCaptionId] = useState<string>('tiktok-reels');
  const [copiedCaptionType, setCopiedCaptionType] = useState<string | null>(null);
  const [captionVariationSeed, setCaptionVariationSeed] = useState(0);
  const [activeCaptionStyle, setActiveCaptionStyle] = useState<string>('studio-white');
  const [selectedHashtagCategory, setSelectedHashtagCategory] = useState<string>('all');

  const audioSynthRef = useRef<CommercialAudioSynth | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scenes: VideoAdScene[] = generateVideoAdStoryboard(product, currency);

  // Active photo angle object
  const activeAngle = photoAngles.find((a) => a.url === selectedPhotoUrl) || photoAngles[0];
  const currentPhotoStyle = activeAngle?.style || customStyle || 'studio-white';

  // Compute Social Captions & Trending Hashtags Bundle dynamically
  const socialBundle: GeneratedSocialMediaBundle = useMemo(() => {
    return generateSocialMediaCaptionsAndHashtags(
      product,
      activeCaptionStyle || currentPhotoStyle,
      currency,
      resellerBrandName,
      captionVariationSeed
    );
  }, [product, activeCaptionStyle, currentPhotoStyle, currency, resellerBrandName, captionVariationSeed]);

  const activeCaption = socialBundle?.captions.find((c) => c.id === selectedCaptionId) || socialBundle?.captions[0];

  const handleCopyText = (text: string, typeKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCaptionType(typeKey);
    setTimeout(() => {
      setCopiedCaptionType((prev) => (prev === typeKey ? null : prev));
    }, 2000);
  };

  const handleShareCaptionToWhatsApp = (captionText: string) => {
    const encoded = encodeURIComponent(captionText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // Sync active caption style when selected photo changes
  useEffect(() => {
    if (activeAngle?.style) {
      setActiveCaptionStyle(activeAngle.style);
    }
  }, [selectedPhotoUrl, activeAngle?.style]);

  // Load photos on open
  useEffect(() => {
    if (product) {
      const generated = getAiPhotosForProduct(product.title, product.category);
      setPhotoAngles(generated);
      setSelectedPhotoUrl(product.images[0] || generated[0]?.url || AI_STUDIO_GENERATED_PHOTOS.earbuds);
    }
  }, [product]);

  // Clean up audio on unmount or close
  useEffect(() => {
    return () => {
      if (audioSynthRef.current) {
        audioSynthRef.current.stop();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Stop audio if closed
  useEffect(() => {
    if (!isOpen && audioSynthRef.current) {
      audioSynthRef.current.stop();
      setIsPlaying(false);
    }
  }, [isOpen]);

  // Video playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (audioSynthRef.current) audioSynthRef.current.stop();
      return;
    }

    if (!isMuted) {
      if (!audioSynthRef.current) {
        audioSynthRef.current = new CommercialAudioSynth();
      }
      audioSynthRef.current.start();
    } else if (audioSynthRef.current) {
      audioSynthRef.current.stop();
    }

    const currentScene = scenes[currentSceneIndex] || scenes[0];
    const durationMs = currentScene.durationSec * 1000;
    const startTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(100, (elapsed / durationMs) * 100);
      setSceneProgress(progress);

      if (progress >= 100) {
        if (currentSceneIndex < scenes.length - 1) {
          setCurrentSceneIndex((prev) => prev + 1);
          setSceneProgress(0);
        } else {
          // Loop video back to beginning
          setCurrentSceneIndex(0);
          setSceneProgress(0);
        }
      } else {
        animationFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentSceneIndex, isMuted]);

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleRestartVideo = () => {
    setCurrentSceneIndex(0);
    setSceneProgress(0);
    setIsPlaying(true);
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next && audioSynthRef.current) {
        audioSynthRef.current.stop();
      }
      return next;
    });
  };

  // Generate dynamic custom photo
  const handleGenerateFreshAngle = () => {
    setIsGeneratingPhoto(true);
    setTimeout(() => {
      const newCanvasDataUrl = generateDynamicStudioCanvas(product.title, product.category, customStyle);
      const newAngle: GeneratedPhotoAngle = {
        id: `gen-${Date.now()}`,
        name: `AI Studio 3D (${customStyle.toUpperCase()})`,
        urduName: 'سٹوڈیو تھری ڈی اینگل',
        url: newCanvasDataUrl,
        style: customStyle,
        badge: '100% Copyright Free',
        description: 'Instant generative studio render with dynamic lighting and reflection highlights.',
      };

      setPhotoAngles((prev) => [newAngle, ...prev]);
      setSelectedPhotoUrl(newCanvasDataUrl);
      setIsGeneratingPhoto(false);
    }, 600);
  };

  // Apply to product listing
  const handleApplyToStore = () => {
    if (onUpdateProductImages) {
      // Put selected image as primary image
      const otherImages = product.images.filter((img) => img !== selectedPhotoUrl);
      const updatedList = [selectedPhotoUrl, ...otherImages];
      onUpdateProductImages(product.id, updatedList);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  const handleDownloadImage = () => {
    const link = document.createElement('a');
    link.href = selectedPhotoUrl;
    link.download = `${product.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_studio_photo.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadVideoAdPoster = () => {
    setDownloadSuccess(true);
    handleDownloadImage();
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleShareToWhatsApp = () => {
    const pkrPrice = formatPKR(usdToPkr(product.retailPrice));
    const text = encodeURIComponent(
      `🔥 *${product.title}*\n\n` +
      `⭐ 100% Original Factory Quality & Tested\n` +
      `💰 Special Offer: Only *${pkrPrice}*\n` +
      `🚚 Cash on Delivery (COD) All Across Pakistan\n` +
      `📦 Safe Packing by ${resellerBrandName}\n\n` +
      `👉 Order now on WhatsApp or reply to this message!`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const currentScene = scenes[currentSceneIndex] || scenes[0];
  const pkrPrice = formatPKR(usdToPkr(product.retailPrice));
  const wholesalePkr = formatPKR(usdToPkr(product.supplierCost));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative bg-slate-900 text-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-800 overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 rounded-2xl shadow-md shadow-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-white tracking-tight">
                  AI Commercial Media Studio
                </h2>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  100% Copyright-Free
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                Generate high-converting commercial studio photography & video ads for <span className="text-white font-semibold">"{product.title}"</span>.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher & Safe Guarantee Banner */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setActiveTab('photos');
                setIsPlaying(false);
              }}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'photos'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Studio Photoshoot Angles ({photoAngles.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('video');
                setIsPlaying(true);
              }}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'video'
                  ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Video className="w-4 h-4 text-amber-300" />
              <span>AI Video Ad Maker (TikTok / Reels / Status)</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('captions');
                setIsPlaying(false);
              }}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'captions'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-purple-300" />
              <span>Social Captions & Hashtags</span>
              <span className="bg-purple-400/30 text-purple-200 text-[9px] px-1.5 py-0.5 rounded-full font-bold">AI</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Safe for Facebook Ads, TikTok Shop, Daraz & Shopify</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 flex-1 space-y-6">
          {activeTab === 'photos' ? (
            /* TAB 1: STUDIO PHOTOSHOOT ANGLES */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left: Main Stage Preview */}
              <div className="md:col-span-7 space-y-4">
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center group">
                  <img
                    src={selectedPhotoUrl}
                    alt={product.title}
                    className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-500"
                  />

                  {/* Copyright-Free Badge */}
                  <div className="absolute top-3 left-3 bg-emerald-500/90 text-slate-950 text-xs font-black px-3 py-1 rounded-lg backdrop-blur-xs flex items-center gap-1.5 shadow-md">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Commercial Safe • No Copyright Strike</span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 bg-slate-950/80 backdrop-blur-md p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">{product.title}</span>
                      <span className="text-slate-400 text-[11px]">8K Studio Master • Ready for Listing</span>
                    </div>
                    <button
                      onClick={handleDownloadImage}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
                      title="Download image file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Apply to Listing Action */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    onClick={handleApplyToStore}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer active:scale-98"
                  >
                    {savedSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Applied to Listing Successfully!</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Apply Selected Photo to Store Listing</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('video');
                      setIsPlaying(true);
                    }}
                    className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    <span>Make Video Ad</span>
                  </button>
                </div>

                {/* Instant Social Captions CTA */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveCaptionStyle(currentPhotoStyle);
                    setActiveTab('captions');
                  }}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-950/80 via-indigo-950/70 to-purple-950/80 border border-indigo-700/60 hover:border-indigo-400 text-indigo-200 hover:text-white font-bold rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer shadow-xs group"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400 group-hover:rotate-12 transition-transform" />
                    <span>Generate Viral Social Captions & Hashtags for this Shot</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Right: Studio Angle Presets & Generator Controls */}
              <div className="md:col-span-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Available Studio Angles ({photoAngles.length})</span>
                    <span className="text-[10px] text-emerald-400 font-normal">Click to Preview</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {photoAngles.map((angle) => (
                      <button
                        key={angle.id}
                        onClick={() => setSelectedPhotoUrl(angle.url)}
                        className={`relative rounded-xl overflow-hidden border-2 text-left p-1.5 transition-all cursor-pointer group ${
                          selectedPhotoUrl === angle.url
                            ? 'border-emerald-500 bg-slate-800 ring-2 ring-emerald-500/20'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="aspect-square rounded-lg overflow-hidden bg-slate-900 mb-1.5 relative">
                          <img
                            src={angle.url}
                            alt={angle.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <span className="absolute top-1 left-1 bg-slate-950/80 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded">
                            {angle.style}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-white truncate">{angle.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{angle.urduName}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instant Generator Panel */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Render Custom 3D Studio Shot</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Zero-Cost AI</span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Choose Lighting & Studio Environment:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setCustomStyle('studio-white')}
                        className={`py-1.5 px-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                          customStyle === 'studio-white'
                            ? 'bg-slate-800 border-emerald-500 text-white'
                            : 'border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Pure White
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomStyle('luxury-dark')}
                        className={`py-1.5 px-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                          customStyle === 'luxury-dark'
                            ? 'bg-slate-800 border-emerald-500 text-white'
                            : 'border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Luxury Dark
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomStyle('lifestyle')}
                        className={`py-1.5 px-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                          customStyle === 'lifestyle'
                            ? 'bg-slate-800 border-emerald-500 text-white'
                            : 'border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Warm Ambient
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateFreshAngle}
                    disabled={isGeneratingPhoto}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {isGeneratingPhoto ? (
                      <span>Rendering 3D Studio Scene...</span>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate & Add to Angles</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: AI VIDEO AD MAKER FOR REELS / TIKTOK / WHATSAPP */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Left: Video Ad Player Canvas */}
              <div className="md:col-span-6 flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Aspect Ratio:</span>
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setAspectRatio('9:16')}
                        className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                          aspectRatio === '9:16' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                        title="Vertical 9:16 for Reels, TikTok, Shorts & WhatsApp Status"
                      >
                        <Smartphone className="w-3 h-3" />
                        <span>9:16</span>
                      </button>
                      <button
                        onClick={() => setAspectRatio('1:1')}
                        className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                          aspectRatio === '1:1' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                        title="Square 1:1 for Instagram & Facebook Feed"
                      >
                        <Square className="w-3 h-3" />
                        <span>1:1</span>
                      </button>
                      <button
                        onClick={() => setAspectRatio('16:9')}
                        className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                          aspectRatio === '16:9' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                        title="Landscape 16:9 for YouTube"
                      >
                        <Monitor className="w-3 h-3" />
                        <span>16:9</span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleToggleMute}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      isMuted ? 'bg-slate-800 text-slate-400' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    <span>{isMuted ? 'Muted' : 'Commercial Music ON'}</span>
                  </button>
                </div>

                {/* Animated Video Frame Stage */}
                <div
                  className={`relative overflow-hidden rounded-2xl bg-black border-2 border-slate-700 shadow-2xl transition-all duration-300 flex items-center justify-center ${
                    aspectRatio === '9:16'
                      ? 'w-[280px] h-[497px]'
                      : aspectRatio === '1:1'
                      ? 'w-[360px] h-[360px]'
                      : 'w-full max-w-[480px] aspect-video'
                  }`}
                >
                  {/* Dynamic Zooming/Panning Image */}
                  <img
                    src={selectedPhotoUrl}
                    alt={product.title}
                    className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
                      isPlaying && currentScene.cameraMotion === 'zoom-in'
                        ? 'scale-115'
                        : isPlaying && currentScene.cameraMotion === 'pulse-glow'
                        ? 'scale-108'
                        : 'scale-100'
                    }`}
                  />

                  {/* Gradient Vignette Overlays for Professional Commercial Look */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/70 pointer-events-none" />

                  {/* Top Ad Header Hook */}
                  <div className="absolute top-4 left-3 right-3 flex items-center justify-between text-xs">
                    <span className="bg-rose-600 text-white font-black text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1 shadow-md animate-pulse">
                      <Flame className="w-3 h-3" />
                      {currentScene.highlightText}
                    </span>
                    <span className="bg-slate-900/80 backdrop-blur-md text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-400/30">
                      COD Verified
                    </span>
                  </div>

                  {/* Center Dynamic Commercial Tag on Scene 3 or 4 */}
                  {currentSceneIndex === 2 && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none animate-in zoom-in-90 duration-300">
                      <div className="bg-emerald-600/95 backdrop-blur-md border border-emerald-400 text-white p-3 rounded-2xl text-center shadow-2xl max-w-[200px]">
                        <span className="text-[10px] uppercase font-bold text-emerald-200 block">Pakistan Special Price</span>
                        <div className="text-xl font-black">{pkrPrice}</div>
                        <span className="text-[9px] text-emerald-100 block mt-0.5">🚚 Cash on Delivery All Over PK</span>
                      </div>
                    </div>
                  )}

                  {/* Bottom Subtitle / Voiceover Box */}
                  <div className="absolute bottom-4 left-3 right-3 bg-slate-950/90 backdrop-blur-md border border-slate-700 p-3 rounded-xl shadow-xl">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-bold text-amber-400 uppercase tracking-wider">
                        {currentScene.title}
                      </span>
                      <span>Delivered by {resellerBrandName}</span>
                    </div>

                    <p className="text-xs sm:text-sm font-black text-white leading-snug">
                      {subtitleLang === 'urdu' ? currentScene.urduSubtitle : currentScene.englishSubtitle}
                    </p>

                    {/* Scene Progress indicator */}
                    <div className="w-full bg-slate-800 h-1 rounded-full mt-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-400 to-rose-500 h-full transition-all duration-100"
                        style={{ width: `${sceneProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Player Controls */}
                <div className="w-full max-w-[360px] flex items-center justify-between mt-4 px-2">
                  <button
                    onClick={handleTogglePlay}
                    className="p-3 bg-rose-600 hover:bg-rose-500 text-white rounded-full transition-all shadow-lg shadow-rose-600/30 cursor-pointer active:scale-95"
                    title={isPlaying ? 'Pause' : 'Play Video'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>

                  <div className="flex items-center gap-1.5">
                    {scenes.map((sc, idx) => (
                      <button
                        key={sc.id}
                        onClick={() => {
                          setCurrentSceneIndex(idx);
                          setSceneProgress(0);
                        }}
                        className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                          currentSceneIndex === idx ? 'bg-amber-400 w-5' : 'bg-slate-700 hover:bg-slate-500'
                        }`}
                        title={sc.title}
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleRestartVideo}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
                    title="Restart Video"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right: Storyboard Details, Language Toggle & Social Exports */}
              <div className="md:col-span-6 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Voiceover Subtitle Language
                    </h4>
                    <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
                      <button
                        onClick={() => setSubtitleLang('urdu')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                          subtitleLang === 'urdu' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        اردو / Roman Urdu
                      </button>
                      <button
                        onClick={() => setSubtitleLang('english')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                          subtitleLang === 'english' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                        }`}
                      >
                        English
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    {scenes.map((sc, idx) => (
                      <div
                        key={sc.id}
                        onClick={() => {
                          setCurrentSceneIndex(idx);
                          setSceneProgress(0);
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                          currentSceneIndex === idx
                            ? 'bg-slate-800/90 border-amber-500/80 shadow-xs'
                            : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-amber-400">{sc.title}</span>
                          <span className="text-slate-500 font-mono">{sc.durationSec}s</span>
                        </div>
                        <p className="text-slate-300 line-clamp-1 text-[11px]">
                          {subtitleLang === 'urdu' ? sc.urduSubtitle : sc.englishSubtitle}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Social Ad Export & Action Buttons */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ready for Social Marketing</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Viral Format</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={handleShareToWhatsApp}
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share on WhatsApp</span>
                    </button>

                    <button
                      onClick={handleDownloadVideoAdPoster}
                      className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {downloadSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Ad Clip Saved!</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Ad Poster</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Resellers can post this directly to TikTok, Instagram Reels, and WhatsApp Status with Cash on Delivery enabled!
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setActiveTab('captions');
                    }}
                    className="w-full py-2 px-3 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 hover:from-indigo-900 hover:to-purple-900 border border-indigo-800/60 text-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-purple-300" />
                    <span>Copy Viral Video Ad Captions & Hashtags</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'captions' && (
            /* TAB 3: SOCIAL MEDIA CAPTIONS & TRENDING HASHTAGS */
            <div className="space-y-6">
              {/* Top Banner: Style & Tone Context Bar */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 via-indigo-950/60 to-purple-950/60 border border-indigo-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-indigo-500/40 shrink-0 relative">
                    <img 
                      src={selectedPhotoUrl} 
                      alt={product.title} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = AI_STUDIO_GENERATED_PHOTOS.earbuds;
                      }}
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[8px] text-center text-purple-300 font-bold py-0.5 truncate px-0.5">
                      {activeCaptionStyle}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-white">AI Social Copy & Trending Hashtags</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        {socialBundle.styleLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">
                      {socialBundle.styleVibeDescription}
                    </p>
                  </div>
                </div>

                {/* Style Selector & Regenerate Variations */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <span className="text-[11px] text-slate-400 font-medium">Image Style:</span>
                  <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                    {[
                      { key: 'studio-white', label: 'Studio White' },
                      { key: 'luxury-dark', label: 'Luxury Dark' },
                      { key: 'lifestyle', label: 'Lifestyle' },
                      { key: 'packaging', label: 'Unboxing' }
                    ].map((st) => (
                      <button
                        key={st.key}
                        onClick={() => setActiveCaptionStyle(st.key)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          activeCaptionStyle === st.key
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCaptionVariationSeed((prev) => prev + 1)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer shadow-xs"
                    title="Generate new hook and adjective variations"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Regenerate Hooks</span>
                  </button>
                </div>
              </div>

              {/* Main Content Grid: Left (Captions Engine) & Right (Live Preview & Hashtags) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Platform Selection & Caption Box (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Platform Selector Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {socialBundle.captions.map((cap) => (
                      <button
                        key={cap.id}
                        onClick={() => setSelectedCaptionId(cap.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                          selectedCaptionId === cap.id
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/30'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                        }`}
                      >
                        <span>{cap.platform}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                          selectedCaptionId === cap.id ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {cap.badge.split(' ')[0]}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Active Caption Card */}
                  {activeCaption && (
                    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 shadow-xl">
                      {/* Caption Card Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white">{activeCaption.headline}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {activeCaption.badge}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                            <span>🎵 {activeCaption.suggestedMusicMood}</span>
                            <span>•</span>
                            <span>⏰ Best Time: {activeCaption.bestTime}</span>
                          </div>
                        </div>

                        {/* Top quick copy */}
                        <button
                          onClick={() => handleCopyText(activeCaption.fullCaption, 'full')}
                          className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          {copiedCaptionType === 'full' ? (
                            <>
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-black">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy All</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Hook Spotlight */}
                      <div className="p-3 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-500/30 rounded-xl">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                          Hook Line (First 3 Seconds of Video / Status)
                        </span>
                        <p className="text-xs font-extrabold text-white leading-relaxed">
                          {activeCaption.hook}
                        </p>
                      </div>

                      {/* Full Body / Read-only Preview Area */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                          <span>Full Post Text (Captions & Details):</span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            {activeCaption.fullCaption.length} characters • {activeCaption.fullCaption.split(/\s+/).length} words
                          </span>
                        </div>
                        <textarea
                          readOnly
                          rows={7}
                          value={activeCaption.fullCaption}
                          className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono leading-relaxed outline-hidden focus:border-indigo-500 resize-none select-all"
                        />
                      </div>

                      {/* Action Buttons Toolbar */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <button
                          onClick={() => handleCopyText(activeCaption.fullCaption, 'full')}
                          className="py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          {copiedCaptionType === 'full' ? (
                            <>
                              <CheckCheck className="w-4 h-4 text-emerald-300" />
                              <span>Copied Caption + Tags!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copy Caption + Tags</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleCopyText(activeCaption.body ? `${activeCaption.hook}\n\n${activeCaption.body}\n\n${activeCaption.callToAction}` : activeCaption.hook, 'caption')}
                          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          {copiedCaptionType === 'caption' ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 text-slate-400" />
                              <span>Copy Only Caption</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleShareCaptionToWhatsApp(activeCaption.fullCaption)}
                          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                        >
                          <Send className="w-4 h-4" />
                          <span>Share to WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Live Mockup Preview & Trending Hashtags Panel (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Phone / Social Post Live Simulation */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-0.5">
                          <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-[10px] font-black text-white">
                            {resellerBrandName.charAt(0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1">
                            <span>{resellerBrandName}</span>
                            <CheckCircle2 className="w-3 h-3 text-blue-400" />
                          </div>
                          <span className="text-[10px] text-slate-400">Sponsored • Pakistan COD</span>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        {formatPKR(usdToPkr(product.retailPrice))}
                      </span>
                    </div>

                    {/* Image Preview with Style Overlay */}
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800/80">
                      <img
                        src={selectedPhotoUrl}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = AI_STUDIO_GENERATED_PHOTOS.earbuds;
                        }}
                      />
                      <div className="absolute top-2 left-2 bg-slate-950/80 text-white text-[9px] font-bold px-2 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>AI Studio Shot</span>
                      </div>
                      <div className="absolute bottom-2 right-2 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-md">
                        COD Available
                      </div>
                    </div>

                    {/* Caption Preview Text */}
                    <div className="text-xs text-slate-300 space-y-1">
                      <p className="line-clamp-3 text-[11px] leading-relaxed">
                        <span className="font-bold text-white mr-1.5">{resellerBrandName}</span>
                        {activeCaption?.hook} {activeCaption?.body}
                      </p>
                      <div className="text-[10px] text-indigo-400 font-medium line-clamp-1">
                        {activeCaption?.hashtags.join(' ')}
                      </div>
                    </div>
                  </div>

                  {/* Trending Hashtags Panel */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Hash className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-white">Trending Hashtag Clusters</span>
                      </div>
                      <button
                        onClick={() => handleCopyText(socialBundle.allHashtagsFlat.join(' '), 'all-hashtags')}
                        className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedCaptionType === 'all-hashtags' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-bold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy All ({socialBundle.allHashtagsFlat.length})</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Category Groups */}
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {socialBundle.hashtagCategories.map((cat, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            {cat.category}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {cat.tags.map((tag) => (
                              <button
                                key={tag}
                                onClick={() => handleCopyText(tag, tag)}
                                title="Click to copy single hashtag"
                                className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                                  copiedCaptionType === tag
                                    ? 'bg-emerald-600 text-white border-emerald-500 scale-105'
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-purple-500 hover:text-white'
                                }`}
                              >
                                {copiedCaptionType === tag ? '✓ Copied' : tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Tap any hashtag to copy individually</span>
                      <span className="text-emerald-400 font-semibold">100% Shadowban-Safe</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Guaranteed zero copyright strike risk on Meta, Google & TikTok ads</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
