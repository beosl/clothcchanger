import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  Plus, 
  Trash2, 
  Loader2, 
  Upload,
  Edit,
  X,
  Check,
  Image as ImageIcon,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import api from "@/lib/api";

export default function CharacterManager() {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [newCharacter, setNewCharacter] = useState({ name: "", base_image: "" });
  const [submitting, setSubmitting] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState(null);
  const fileInputRef = useRef(null);

  const loadCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getCharacters();
      setCharacters(response.data);
    } catch (error) {
      console.error("Failed to load characters:", error);
      toast.error("Failed to load characters");
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
        setNewCharacter(prev => ({ ...prev, base_image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlInput = (url) => {
    setNewCharacter(prev => ({ ...prev, base_image: url }));
  };

  const createCharacter = async () => {
    if (!newCharacter.name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!newCharacter.base_image) {
      toast.error("Please add an image");
      return;
    }

    setSubmitting(true);
    try {
      await api.createCharacter(newCharacter);
      toast.success("Character created!");
      setShowAddDialog(false);
      setNewCharacter({ name: "", base_image: "" });
      loadCharacters();
    } catch (error) {
      console.error("Failed to create character:", error);
      toast.error("Failed to create character");
    }
    setSubmitting(false);
  };

  const deleteCharacter = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteCharacter(deleteTarget.id);
      toast.success("Character deleted");
      setDeleteTarget(null);
      loadCharacters();
    } catch (error) {
      console.error("Failed to delete character:", error);
      toast.error("Failed to delete character");
    }
  };

  const updateCharacterName = async (id) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await api.updateCharacter(id, editName);
      toast.success("Name updated");
      setEditingId(null);
      loadCharacters();
    } catch (error) {
      console.error("Failed to update character:", error);
      toast.error("Failed to update name");
    }
  };

  const startEditing = (char) => {
    setEditingId(char.id);
    setEditName(char.name);
  };

  return (
    <div className="h-full flex flex-col" data-testid="character-manager">
      {/* Header */}
      <div className="p-8 border-b border-zinc-800/30">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="font-secondary text-4xl">Character Manager</h1>
            <p className="text-zinc-500 mt-2 font-mono text-sm uppercase tracking-wider">
              {characters.length} characters in library
            </p>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-primary hover:bg-primary-hover text-white px-6 py-2 font-mono uppercase tracking-widest"
            data-testid="add-character-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Character
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
            ) : characters.length === 0 ? (
              <div className="empty-state py-20" data-testid="empty-characters">
                <Users className="w-16 h-16" />
                <h3 className="font-secondary text-2xl text-zinc-400 mt-4">No Characters Yet</h3>
                <p className="text-zinc-600 mt-2">Add your first character to get started</p>
                <Button
                  onClick={() => setShowAddDialog(true)}
                  className="mt-6 bg-primary hover:bg-primary-hover"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Character
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                <AnimatePresence>
                  {characters.map((char, index) => (
                    <motion.div
                      key={char.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      className="group"
                      data-testid={`character-item-${char.id}`}
                    >
                      <div 
                        className="asset-card cursor-pointer"
                        onClick={() => setSelectedPreview(char)}
                      >
                        <img src={char.base_image} alt={char.name} loading="lazy" />
                        <div className="overlay">
                          <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); startEditing(char); }}
                              className="w-8 h-8 bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
                              data-testid={`edit-character-${char.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(char); }}
                              className="w-8 h-8 bg-destructive/80 backdrop-blur-sm flex items-center justify-center hover:bg-destructive transition-colors"
                              data-testid={`delete-character-${char.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {char.locked && (
                          <div className="absolute top-3 left-3">
                            <Lock className="w-4 h-4 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        {editingId === char.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 text-sm bg-transparent border-zinc-700"
                              autoFocus
                              onKeyDown={(e) => e.key === "Enter" && updateCharacterName(char.id)}
                              data-testid={`edit-name-input-${char.id}`}
                            />
                            <button
                              onClick={() => updateCharacterName(char.id)}
                              className="p-1 hover:text-primary"
                              data-testid={`save-name-${char.id}`}
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
                          <h3 className="font-medium text-sm truncate">{char.name}</h3>
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

      {/* Add Character Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg" data-testid="add-character-dialog">
          <DialogHeader>
            <DialogTitle className="font-secondary text-2xl">Add New Character</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Upload an image or provide a URL to create a new character
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div>
              <label className="text-sm font-mono uppercase tracking-wider text-zinc-400 mb-2 block">
                Name
              </label>
              <Input
                value={newCharacter.name}
                onChange={(e) => setNewCharacter(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter character name"
                className="bg-transparent border-zinc-700 focus:border-primary"
                data-testid="new-character-name-input"
              />
            </div>
            
            <div>
              <label className="text-sm font-mono uppercase tracking-wider text-zinc-400 mb-2 block">
                Image
              </label>
              
              {newCharacter.base_image ? (
                <div className="relative aspect-[3/4] max-w-xs mx-auto">
                  <img 
                    src={newCharacter.base_image} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setNewCharacter(prev => ({ ...prev, base_image: "" }))}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 flex items-center justify-center hover:bg-black/70"
                    data-testid="clear-image-btn"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="upload-zone p-8 flex flex-col items-center justify-center cursor-pointer"
                  data-testid="upload-zone"
                >
                  <Upload className="w-10 h-10 text-zinc-500 mb-4" />
                  <span className="text-sm text-zinc-400">Click to upload or drag & drop</span>
                  <span className="text-xs text-zinc-600 mt-2">PNG, JPG up to 10MB</span>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="file-input"
              />
              
              <div className="mt-4">
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <div className="h-px flex-1 bg-zinc-800" />
                  <span>OR</span>
                  <div className="h-px flex-1 bg-zinc-800" />
                </div>
                <Input
                  placeholder="Paste image URL"
                  onChange={(e) => handleUrlInput(e.target.value)}
                  className="mt-3 bg-transparent border-zinc-700 focus:border-primary text-sm"
                  data-testid="image-url-input"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowAddDialog(false)}
              className="text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              onClick={createCharacter}
              disabled={submitting}
              className="bg-primary hover:bg-primary-hover"
              data-testid="create-character-submit"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Character
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800" data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-secondary">Delete Character?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500">
              This will permanently delete "{deleteTarget?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-zinc-700 hover:bg-zinc-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteCharacter}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="confirm-delete-btn"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={!!selectedPreview} onOpenChange={() => setSelectedPreview(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl p-0 overflow-hidden">
          {selectedPreview && (
            <div className="flex">
              <div className="w-2/3">
                <img 
                  src={selectedPreview.base_image} 
                  alt={selectedPreview.name}
                  className="w-full aspect-[3/4] object-cover"
                />
              </div>
              <div className="w-1/3 p-6 flex flex-col">
                <h2 className="font-secondary text-2xl">{selectedPreview.name}</h2>
                
                <div className="mt-6 space-y-4 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-500">Status</span>
                    <span className="flex items-center gap-1 text-primary">
                      <Lock className="w-3 h-3" />
                      Identity Locked
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-500">Face</span>
                    <span>Protected</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-500">Pose</span>
                    <span>Locked</span>
                  </div>
                </div>
                
                <div className="mt-auto">
                  <Button 
                    className="w-full bg-primary hover:bg-primary-hover"
                    onClick={() => setSelectedPreview(null)}
                  >
                    Use in Dressing Room
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
