import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Library, 
  Plus, 
  Trash2, 
  Loader2, 
  Edit,
  X,
  Check,
  Eye,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";

export default function OutfitLibrary() {
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [selectedPreview, setSelectedPreview] = useState(null);
  const navigate = useNavigate();

  const loadOutfits = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getOutfits();
      setOutfits(response.data);
    } catch (error) {
      console.error("Failed to load outfits:", error);
      toast.error("Failed to load outfits");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOutfits();
  }, [loadOutfits]);

  const deleteOutfit = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteOutfit(deleteTarget.id);
      toast.success("Outfit deleted");
      setDeleteTarget(null);
      loadOutfits();
    } catch (error) {
      console.error("Failed to delete outfit:", error);
      toast.error("Failed to delete outfit");
    }
  };

  const updateOutfitName = async (id) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await api.updateOutfit(id, editName);
      toast.success("Name updated");
      setEditingId(null);
      loadOutfits();
    } catch (error) {
      console.error("Failed to update outfit:", error);
      toast.error("Failed to update name");
    }
  };

  const startEditing = (outfit) => {
    setEditingId(outfit.id);
    setEditName(outfit.name);
  };

  const getPartsList = (parts) => {
    if (!parts) return [];
    // Handle new format with detailed part objects
    const partKeys = ['upper_wear', 'lower_wear', 'footwear', 'accessories'];
    return partKeys.filter(key => parts[key] && Object.keys(parts[key]).length > 0);
  };

  const getPartDescription = (parts, partKey) => {
    if (!parts || !parts[partKey]) return null;
    const part = parts[partKey];
    if (typeof part === 'string') return part;
    return `${part.type || ''} - ${part.color || ''} ${part.pattern || ''}`.trim();
  };

  return (
    <div className="h-full flex flex-col" data-testid="outfit-library">
      {/* Header */}
      <div className="p-8 border-b border-zinc-800/30">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="font-secondary text-4xl">Outfit Library</h1>
            <p className="text-zinc-500 mt-2 font-mono text-sm uppercase tracking-wider">
              {outfits.length} outfits available
            </p>
          </div>
          <Button
            onClick={() => navigate("/extract")}
            className="bg-primary hover:bg-primary-hover text-white px-6 py-2 font-mono uppercase tracking-widest"
            data-testid="extract-new-outfit-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Extract New Outfit
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-8">
          <div className="max-w-6xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : outfits.length === 0 ? (
              <div className="empty-state py-20" data-testid="empty-outfits">
                <Library className="w-16 h-16" />
                <h3 className="font-secondary text-2xl text-zinc-400 mt-4">No Outfits Yet</h3>
                <p className="text-zinc-600 mt-2">Extract outfits from images to build your library</p>
                <Button
                  onClick={() => navigate("/extract")}
                  className="mt-6 bg-primary hover:bg-primary-hover"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Extract Outfit
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                <AnimatePresence>
                  {outfits.map((outfit, index) => (
                    <motion.div
                      key={outfit.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      className="group"
                      data-testid={`outfit-item-${outfit.id}`}
                    >
                      <div className="asset-card cursor-pointer" onClick={() => setSelectedPreview(outfit)}>
                        <img src={outfit.source_image} alt={outfit.name} loading="lazy" />
                        <div className="overlay">
                          <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedPreview(outfit); }}
                              className="w-8 h-8 bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                              data-testid={`preview-outfit-${outfit.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); startEditing(outfit); }}
                              className="w-8 h-8 bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                              data-testid={`edit-outfit-${outfit.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(outfit); }}
                              className="w-8 h-8 bg-destructive/80 backdrop-blur-sm flex items-center justify-center hover:bg-destructive transition-colors"
                              data-testid={`delete-outfit-${outfit.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="absolute bottom-3 left-3 right-3">
                            <div className="flex flex-wrap gap-1">
                              {getPartsList(outfit.parts).slice(0, 3).map((part) => (
                                <Badge 
                                  key={part}
                                  variant="secondary"
                                  className="bg-white/10 text-white text-[10px] font-mono uppercase"
                                >
                                  {part.replace("_", " ")}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        {editingId === outfit.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 text-sm bg-transparent border-zinc-700"
                              autoFocus
                              onKeyDown={(e) => e.key === "Enter" && updateOutfitName(outfit.id)}
                              data-testid={`edit-outfit-name-input-${outfit.id}`}
                            />
                            <button
                              onClick={() => updateOutfitName(outfit.id)}
                              className="p-1 hover:text-primary"
                              data-testid={`save-outfit-name-${outfit.id}`}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 hover:text-destructive"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <h3 className="font-medium text-sm truncate">{outfit.name}</h3>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800" data-testid="delete-outfit-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-secondary">Delete Outfit?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500">
              This will permanently delete "{deleteTarget?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-zinc-700 hover:bg-zinc-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteOutfit}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="confirm-delete-outfit-btn"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={!!selectedPreview} onOpenChange={() => setSelectedPreview(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-4xl p-0 overflow-hidden" data-testid="outfit-preview-dialog">
          {selectedPreview && (
            <div className="flex">
              <div className="w-1/2 flex flex-col">
                <div className="flex-1">
                  <img 
                    src={selectedPreview.source_image} 
                    alt={selectedPreview.name}
                    className="w-full aspect-[3/4] object-cover"
                  />
                </div>
                {selectedPreview.pack_image && selectedPreview.pack_image !== selectedPreview.source_image && (
                  <div className="p-2 bg-zinc-800/50">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2 text-center">Pinterest Style Pack</p>
                    <img 
                      src={selectedPreview.pack_image} 
                      alt="Outfit Pack"
                      className="w-full aspect-square object-cover"
                    />
                  </div>
                )}
              </div>
              <div className="w-1/2 p-8 flex flex-col overflow-auto max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="font-secondary text-3xl">{selectedPreview.name}</DialogTitle>
                  {selectedPreview.analysis_status && (
                    <Badge className={`w-fit mt-2 ${selectedPreview.analysis_status === 'analyzed' ? 'bg-success' : 'bg-zinc-700'}`}>
                      {selectedPreview.analysis_status}
                    </Badge>
                  )}
                </DialogHeader>
                
                <div className="mt-6 flex-1">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4">
                    Detected Clothing Parts
                  </h4>
                  
                  {/* Upper Wear */}
                  {selectedPreview.parts?.upper_wear && (
                    <div className="mb-4 p-3 bg-zinc-800/30 rounded">
                      <h5 className="text-xs font-mono text-primary mb-2">UPPER WEAR</h5>
                      <p className="text-sm text-zinc-300">
                        {selectedPreview.parts.upper_wear.type && <span className="font-medium">{selectedPreview.parts.upper_wear.type}</span>}
                        {selectedPreview.parts.upper_wear.color && <span> • {selectedPreview.parts.upper_wear.color}</span>}
                        {selectedPreview.parts.upper_wear.pattern && <span> • {selectedPreview.parts.upper_wear.pattern}</span>}
                      </p>
                      {selectedPreview.parts.upper_wear.details && (
                        <p className="text-xs text-zinc-500 mt-1">{selectedPreview.parts.upper_wear.details}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Lower Wear */}
                  {selectedPreview.parts?.lower_wear && (
                    <div className="mb-4 p-3 bg-zinc-800/30 rounded">
                      <h5 className="text-xs font-mono text-secondary mb-2">LOWER WEAR</h5>
                      <p className="text-sm text-zinc-300">
                        {selectedPreview.parts.lower_wear.type && <span className="font-medium">{selectedPreview.parts.lower_wear.type}</span>}
                        {selectedPreview.parts.lower_wear.color && <span> • {selectedPreview.parts.lower_wear.color}</span>}
                        {selectedPreview.parts.lower_wear.pattern && <span> • {selectedPreview.parts.lower_wear.pattern}</span>}
                      </p>
                      {selectedPreview.parts.lower_wear.details && (
                        <p className="text-xs text-zinc-500 mt-1">{selectedPreview.parts.lower_wear.details}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Footwear */}
                  {selectedPreview.parts?.footwear && (
                    <div className="mb-4 p-3 bg-zinc-800/30 rounded">
                      <h5 className="text-xs font-mono text-accent mb-2">FOOTWEAR</h5>
                      <p className="text-sm text-zinc-300">
                        {selectedPreview.parts.footwear.type && <span className="font-medium">{selectedPreview.parts.footwear.type}</span>}
                        {selectedPreview.parts.footwear.color && <span> • {selectedPreview.parts.footwear.color}</span>}
                      </p>
                    </div>
                  )}
                  
                  {/* Overall Style */}
                  {selectedPreview.parts?.overall_style && (
                    <div className="mt-4 p-3 border border-zinc-700 rounded">
                      <h5 className="text-xs font-mono text-zinc-500 mb-2">OVERALL STYLE</h5>
                      <p className="text-sm text-zinc-300">{selectedPreview.parts.overall_style}</p>
                    </div>
                  )}
                  
                  {/* Color Palette */}
                  {selectedPreview.parts?.color_palette && selectedPreview.parts.color_palette.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-xs font-mono text-zinc-500 mb-2">COLOR PALETTE</h5>
                      <div className="flex flex-wrap gap-2">
                        {selectedPreview.parts.color_palette.map((color, i) => (
                          <Badge key={i} variant="outline" className="border-zinc-600">{color}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 flex gap-3">
                  <Button 
                    variant="outline"
                    className="flex-1 border-zinc-700 hover:bg-zinc-800"
                    onClick={() => setSelectedPreview(null)}
                  >
                    Close
                  </Button>
                  <Button 
                    className="flex-1 bg-primary hover:bg-primary-hover"
                    onClick={() => { setSelectedPreview(null); navigate("/"); }}
                    data-testid="use-outfit-btn"
                  >
                    Use Outfit
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
