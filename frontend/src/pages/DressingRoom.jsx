import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Shirt, 
  ArrowRight, 
  Loader2, 
  Check, 
  Lock,
  Unlock,
  RefreshCw,
  Download,
  ChevronDown,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import api from "@/lib/api";

const PARTS = [
  { id: "upper_wear", label: "Upper" },
  { id: "lower_wear", label: "Lower" },
  { id: "shoes", label: "Shoes" },
  { id: "jacket", label: "Jacket" },
  { id: "dress", label: "Dress" },
  { id: "accessories", label: "Accessories" },
];

export default function DressingRoom() {
  const [characters, setCharacters] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [selectedOutfit, setSelectedOutfit] = useState(null);
  const [selectedParts, setSelectedParts] = useState(["upper_wear", "lower_wear"]);
  const [resultImage, setResultImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [settings, setSettings] = useState({
    precision_mode: true,
    face_lock: true,
    body_lock: true,
    pose_lock: true,
    lighting_lock: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [charRes, outfitRes, settingsRes] = await Promise.all([
        api.getCharacters(),
        api.getOutfits(),
        api.getSettings(),
      ]);
      setCharacters(charRes.data);
      setOutfits(outfitRes.data);
      setSettings(settingsRes.data);
      
      // Auto-seed if empty
      if (charRes.data.length === 0 && outfitRes.data.length === 0) {
        await api.seedData();
        const [newChars, newOutfits] = await Promise.all([
          api.getCharacters(),
          api.getOutfits(),
        ]);
        setCharacters(newChars.data);
        setOutfits(newOutfits.data);
        toast.success("Sample data loaded");
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const togglePart = (partId) => {
    setSelectedParts(prev => 
      prev.includes(partId) 
        ? prev.filter(p => p !== partId)
        : [...prev, partId]
    );
  };

  const applyDressing = async () => {
    if (!selectedCharacter || !selectedOutfit) {
      toast.error("Select both character and outfit");
      return;
    }
    if (selectedParts.length === 0) {
      toast.error("Select at least one clothing part");
      return;
    }

    setProcessing(true);
    try {
      const result = await api.applyDressing({
        character_id: selectedCharacter.id,
        outfit_id: selectedOutfit.id,
        selected_parts: selectedParts,
        ...settings,
      });
      setResultImage(result.data.result_image);
      toast.success("Outfit applied successfully!");
    } catch (error) {
      console.error("Dressing failed:", error);
      toast.error("Failed to apply outfit");
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full grid grid-cols-[300px_1fr_300px]" data-testid="dressing-room">
      {/* Left Panel - Characters */}
      <div className="border-r border-zinc-800/50 bg-[#0a0a0a] flex flex-col">
        <div className="p-6 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-zinc-400" />
            <h2 className="font-secondary text-xl">Characters</h2>
          </div>
          <p className="text-xs text-zinc-500 mt-2 font-mono uppercase tracking-wider">
            Select a model
          </p>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 grid grid-cols-2 gap-3">
            {characters.map((char) => (
              <motion.div
                key={char.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedCharacter(char)}
                className={`asset-card cursor-pointer ${selectedCharacter?.id === char.id ? "selected" : ""}`}
                data-testid={`character-card-${char.id}`}
              >
                <img src={char.base_image} alt={char.name} loading="lazy" />
                <div className="overlay flex flex-col justify-end p-3">
                  <span className="text-xs font-medium truncate">{char.name}</span>
                  {char.locked && <Lock className="w-3 h-3 text-primary mt-1" />}
                </div>
                {selectedCharacter?.id === char.id && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Center - Canvas */}
      <div className="flex flex-col bg-[#050505]">
        {/* Top Bar */}
        <div className="p-4 border-b border-zinc-800/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-secondary text-2xl">Dressing Room</h1>
            <span className="px-3 py-1 bg-zinc-800/50 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
              {settings.precision_mode ? "Precision Mode" : "Standard Mode"}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={loadData}
              className="text-zinc-400 hover:text-white"
              data-testid="refresh-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white" data-testid="more-options-btn">
                  <Layers className="w-4 h-4 mr-2" />
                  <span className="font-mono text-xs">Parts</span>
                  <ChevronDown className="w-3 h-3 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem onClick={() => setSelectedParts(PARTS.map(p => p.id))}>
                  Select All Parts
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedParts([])}>
                  Clear All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedParts(["upper_wear", "lower_wear"])}>
                  Top & Bottom Only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 p-8 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {resultImage ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="result-container relative max-w-lg w-full"
                data-testid="result-container"
              >
                <img 
                  src={resultImage} 
                  alt="Result" 
                  className="w-full aspect-[3/4] object-cover"
                />
                <div className="result-badge">
                  <Check className="w-3 h-3 inline mr-1" />
                  Applied
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white border-0"
                    onClick={() => setResultImage(null)}
                    data-testid="clear-result-btn"
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-primary hover:bg-primary-hover text-white"
                    data-testid="download-result-btn"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              </motion.div>
            ) : selectedCharacter ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative max-w-lg w-full"
                data-testid="character-preview"
              >
                <img 
                  src={selectedCharacter.base_image} 
                  alt={selectedCharacter.name}
                  className="w-full aspect-[3/4] object-cover"
                />
                <div className="absolute top-4 left-4 px-3 py-1 bg-black/70 backdrop-blur-sm">
                  <span className="font-mono text-xs uppercase tracking-wider">{selectedCharacter.name}</span>
                </div>
                
                {/* Lock indicators */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  {settings.face_lock && (
                    <div className="w-8 h-8 bg-black/70 backdrop-blur-sm flex items-center justify-center" title="Face Locked">
                      <Lock className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  {settings.pose_lock && (
                    <div className="w-8 h-8 bg-black/70 backdrop-blur-sm flex items-center justify-center" title="Pose Locked">
                      <Lock className="w-4 h-4 text-secondary" />
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="empty-state"
                data-testid="empty-canvas"
              >
                <User className="w-16 h-16" />
                <h3 className="font-secondary text-xl text-zinc-400 mt-4">Select a Character</h3>
                <p className="text-sm text-zinc-600 mt-2 max-w-xs">
                  Choose a character from the left panel to start dressing
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Part Selector */}
        <div className="p-4 border-t border-zinc-800/30">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {PARTS.map((part) => (
              <button
                key={part.id}
                onClick={() => togglePart(part.id)}
                className={`part-toggle ${selectedParts.includes(part.id) ? "active" : ""}`}
                data-testid={`part-toggle-${part.id}`}
              >
                {part.label}
              </button>
            ))}
          </div>
        </div>

        {/* Apply Button */}
        <div className="p-6 border-t border-zinc-800/30">
          <Button
            onClick={applyDressing}
            disabled={!selectedCharacter || !selectedOutfit || processing}
            className="w-full h-14 bg-primary hover:bg-primary-hover text-white font-mono uppercase tracking-widest btn-primary disabled:opacity-50"
            data-testid="apply-dressing-btn"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Apply Outfit
                <ArrowRight className="w-5 h-5 ml-3" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Right Panel - Outfits */}
      <div className="border-l border-zinc-800/50 bg-[#0a0a0a] flex flex-col">
        <div className="p-6 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <Shirt className="w-5 h-5 text-zinc-400" />
            <h2 className="font-secondary text-xl">Outfits</h2>
          </div>
          <p className="text-xs text-zinc-500 mt-2 font-mono uppercase tracking-wider">
            Select an outfit
          </p>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 grid grid-cols-2 gap-3">
            {outfits.map((outfit) => (
              <motion.div
                key={outfit.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedOutfit(outfit)}
                className={`asset-card cursor-pointer ${selectedOutfit?.id === outfit.id ? "selected" : ""}`}
                data-testid={`outfit-card-${outfit.id}`}
              >
                <img src={outfit.source_image} alt={outfit.name} loading="lazy" />
                <div className="overlay flex flex-col justify-end p-3">
                  <span className="text-xs font-medium truncate">{outfit.name}</span>
                </div>
                {selectedOutfit?.id === outfit.id && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </ScrollArea>

        {/* Quick Settings */}
        <div className="p-4 border-t border-zinc-800/50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Precision</span>
              <Switch 
                checked={settings.precision_mode}
                onCheckedChange={(v) => setSettings(s => ({...s, precision_mode: v}))}
                data-testid="precision-mode-switch"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Face Lock</span>
              <Switch 
                checked={settings.face_lock}
                onCheckedChange={(v) => setSettings(s => ({...s, face_lock: v}))}
                data-testid="face-lock-switch"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
