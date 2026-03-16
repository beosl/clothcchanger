import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Shirt, 
  ArrowRight, 
  ArrowLeft,
  Loader2, 
  Check, 
  Upload,
  X,
  Sparkles,
  PersonStanding,
  RotateCcw,
  Lock,
  Unlock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import api from "@/lib/api";

// Clothing parts
const CLOTHING_PARTS = [
  { id: "upper", name: "Üst", description: "Tişört, gömlek, kazak", icon: "👕" },
  { id: "lower", name: "Alt", description: "Pantolon, etek, şort", icon: "👖" },
  { id: "dress", name: "Elbise", description: "Tek parça elbise", icon: "👗" },
  { id: "jacket", name: "Ceket", description: "Mont, blazer, hırka", icon: "🧥" },
  { id: "shoes", name: "Ayakkabı", description: "Spor, topuklu, bot", icon: "👟" },
  { id: "accessories", name: "Aksesuar", description: "Çanta, şapka, takı", icon: "👜" },
];

// Preset poses
const POSE_PRESETS = [
  { id: "original", name: "Orijinal Poz", description: "Karakterin kendi pozunu koru", icon: "🎯" },
  { id: "standing_front", name: "Ayakta Önden", description: "Düz duruş, kameraya bakıyor", icon: "🧍" },
  { id: "standing_side", name: "Ayakta Yandan", description: "Profil görünüm", icon: "🚶" },
  { id: "walking", name: "Yürüyüş", description: "Doğal yürüyüş pozu", icon: "🚶‍♀️" },
  { id: "sitting", name: "Oturma", description: "Sandalyede oturmuş", icon: "🪑" },
  { id: "leaning", name: "Yaslanmış", description: "Duvara yaslanmış", icon: "🧘" },
  { id: "arms_crossed", name: "Kollar Kavuşuk", description: "Kollar göğüste kavuşuk", icon: "💪" },
  { id: "hands_pocket", name: "Eller Cepte", description: "Rahat duruş, eller cepte", icon: "🤙" },
  { id: "fashion_pose", name: "Moda Pozu", description: "Profesyonel moda çekimi pozu", icon: "✨" },
  { id: "casual", name: "Rahat Poz", description: "Doğal ve rahat duruş", icon: "😊" },
  { id: "confident", name: "Özgüvenli", description: "Güçlü ve özgüvenli duruş", icon: "💫" },
];

// Lock settings
const LOCK_SETTINGS = [
  { id: "face_lock", name: "Yüz", icon: "👤" },
  { id: "body_lock", name: "Vücut", icon: "🧍" },
  { id: "background_lock", name: "Arkaplan", icon: "🖼️" },
  { id: "lighting_lock", name: "Işık", icon: "💡" },
];

