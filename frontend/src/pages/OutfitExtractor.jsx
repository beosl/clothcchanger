import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Scissors, 
  Upload, 
  Loader2, 
  Check,
  X,
  ArrowRight,
  Shirt,
  Image as ImageIcon,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";

const CLOTHING_PARTS = [
  { id: "upper_wear", label: "Upper Wear", color: "bg-primary" },
  { id: "lower_wear", label: "Lower Wear", color: "bg-secondary" },
  { id: "shoes", label: "Shoes", color: "bg-accent" },
  { id: "jacket", label: "Jacket", color: "bg-blue-500" },
  { id: "dress", label: "Dress", color: "bg-pink-500" },
  { id: "accessories", label: "Accessories", color: "bg-amber-500" },
];

export default function OutfitExtractor() {
  const [sourceImage, setSourceImage] = useState("");
  const [outfitName, setOutfitName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractedParts, setExtractedParts] = useState([]);
  const [step, setStep] = useState(1); // 1: upload, 2: extracting, 3: results
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlInput = (url) => {
    if (url.startsWith("http")) {
      setSourceImage(url);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const extractOutfit = async () => {
    if (!sourceImage) {
      toast.error("Please add an image first");
      return;
    }

    setStep(2);
    setExtracting(true);
    setExtractionProgress(0);

    // Simulate extraction progress
    const progressInterval = setInterval(() => {
      setExtractionProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 300);

    // Simulate extraction (in production this would call Fal.ai)
    await new Promise(resolve => setTimeout(resolve, 2500));
    clearInterval(progressInterval);
    
    // Mock extracted parts
    setExtractedParts([
      { id: "upper_wear", label: "Upper Wear", detected: true },
      { id: "lower_wear", label: "Lower Wear", detected: true },
      { id: "shoes", label: "Shoes", detected: Math.random() > 0.3 },
      { id: "accessories", label: "Accessories", detected: Math.random() > 0.5 },
    ].filter(p => p.detected));

    setExtractionProgress(100);
    setExtracting(false);
    setStep(3);
    toast.success("Outfit extracted successfully!");
  };

  const saveOutfit = async () => {
    if (!outfitName.trim()) {
      toast.error("Please enter an outfit name");
      return;
    }

    setSaving(true);
    try {
      await api.createOutfit({
        name: outfitName,
        source_image: sourceImage,
      });
      toast.success("Outfit saved to library!");
      navigate("/outfits");
    } catch (error) {
      console.error("Failed to save outfit:", error);
      toast.error("Failed to save outfit");
    }
    setSaving(false);
  };

  const reset = () => {
    setSourceImage("");
    setOutfitName("");
    setExtractedParts([]);
    setExtractionProgress(0);
    setStep(1);
  };

  return (
    <div className="h-full flex flex-col" data-testid="outfit-extractor">
      {/* Header */}
      <div className="p-8 border-b border-zinc-800/30">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-secondary text-4xl">Outfit Extractor</h1>
          <p className="text-zinc-500 mt-2 font-mono text-sm uppercase tracking-wider">
            Extract clothing parts from any image
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          {/* Step Indicator */}
          <div className="flex items-center gap-4 mb-12">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-3">
                <div className={`w-10 h-10 flex items-center justify-center font-mono text-sm transition-colors
                  ${step >= s ? "bg-primary text-white" : "bg-zinc-800 text-zinc-500"}`}
                >
                  {step > s ? <Check className="w-5 h-5" /> : s}
                </div>
                <span className={`font-mono text-xs uppercase tracking-wider ${step >= s ? "text-white" : "text-zinc-600"}`}>
                  {s === 1 ? "Upload" : s === 2 ? "Extract" : "Save"}
                </span>
                {s < 3 && <div className={`w-16 h-px ${step > s ? "bg-primary" : "bg-zinc-800"}`} />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {sourceImage ? (
                  <div className="grid grid-cols-2 gap-8">
                    <div className="relative">
                      <img 
                        src={sourceImage} 
                        alt="Source" 
                        className="w-full aspect-[3/4] object-cover"
                      />
                      <button
                        onClick={() => setSourceImage("")}
                        className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
                        data-testid="clear-source-btn"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="flex flex-col justify-center">
                      <h2 className="font-secondary text-2xl mb-6">Ready to Extract</h2>
                      <p className="text-zinc-400 mb-8">
                        Our AI will analyze this image and extract all detectable clothing parts including upper wear, lower wear, shoes, and accessories.
                      </p>
                      
                      <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-3 text-sm text-zinc-500">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <span>AI-powered segmentation</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-zinc-500">
                          <Shirt className="w-4 h-4 text-secondary" />
                          <span>Multiple clothing parts detection</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-zinc-500">
                          <ImageIcon className="w-4 h-4 text-accent" />
                          <span>Transparent PNG export</span>
                        </div>
                      </div>
                      
                      <Button
                        onClick={extractOutfit}
                        className="h-14 bg-primary hover:bg-primary-hover font-mono uppercase tracking-widest"
                        data-testid="start-extraction-btn"
                      >
                        <Scissors className="w-5 h-5 mr-3" />
                        Extract Outfit
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="upload-zone p-16 flex flex-col items-center justify-center cursor-pointer min-h-[400px]"
                    data-testid="extraction-upload-zone"
                  >
                    <Upload className="w-16 h-16 text-zinc-500 mb-6" />
                    <h3 className="font-secondary text-2xl text-zinc-300 mb-2">
                      Upload Image
                    </h3>
                    <p className="text-zinc-500 mb-6">
                      Drag and drop or click to browse
                    </p>
                    <p className="text-xs text-zinc-600 font-mono uppercase tracking-wider">
                      PNG, JPG, WEBP up to 10MB
                    </p>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="extraction-file-input"
                />
                
                {!sourceImage && (
                  <div className="mt-6">
                    <div className="flex items-center gap-3 text-xs text-zinc-600 mb-3">
                      <div className="h-px flex-1 bg-zinc-800" />
                      <span className="font-mono uppercase">Or paste URL</span>
                      <div className="h-px flex-1 bg-zinc-800" />
                    </div>
                    <Input
                      placeholder="https://example.com/image.jpg"
                      onChange={(e) => handleUrlInput(e.target.value)}
                      className="bg-transparent border-zinc-700 focus:border-primary"
                      data-testid="extraction-url-input"
                    />
                  </div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="extracting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-16"
                data-testid="extraction-progress"
              >
                <div className="relative w-32 h-32 mb-8">
                  <div className="absolute inset-0 border-4 border-zinc-800 animate-spin" style={{ animationDuration: "3s" }} />
                  <div className="absolute inset-2 border-4 border-primary animate-spin" style={{ animationDuration: "2s", animationDirection: "reverse" }} />
                  <div className="absolute inset-4 flex items-center justify-center">
                    <Scissors className="w-8 h-8 text-primary" />
                  </div>
                </div>
                
                <h2 className="font-secondary text-2xl mb-4">Extracting Outfit</h2>
                <p className="text-zinc-500 mb-8 text-center max-w-md">
                  AI is analyzing the image and detecting clothing parts...
                </p>
                
                <div className="w-full max-w-md">
                  <Progress value={extractionProgress} className="h-2" />
                  <div className="flex justify-between mt-2 text-xs text-zinc-600 font-mono">
                    <span>Processing</span>
                    <span>{Math.round(extractionProgress)}%</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                data-testid="extraction-results"
              >
                <div className="grid grid-cols-2 gap-8">
                  <div className="relative">
                    <img 
                      src={sourceImage} 
                      alt="Source" 
                      className="w-full aspect-[3/4] object-cover"
                    />
                    <div className="absolute top-4 left-4 px-3 py-1 bg-success text-white font-mono text-xs uppercase tracking-wider">
                      <Check className="w-3 h-3 inline mr-1" />
                      Extracted
                    </div>
                  </div>
                  
                  <div className="flex flex-col">
                    <h2 className="font-secondary text-2xl mb-6">Extraction Complete</h2>
                    
                    <div className="mb-6">
                      <label className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2 block">
                        Outfit Name
                      </label>
                      <Input
                        value={outfitName}
                        onChange={(e) => setOutfitName(e.target.value)}
                        placeholder="Enter outfit name"
                        className="bg-transparent border-zinc-700 focus:border-primary"
                        data-testid="outfit-name-input"
                      />
                    </div>
                    
                    <div className="mb-8">
                      <label className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3 block">
                        Detected Parts
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {extractedParts.map((part) => {
                          const partInfo = CLOTHING_PARTS.find(p => p.id === part.id);
                          return (
                            <Badge 
                              key={part.id}
                              className={`${partInfo?.color || "bg-zinc-700"} text-white font-mono uppercase tracking-wider`}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              {part.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="glass-card p-4 mb-8">
                      <p className="text-xs text-zinc-400">
                        <span className="text-primary font-semibold">Note:</span> Image processing is MOCKED. 
                        In production, Fal.ai will provide actual segmentation and part extraction.
                      </p>
                    </div>
                    
                    <div className="mt-auto flex gap-3">
                      <Button
                        variant="outline"
                        onClick={reset}
                        className="flex-1 border-zinc-700 hover:bg-zinc-800"
                        data-testid="extract-another-btn"
                      >
                        Extract Another
                      </Button>
                      <Button
                        onClick={saveOutfit}
                        disabled={saving || !outfitName.trim()}
                        className="flex-1 bg-primary hover:bg-primary-hover"
                        data-testid="save-outfit-btn"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        Save to Library
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
