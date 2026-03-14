import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Settings, 
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Palette,
  Cpu,
  Save,
  Loader2,
  Check,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import api from "@/lib/api";

const SETTINGS_CONFIG = [
  {
    id: "precision_mode",
    label: "Precision Mode",
    description: "Enforce strict identity preservation with no face/body changes",
    icon: Cpu,
    category: "mode"
  },
  {
    id: "face_lock",
    label: "Face Lock",
    description: "Preserve facial features and expressions during outfit transfer",
    icon: Lock,
    category: "identity"
  },
  {
    id: "body_lock",
    label: "Body Lock",
    description: "Maintain body proportions and shape during processing",
    icon: Lock,
    category: "identity"
  },
  {
    id: "pose_lock",
    label: "Pose Lock",
    description: "Keep original body pose and skeleton unchanged",
    icon: Lock,
    category: "identity"
  },
  {
    id: "lighting_lock",
    label: "Lighting Lock",
    description: "Match output lighting with original image conditions",
    icon: Eye,
    category: "visual"
  },
  {
    id: "background_lock",
    label: "Background Lock",
    description: "Preserve original background during outfit transfer",
    icon: Palette,
    category: "visual"
  }
];

const CATEGORIES = {
  mode: { label: "Processing Mode", description: "Control overall processing behavior" },
  identity: { label: "Identity Preservation", description: "Lock facial and body features" },
  visual: { label: "Visual Consistency", description: "Maintain lighting and background" }
};

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    precision_mode: true,
    face_lock: true,
    body_lock: true,
    pose_lock: true,
    lighting_lock: true,
    background_lock: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getSettings();
      const data = response.data;
      setSettings(data);
      setOriginalSettings(data);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (originalSettings) {
      const changed = Object.keys(settings).some(
        key => settings[key] !== originalSettings[key]
      );
      setHasChanges(changed);
    }
  }, [settings, originalSettings]);

  const updateSetting = (id, value) => {
    setSettings(prev => ({ ...prev, [id]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      setOriginalSettings(settings);
      setHasChanges(false);
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    }
    setSaving(false);
  };

  const resetToDefaults = () => {
    const defaults = {
      precision_mode: true,
      face_lock: true,
      body_lock: true,
      pose_lock: true,
      lighting_lock: true,
      background_lock: true
    };
    setSettings(defaults);
  };

  const groupedSettings = SETTINGS_CONFIG.reduce((acc, setting) => {
    if (!acc[setting.category]) acc[setting.category] = [];
    acc[setting.category].push(setting);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="settings-page">
      {/* Header */}
      <div className="p-8 border-b border-zinc-800/30">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div>
            <h1 className="font-secondary text-4xl">Settings</h1>
            <p className="text-zinc-500 mt-2 font-mono text-sm uppercase tracking-wider">
              Configure dressing room behavior
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              className="border-zinc-700 hover:bg-zinc-800"
              data-testid="reset-settings-btn"
            >
              Reset to Defaults
            </Button>
            <Button
              onClick={saveSettings}
              disabled={!hasChanges || saving}
              className="bg-primary hover:bg-primary-hover"
              data-testid="save-settings-btn"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : hasChanges ? (
                <Save className="w-4 h-4 mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {hasChanges ? "Save Changes" : "Saved"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-8">
          <div className="max-w-3xl mx-auto space-y-12">
            {Object.entries(groupedSettings).map(([category, categorySettings]) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6"
              >
                <div className="mb-6">
                  <h2 className="font-secondary text-xl">{CATEGORIES[category].label}</h2>
                  <p className="text-sm text-zinc-500 mt-1">{CATEGORIES[category].description}</p>
                </div>
                
                <div className="space-y-1">
                  {categorySettings.map((setting) => (
                    <div 
                      key={setting.id}
                      className="setting-row"
                      data-testid={`setting-row-${setting.id}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 flex items-center justify-center ${
                          settings[setting.id] ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-500"
                        }`}>
                          <setting.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-medium">{setting.label}</h3>
                          <p className="text-sm text-zinc-500 mt-0.5">{setting.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings[setting.id]}
                        onCheckedChange={(v) => updateSetting(setting.id, v)}
                        data-testid={`setting-switch-${setting.id}`}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}

            {/* Info Card */}
            <div className="glass-card p-6 border-l-4 border-primary">
              <div className="flex gap-4">
                <Info className="w-6 h-6 text-primary flex-shrink-0" />
                <div>
                  <h3 className="font-medium mb-2">AI Processing</h3>
                  <p className="text-sm text-zinc-400">
                    This system uses <span className="text-primary font-semibold">GPT-5.2</span> as the 
                    workflow controller and <span className="text-secondary font-semibold">Gemini Nano Banana</span> for 
                    AI image generation. Image generation may take up to 60 seconds. All processing uses
                    your Emergent Universal Key balance.
                  </p>
                </div>
              </div>
            </div>

            {/* Priority Guide */}
            <div className="glass-card p-6">
              <h2 className="font-secondary text-xl mb-4">Processing Priority</h2>
              <p className="text-sm text-zinc-500 mb-6">
                When conflicts arise, the system prioritizes in this order:
              </p>
              <div className="space-y-3">
                {[
                  { num: 1, label: "Identity Preservation", desc: "Overall person recognition" },
                  { num: 2, label: "Face Preservation", desc: "Facial features unchanged" },
                  { num: 3, label: "Body Preservation", desc: "Body shape and proportions" },
                  { num: 4, label: "Pose Preservation", desc: "Original pose maintained" },
                  { num: 5, label: "Lighting Preservation", desc: "Match original lighting" },
                  { num: 6, label: "Clothing Accuracy", desc: "Correct outfit placement" },
                  { num: 7, label: "Realism", desc: "Photorealistic output" },
                ].map((item) => (
                  <div key={item.num} className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-zinc-800 flex items-center justify-center font-mono text-sm text-zinc-400">
                      {item.num}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-zinc-600 ml-2 text-sm">• {item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