export default function DressingRoom() {
  const [step, setStep] = useState(1); // 1: Character, 2: Outfit+Parts, 3: Pose, 4: Result
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [outfitImage, setOutfitImage] = useState(null);
  const [selectedParts, setSelectedParts] = useState(["upper", "lower"]);
  const [selectedPose, setSelectedPose] = useState("original");
  const [settings, setSettings] = useState({
    face_lock: true,
    body_lock: true,
    background_lock: true,
    lighting_lock: true,
    pose_lock: true
  });
  const [resultImage, setResultImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef(null);

  const loadCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getCharacters();
      setCharacters(response.data);
      
      if (response.data.length === 0) {
        await api.seedData();
        const newResponse = await api.getCharacters();
        setCharacters(newResponse.data);
      }
    } catch (error) {
      console.error("Failed to load characters:", error);
      toast.error("Karakterler yüklenemedi");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOutfitImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlInput = (url) => {
    if (url.startsWith("http")) {
      setOutfitImage(url);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOutfitImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const togglePart = (partId) => {
    setSelectedParts(prev => 
      prev.includes(partId) 
        ? prev.filter(p => p !== partId)
        : [...prev, partId]
    );
  };

  const selectCharacter = (char) => {
    setSelectedCharacter(char);
    setStep(2);
  };

  const goToStep = (stepNum) => {
    if (stepNum === 1) {
      setSelectedCharacter(null);
      setOutfitImage(null);
      setSelectedParts(["upper", "lower"]);
      setSelectedPose("original");
      setResultImage(null);
    } else if (stepNum === 2 && !selectedCharacter) {
      return;
    } else if (stepNum === 3 && (!outfitImage || selectedParts.length === 0)) {
      return;
    }
    setStep(stepNum);
  };

  const generateResult = async () => {
    if (!selectedCharacter || !outfitImage) {
      toast.error("Karakter ve kombin seçilmeli");
      return;
    }
    if (selectedParts.length === 0) {
      toast.error("En az bir giysi parçası seçin");
      return;
    }

    setProcessing(true);
    setStep(4);
    toast.info("AI görüntü oluşturuyor... 30-60 saniye sürebilir", { duration: 5000 });

    try {
      const response = await api.generateWithPose({
        character_image: selectedCharacter.base_image,
        outfit_image: outfitImage,
        pose: selectedPose,
        parts: selectedParts,
        settings: settings,
        character_name: selectedCharacter.name
      });

      const data = response.data;
      setResultImage(data.result_image);

      if (data.status === "success") {
        toast.success("Görüntü başarıyla oluşturuldu!");
      } else if (data.status === "budget_exceeded") {
        toast.warning(data.message, { duration: 8000 });
      } else {
        toast.info(data.message || "İşlem tamamlandı");
      }
    } catch (error) {
      console.error("Generation failed:", error);
      toast.error("Görüntü oluşturulamadı");
      setStep(3);
    }
    setProcessing(false);
  };

  const toggleSetting = (settingId) => {
    setSettings(prev => ({ ...prev, [settingId]: !prev[settingId] }));
  };

  const reset = () => {
    setStep(1);
    setSelectedCharacter(null);
    setOutfitImage(null);
    setSelectedParts(["upper", "lower"]);
    setSelectedPose("original");
    setSettings({
      face_lock: true,
      body_lock: true,
      background_lock: true,
      lighting_lock: true,
      pose_lock: true
    });
    setResultImage(null);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#050505]" data-testid="dressing-room">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800/30">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-secondary text-3xl">AI Giysi Değiştirici</h1>
              <p className="text-zinc-500 mt-1 text-sm">Karaktere kombin giydir</p>
            </div>
            
            {/* Step Indicator */}
            <div className="flex items-center gap-2">
              {[
                { num: 1, label: "Karakter" },
                { num: 2, label: "Kombin" },
                { num: 3, label: "Poz" },
                { num: 4, label: "Sonuç" },
              ].map((s, i) => (
                <div key={s.num} className="flex items-center">
                  <button
                    onClick={() => goToStep(s.num)}
                    disabled={s.num > step + 1}
                    className={`w-8 h-8 flex items-center justify-center font-mono text-xs transition-all
                      ${step >= s.num ? "bg-primary text-white" : "bg-zinc-800 text-zinc-500"}
                      ${step === s.num ? "ring-2 ring-primary ring-offset-2 ring-offset-[#050505]" : ""}
                      disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                  </button>
                  {i < 3 && (
                    <div className={`w-8 h-0.5 ${step > s.num ? "bg-primary" : "bg-zinc-800"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Select Character */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <User className="w-12 h-12 mx-auto text-primary mb-4" />
                  <h2 className="font-secondary text-2xl">Karakter Seç</h2>
                  <p className="text-zinc-500 mt-2">Kıyafet giydirmek istediğiniz kişiyi seçin</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {characters.map((char) => (
                    <motion.div
                      key={char.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => selectCharacter(char)}
                      className="cursor-pointer group"
                      data-testid={`select-character-${char.id}`}
                    >
                      <div className="asset-card">
                        <img src={char.base_image} alt={char.name} loading="lazy" />
                        <div className="overlay flex items-end p-3">
                          <span className="text-sm font-medium">{char.name}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: Upload Outfit + Select Parts */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <Shirt className="w-12 h-12 mx-auto text-secondary mb-4" />
                  <h2 className="font-secondary text-2xl">Kombin Yükle & Parça Seç</h2>
                  <p className="text-zinc-500 mt-2">Kombini yükleyin ve değiştirilecek parçaları seçin</p>
                </div>

                <div className="grid grid-cols-2 gap-8 max-w-3xl mx-auto">
                  {/* Selected Character Preview */}
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">Seçilen Karakter</h3>
                    <div className="relative">
                      <img 
                        src={selectedCharacter?.base_image} 
                        alt={selectedCharacter?.name}
                        className="w-full aspect-[3/4] object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                        <span className="font-medium">{selectedCharacter?.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Outfit Upload */}
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-3">Kombin</h3>
                    {outfitImage ? (
                      <div className="relative">
                        <img 
                          src={outfitImage} 
                          alt="Outfit"
                          className="w-full aspect-[3/4] object-cover"
                        />
                        <button
                          onClick={() => setOutfitImage(null)}
                          className="absolute top-2 right-2 w-8 h-8 bg-black/60 flex items-center justify-center hover:bg-black/80"
                          data-testid="clear-outfit-btn"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => fileInputRef.current?.click()}
                        className="upload-zone aspect-[3/4] flex flex-col items-center justify-center cursor-pointer"
                        data-testid="outfit-upload-zone"
                      >
                        <Upload className="w-10 h-10 text-zinc-500 mb-4" />
                        <span className="text-sm text-zinc-400">Sürükle bırak veya tıkla</span>
                        <span className="text-xs text-zinc-600 mt-2">PNG, JPG</span>
                      </div>
                    )}
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    
                    <div className="mt-3">
                      <Input
                        placeholder="veya URL yapıştır"
                        onChange={(e) => handleUrlInput(e.target.value)}
                        className="bg-transparent border-zinc-700 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Part Selection */}
                <div className="max-w-3xl mx-auto mt-8">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-4 text-center">
                    Değiştirilecek Parçalar
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {CLOTHING_PARTS.map((part) => (
                      <motion.button
                        key={part.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => togglePart(part.id)}
                        className={`p-3 text-center transition-all border ${
                          selectedParts.includes(part.id)
                            ? "border-primary bg-primary/20 text-white"
                            : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                        }`}
                        data-testid={`part-${part.id}`}
                      >
                        <div className="text-2xl mb-1">{part.icon}</div>
                        <div className="text-xs font-medium">{part.name}</div>
                        {selectedParts.includes(part.id) && (
                          <Check className="w-3 h-3 mx-auto mt-1 text-primary" />
                        )}
                      </motion.button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600 text-center mt-3">
                    Seçili: {selectedParts.length} parça
                  </p>
                </div>

                {/* Navigation */}
                <div className="flex justify-between max-w-3xl mx-auto pt-6">
                  <Button
                    variant="ghost"
                    onClick={() => goToStep(1)}
                    className="text-zinc-400"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Geri
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!outfitImage || selectedParts.length === 0}
                    className="bg-primary hover:bg-primary-hover"
                    data-testid="next-to-pose-btn"
                  >
                    Poz Seç
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Select Pose */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <PersonStanding className="w-12 h-12 mx-auto text-accent mb-4" />
                  <h2 className="font-secondary text-2xl">Poz Seç</h2>
                  <p className="text-zinc-500 mt-2">Karakterin hangi pozda görünmesini istiyorsunuz?</p>
                </div>

                {/* Preview Cards */}
                <div className="flex justify-center items-center gap-4 mb-6">
                  <div className="w-32">
                    <h4 className="text-[10px] font-mono text-zinc-500 mb-2 text-center">KARAKTER</h4>
                    <img src={selectedCharacter?.base_image} alt="" className="w-full aspect-[3/4] object-cover" />
                  </div>
                  <div className="text-center">
                    <ArrowRight className="w-5 h-5 text-primary mx-auto" />
                    <div className="text-[10px] text-zinc-600 mt-1">
                      {selectedParts.map(p => CLOTHING_PARTS.find(cp => cp.id === p)?.icon).join(" ")}
                    </div>
                  </div>
                  <div className="w-32">
                    <h4 className="text-[10px] font-mono text-zinc-500 mb-2 text-center">KOMBİN</h4>
                    <img src={outfitImage} alt="" className="w-full aspect-[3/4] object-cover" />
                  </div>
                </div>

                {/* Pose Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
                  {POSE_PRESETS.map((pose) => (
                    <motion.button
                      key={pose.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedPose(pose.id)}
                      className={`p-4 text-left transition-all border relative ${
                        selectedPose === pose.id
                          ? "border-primary bg-primary/10"
                          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                      }`}
                      data-testid={`pose-${pose.id}`}
                    >
                      <div className="text-2xl mb-2">{pose.icon}</div>
                      <h4 className="font-medium text-sm">{pose.name}</h4>
                      <p className="text-xs text-zinc-500 mt-1">{pose.description}</p>
                      {selectedPose === pose.id && (
                        <Check className="w-4 h-4 text-primary absolute top-2 right-2" />
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* Lock Settings */}
                <div className="max-w-4xl mx-auto mt-8 p-4 bg-zinc-900/50 border border-zinc-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-mono uppercase tracking-wider">Koruma Ayarları</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {LOCK_SETTINGS.map((setting) => (
                      <div 
                        key={setting.id}
                        className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-700"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{setting.icon}</span>
                          <span className="text-sm">{setting.name}</span>
                        </div>
                        <Switch
                          checked={settings[setting.id]}
                          onCheckedChange={() => toggleSetting(setting.id)}
                          data-testid={`lock-${setting.id}`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600 mt-3 text-center">
                    Açık olan ayarlar orijinalden korunur
                  </p>
                </div>

                {/* Navigation */}
                <div className="flex justify-between max-w-4xl mx-auto pt-6">
                  <Button
                    variant="ghost"
                    onClick={() => goToStep(2)}
                    className="text-zinc-400"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Geri
                  </Button>
                  <Button
                    onClick={generateResult}
                    className="bg-primary hover:bg-primary-hover px-8"
                    data-testid="generate-btn"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Oluştur
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Result */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <Sparkles className="w-12 h-12 mx-auto text-primary mb-4" />
                  <h2 className="font-secondary text-2xl">
                    {processing ? "Oluşturuluyor..." : "Sonuç"}
                  </h2>
                  {!processing && (
                    <p className="text-zinc-500 mt-2 text-sm">
                      Değiştirilen: {selectedParts.map(p => CLOTHING_PARTS.find(cp => cp.id === p)?.name).join(", ")}
                    </p>
                  )}
                </div>

                <div className="max-w-4xl mx-auto">
                  {processing ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="relative w-24 h-24 mb-8">
                        <div className="absolute inset-0 border-4 border-zinc-800 animate-spin" style={{ animationDuration: "3s" }} />
                        <div className="absolute inset-2 border-4 border-primary animate-spin" style={{ animationDuration: "2s", animationDirection: "reverse" }} />
                        <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-primary" />
                      </div>
                      <p className="text-zinc-400">AI görüntü oluşturuyor...</p>
                      <p className="text-xs text-zinc-600 mt-2">Bu işlem 30-60 saniye sürebilir</p>
                    </div>
                  ) : resultImage ? (
                    <div className="grid grid-cols-3 gap-6">
                      {/* Original Character */}
                      <div>
                        <h4 className="text-xs font-mono text-zinc-500 mb-2 text-center">ORİJİNAL</h4>
                        <img src={selectedCharacter?.base_image} alt="" className="w-full aspect-[3/4] object-cover" />
                      </div>
                      
                      {/* Result */}
                      <div>
                        <h4 className="text-xs font-mono text-primary mb-2 text-center">SONUÇ</h4>
                        <div className="relative">
                          <img src={resultImage} alt="Result" className="w-full aspect-[3/4] object-cover" />
                          <div className="absolute top-2 right-2 px-2 py-1 bg-success text-xs font-mono">
                            AI
                          </div>
                        </div>
                      </div>
                      
                      {/* Outfit Used */}
                      <div>
                        <h4 className="text-xs font-mono text-zinc-500 mb-2 text-center">KOMBİN</h4>
                        <img src={outfitImage} alt="" className="w-full aspect-[3/4] object-cover" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-zinc-500">
                      Sonuç yüklenemedi
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!processing && (
                  <div className="flex justify-center gap-4 pt-6">
                    <Button
                      variant="outline"
                      onClick={reset}
                      className="border-zinc-700"
                      data-testid="start-over-btn"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Baştan Başla
                    </Button>
                    <Button
                      onClick={() => setStep(2)}
                      className="bg-zinc-800 hover:bg-zinc-700"
                    >
                      Farklı Kombin Dene
                    </Button>
                    <Button
                      onClick={() => setStep(3)}
                      className="bg-primary hover:bg-primary-hover"
                    >
                      Farklı Poz Dene
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
