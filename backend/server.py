from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import base64
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM Setup
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
FAL_KEY = os.environ.get('FAL_KEY', '')

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===== MODELS =====

class Character(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    base_image: str  # Base64 or URL
    face_embedding: Optional[Dict[str, Any]] = None
    body_mask: Optional[str] = None
    pose_data: Optional[Dict[str, Any]] = None
    lighting_data: Optional[Dict[str, Any]] = None
    locked: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CharacterCreate(BaseModel):
    name: str
    base_image: str

class Outfit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    source_image: str
    parts: Dict[str, str] = {}  # part_type: image_data
    masks: Dict[str, str] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OutfitCreate(BaseModel):
    name: str
    source_image: str

class OutfitPack(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    upper: Optional[str] = None
    lower: Optional[str] = None
    shoes: Optional[str] = None
    jacket: Optional[str] = None
    dress: Optional[str] = None
    accessories: List[str] = []
    masks: Dict[str, str] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DressingRequest(BaseModel):
    character_id: str
    outfit_id: str
    selected_parts: List[str]  # ['upper', 'lower', 'shoes', etc.]
    precision_mode: bool = True
    face_lock: bool = True
    body_lock: bool = True
    pose_lock: bool = True
    lighting_lock: bool = True

class DressingResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    character_id: str
    outfit_id: str
    result_image: str
    parts_applied: List[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Settings(BaseModel):
    precision_mode: bool = True
    face_lock: bool = True
    body_lock: bool = True
    pose_lock: bool = True
    lighting_lock: bool = True
    background_lock: bool = True

# ===== LLM WORKFLOW CONTROLLER =====

async def llm_workflow_controller(task: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """Use GPT-5.2 to control workflow decisions"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"dressing-{uuid.uuid4()}",
            system_message="""You are the AI Workflow Controller for a Virtual Dressing Room system.
Your role is to:
1. Analyze images and determine clothing parts
2. Route tasks to appropriate processing engines
3. Validate outputs meet quality standards
4. Ensure identity preservation rules are followed

Always respond with valid JSON containing:
- action: the recommended action
- parts: detected clothing parts (if applicable)
- confidence: your confidence level (0-1)
- warnings: any quality concerns
"""
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=f"Task: {task}\nContext: {json.dumps(context)}")
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        try:
            return json.loads(response)
        except:
            return {"action": "process", "response": response, "confidence": 0.8}
            
    except Exception as e:
        logger.error(f"LLM Controller error: {e}")
        return {"action": "fallback", "error": str(e)}

# ===== MOCK IMAGE PROCESSING (Fal.ai placeholder) =====

async def mock_segmentation(image_data: str) -> Dict[str, Any]:
    """Mock segmentation - returns placeholder data"""
    # In production, this would call Fal.ai segmentation model
    return {
        "segments": {
            "face": {"mask": "placeholder", "confidence": 0.95},
            "hair": {"mask": "placeholder", "confidence": 0.92},
            "upper_body": {"mask": "placeholder", "confidence": 0.90},
            "lower_body": {"mask": "placeholder", "confidence": 0.88},
            "background": {"mask": "placeholder", "confidence": 0.99}
        },
        "status": "mocked"
    }

async def mock_outfit_extraction(image_data: str) -> Dict[str, str]:
    """Mock outfit extraction - returns placeholder parts"""
    return {
        "upper_wear": "extracted_placeholder",
        "lower_wear": "extracted_placeholder",
        "shoes": "extracted_placeholder",
        "accessories": "extracted_placeholder",
        "status": "mocked"
    }

async def mock_inpainting(character_image: str, outfit_parts: Dict, masks: Dict) -> str:
    """Mock inpainting - returns the character image (no actual processing)"""
    # In production, this would call Fal.ai inpainting model
    return character_image

async def process_with_fal(image_data: str, task: str) -> Dict[str, Any]:
    """Process image with Fal.ai (or mock if no key)"""
    if not FAL_KEY:
        logger.warning("FAL_KEY not set - using mock processing")
        if task == "segment":
            return await mock_segmentation(image_data)
        elif task == "extract":
            return await mock_outfit_extraction(image_data)
        return {"status": "mocked", "result": image_data}
    
    # Real Fal.ai processing would go here
    try:
        import fal_client
        os.environ["FAL_KEY"] = FAL_KEY
        
        # Use appropriate model based on task
        if task == "segment":
            handler = await fal_client.submit_async(
                "fal-ai/florence-2-large/more-detailed-caption",
                arguments={"image_url": image_data}
            )
            result = await handler.get()
            return {"status": "processed", "result": result}
        
        return {"status": "processed", "result": image_data}
    except Exception as e:
        logger.error(f"Fal.ai error: {e}")
        return {"status": "error", "error": str(e)}

# ===== API ROUTES =====

@api_router.get("/")
async def root():
    return {"message": "AI Virtual Dressing Room API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "llm_configured": bool(EMERGENT_LLM_KEY),
        "fal_configured": bool(FAL_KEY)
    }

# ----- CHARACTER ROUTES -----

@api_router.post("/characters", response_model=Character)
async def create_character(character: CharacterCreate):
    """Create a new character with face/body preservation"""
    char_obj = Character(
        name=character.name,
        base_image=character.base_image
    )
    
    # Use LLM to analyze character
    analysis = await llm_workflow_controller(
        "analyze_character",
        {"name": character.name, "has_image": bool(character.base_image)}
    )
    
    # Mock segmentation for body/face data
    segmentation = await mock_segmentation(character.base_image)
    char_obj.pose_data = {"keypoints": [], "status": "mocked"}
    char_obj.lighting_data = {"direction": "front", "intensity": 0.8, "status": "mocked"}
    
    doc = char_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.characters.insert_one(doc)
    
    return char_obj

@api_router.get("/characters", response_model=List[Character])
async def get_characters():
    """Get all characters"""
    characters = await db.characters.find({}, {"_id": 0}).to_list(100)
    for char in characters:
        if isinstance(char.get('created_at'), str):
            char['created_at'] = datetime.fromisoformat(char['created_at'])
    return characters

@api_router.get("/characters/{character_id}", response_model=Character)
async def get_character(character_id: str):
    """Get a specific character"""
    char = await db.characters.find_one({"id": character_id}, {"_id": 0})
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if isinstance(char.get('created_at'), str):
        char['created_at'] = datetime.fromisoformat(char['created_at'])
    return char

@api_router.delete("/characters/{character_id}")
async def delete_character(character_id: str):
    """Delete a character"""
    result = await db.characters.delete_one({"id": character_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Character not found")
    return {"message": "Character deleted", "id": character_id}

@api_router.patch("/characters/{character_id}")
async def update_character(character_id: str, name: str = None):
    """Update character name"""
    update_data = {}
    if name:
        update_data["name"] = name
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.characters.update_one({"id": character_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Character not found")
    return {"message": "Character updated", "id": character_id}

# ----- OUTFIT ROUTES -----

@api_router.post("/outfits", response_model=Outfit)
async def create_outfit(outfit: OutfitCreate):
    """Create/extract outfit from image"""
    outfit_obj = Outfit(
        name=outfit.name,
        source_image=outfit.source_image
    )
    
    # Extract parts using LLM workflow
    workflow_result = await llm_workflow_controller(
        "extract_outfit",
        {"name": outfit.name, "has_image": bool(outfit.source_image)}
    )
    
    # Mock extraction
    extracted = await mock_outfit_extraction(outfit.source_image)
    outfit_obj.parts = {
        "upper_wear": outfit.source_image,
        "lower_wear": outfit.source_image,
        "shoes": outfit.source_image
    }
    outfit_obj.masks = {"full": "placeholder_mask"}
    
    doc = outfit_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.outfits.insert_one(doc)
    
    return outfit_obj

@api_router.get("/outfits", response_model=List[Outfit])
async def get_outfits():
    """Get all outfits"""
    outfits = await db.outfits.find({}, {"_id": 0}).to_list(100)
    for outfit in outfits:
        if isinstance(outfit.get('created_at'), str):
            outfit['created_at'] = datetime.fromisoformat(outfit['created_at'])
    return outfits

@api_router.get("/outfits/{outfit_id}", response_model=Outfit)
async def get_outfit(outfit_id: str):
    """Get a specific outfit"""
    outfit = await db.outfits.find_one({"id": outfit_id}, {"_id": 0})
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    if isinstance(outfit.get('created_at'), str):
        outfit['created_at'] = datetime.fromisoformat(outfit['created_at'])
    return outfit

@api_router.delete("/outfits/{outfit_id}")
async def delete_outfit(outfit_id: str):
    """Delete an outfit"""
    result = await db.outfits.delete_one({"id": outfit_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Outfit not found")
    return {"message": "Outfit deleted", "id": outfit_id}

@api_router.patch("/outfits/{outfit_id}")
async def update_outfit(outfit_id: str, name: str = None):
    """Update outfit name"""
    update_data = {}
    if name:
        update_data["name"] = name
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.outfits.update_one({"id": outfit_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Outfit not found")
    return {"message": "Outfit updated", "id": outfit_id}

# ----- DRESSING ROOM ROUTES -----

@api_router.post("/dress", response_model=DressingResult)
async def apply_dressing(request: DressingRequest):
    """Apply outfit to character"""
    # Get character and outfit
    character = await db.characters.find_one({"id": request.character_id}, {"_id": 0})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    outfit = await db.outfits.find_one({"id": request.outfit_id}, {"_id": 0})
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    
    # LLM workflow control
    workflow_result = await llm_workflow_controller(
        "apply_dressing",
        {
            "character_name": character.get('name'),
            "outfit_name": outfit.get('name'),
            "parts": request.selected_parts,
            "precision_mode": request.precision_mode
        }
    )
    
    # Mock inpainting (returns original character image)
    result_image = await mock_inpainting(
        character.get('base_image'),
        outfit.get('parts', {}),
        outfit.get('masks', {})
    )
    
    result = DressingResult(
        character_id=request.character_id,
        outfit_id=request.outfit_id,
        result_image=result_image,
        parts_applied=request.selected_parts
    )
    
    doc = result.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.dressing_results.insert_one(doc)
    
    return result

@api_router.get("/dressing-history", response_model=List[DressingResult])
async def get_dressing_history():
    """Get dressing history"""
    results = await db.dressing_results.find({}, {"_id": 0}).to_list(50)
    for r in results:
        if isinstance(r.get('created_at'), str):
            r['created_at'] = datetime.fromisoformat(r['created_at'])
    return results

# ----- SETTINGS ROUTES -----

@api_router.get("/settings")
async def get_settings():
    """Get current settings"""
    settings = await db.settings.find_one({"type": "global"}, {"_id": 0})
    if not settings:
        return Settings().model_dump()
    return settings

@api_router.post("/settings")
async def update_settings(settings: Settings):
    """Update settings"""
    doc = settings.model_dump()
    doc["type"] = "global"
    await db.settings.update_one(
        {"type": "global"},
        {"$set": doc},
        upsert=True
    )
    return {"message": "Settings updated", "settings": doc}

# ----- SAMPLE DATA -----

@api_router.post("/seed-data")
async def seed_sample_data():
    """Seed sample characters and outfits for demo"""
    sample_characters = [
        {
            "id": str(uuid.uuid4()),
            "name": "Elegant Model",
            "base_image": "https://images.unsplash.com/photo-1584287981937-67ab60932edf?w=800&q=80",
            "locked": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Urban Style",
            "base_image": "https://images.unsplash.com/photo-1759247943108-39e23e97fde4?w=800&q=80",
            "locked": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Sporty Look",
            "base_image": "https://images.unsplash.com/photo-1772714601064-056e3ceced8f?w=800&q=80",
            "locked": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Classic Portrait",
            "base_image": "https://images.unsplash.com/photo-1771092358890-0db24db44e56?w=800&q=80",
            "locked": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    sample_outfits = [
        {
            "id": str(uuid.uuid4()),
            "name": "Summer Casual",
            "source_image": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&q=80",
            "parts": {"upper_wear": "shirt", "lower_wear": "shorts"},
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Business Formal",
            "source_image": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80",
            "parts": {"upper_wear": "blazer", "lower_wear": "pants"},
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Street Style",
            "source_image": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80",
            "parts": {"upper_wear": "hoodie", "lower_wear": "jeans"},
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Evening Dress",
            "source_image": "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80",
            "parts": {"dress": "evening_gown"},
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Clear existing and insert new
    await db.characters.delete_many({})
    await db.outfits.delete_many({})
    
    await db.characters.insert_many(sample_characters)
    await db.outfits.insert_many(sample_outfits)
    
    return {
        "message": "Sample data seeded",
        "characters": len(sample_characters),
        "outfits": len(sample_outfits)
    }

# Include router and add middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
