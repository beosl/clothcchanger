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
    pack_image: Optional[str] = None  # Pinterest-style layout image
    parts: Dict[str, Any] = {}  # Detailed part descriptions
    parts_description: Optional[str] = None
    analysis_status: str = "pending"
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
    status: str = "success"
    message: Optional[str] = None
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

# ===== AI IMAGE PROCESSING WITH GEMINI NANO BANANA =====

async def generate_outfit_image(character_image: str, outfit_image: str, outfit_name: str, parts: List[str], settings: Dict) -> Dict[str, Any]:
    """
    Virtual try-on: Apply outfit from outfit_image to person in character_image
    - character_image: The person (face, body, pose preserved)
    - outfit_image: The clothing to apply
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import httpx
        
        parts_str = ", ".join(parts)
        
        prompt = f"""VIRTUAL TRY-ON TASK:

IMAGE 1 (First): THE PERSON - Preserve this person exactly
IMAGE 2 (Second): THE OUTFIT - Apply these clothes

Task: Put the clothes from Image 2 onto the person in Image 1.

RULES:
1. PERSON: Keep exact same face, body shape, pose, hair, skin tone from Image 1
2. CLOTHES: Use exact same clothes (color, style, design) from Image 2
3. Apply these parts: {parts_str}
4. Keep background from Image 1
5. Output: Photorealistic image

The person must look IDENTICAL, only their clothes change to match Image 2."""

        if settings.get('precision_mode', True):
            prompt += "\n\nHIGH PRECISION: Face and body must be pixel-perfect preserved."
        
        # Prepare images
        images_to_send = []
        
        # Character image (person)
        char_base64 = character_image
        if character_image.startswith('http'):
            async with httpx.AsyncClient() as client:
                response = await client.get(character_image, timeout=30)
                if response.status_code == 200:
                    char_base64 = base64.b64encode(response.content).decode('utf-8')
                else:
                    return {"image": character_image, "status": "error", "message": "Could not download character image"}
        elif character_image.startswith('data:'):
            char_base64 = character_image.split(',')[1] if ',' in character_image else character_image
        
        images_to_send.append(ImageContent(char_base64))
        
        # Outfit image (clothes)
        outfit_base64 = outfit_image
        if outfit_image.startswith('http'):
            async with httpx.AsyncClient() as client:
                response = await client.get(outfit_image, timeout=30)
                if response.status_code == 200:
                    outfit_base64 = base64.b64encode(response.content).decode('utf-8')
        elif outfit_image.startswith('data:'):
            outfit_base64 = outfit_image.split(',')[1] if ',' in outfit_image else outfit_image
        
        # Add outfit image if converted successfully
        if not outfit_base64.startswith('http'):
            images_to_send.append(ImageContent(outfit_base64))
        
        # Initialize Nano Banana
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"tryon-{uuid.uuid4()}",
            system_message="You are a virtual try-on AI. You put clothes from one image onto a person from another image, preserving the person's identity perfectly."
        )
        chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
        
        msg = UserMessage(
            text=prompt,
            file_contents=images_to_send
        )
        
        text_response, images = await chat.send_message_multimodal_response(msg)
        
        logger.info(f"Nano Banana text: {text_response[:100] if text_response else 'No text'}")
        logger.info(f"Nano Banana images count: {len(images) if images else 0}")
        
        if images and len(images) > 0:
            img = images[0]
            logger.info(f"Image type: {type(img)}, keys: {img.keys() if isinstance(img, dict) else 'N/A'}")
            
            if isinstance(img, dict):
                mime = img.get('mime_type', 'image/png')
                data = img.get('data', '')
                if data:
                    logger.info(f"Image data length: {len(data)}")
                    return {"image": f"data:{mime};base64,{data}", "status": "success", "message": "AI generated"}
                else:
                    logger.warning("Image dict has no data")
            elif isinstance(img, str):
                logger.info(f"Image is string, length: {len(img)}")
                return {"image": f"data:image/png;base64,{img}", "status": "success", "message": "AI generated"}
            elif isinstance(img, bytes):
                logger.info(f"Image is bytes, length: {len(img)}")
                encoded = base64.b64encode(img).decode('utf-8')
                return {"image": f"data:image/png;base64,{encoded}", "status": "success", "message": "AI generated"}
        
        logger.warning("No usable image in response")
        return {"image": character_image, "status": "fallback", "message": "No image generated"}
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Nano Banana error: {error_msg}")
        
        if "budget" in error_msg.lower() or "exceeded" in error_msg.lower() or "limit" in error_msg.lower():
            return {
                "image": character_image, 
                "status": "budget_exceeded", 
                "message": "Universal Key budget exceeded. Add balance at Profile → Universal Key"
            }
        
        return {"image": character_image, "status": "error", "message": f"Error: {error_msg[:80]}"}

async def analyze_outfit_with_llm(image_url: str) -> Dict[str, Any]:
    """Use GPT-5.2 to analyze and describe outfit in image with detailed part breakdown"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import httpx
        
        # Download image and convert to base64 for vision analysis
        image_base64 = None
        if image_url.startswith('http'):
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url, timeout=30)
                if response.status_code == 200:
                    image_base64 = base64.b64encode(response.content).decode('utf-8')
        elif image_url.startswith('data:'):
            image_base64 = image_url.split(',')[1] if ',' in image_url else image_url
        else:
            image_base64 = image_url
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"outfit-analysis-{uuid.uuid4()}",
            system_message="""You are a professional fashion analyst. Analyze clothing images and provide EXTREMELY detailed descriptions.

You MUST respond in this EXACT JSON format:
{
  "upper_wear": {
    "type": "shirt/blouse/t-shirt/sweater/hoodie/jacket/coat/tank top/etc",
    "color": "exact color description",
    "pattern": "solid/striped/plaid/floral/graphic/etc",
    "material": "cotton/silk/denim/leather/wool/etc",
    "style": "casual/formal/sporty/elegant/etc",
    "details": "buttons, collar type, sleeve length, any logos or prints"
  },
  "lower_wear": {
    "type": "pants/jeans/shorts/skirt/trousers/leggings/etc",
    "color": "exact color description",
    "pattern": "solid/striped/etc",
    "material": "denim/cotton/leather/etc",
    "style": "slim fit/wide leg/high waisted/etc",
    "details": "pockets, rips, belt loops, length"
  },
  "footwear": {
    "type": "sneakers/boots/heels/sandals/loafers/etc",
    "color": "exact color",
    "style": "description"
  },
  "accessories": ["list of visible accessories like bags, hats, jewelry, belts"],
  "overall_style": "one sentence describing the complete outfit vibe",
  "color_palette": ["list of main colors in the outfit"]
}

Be extremely specific about colors, patterns, and styles. This will be used to recreate the exact outfit."""
        ).with_model("openai", "gpt-5.2")
        
        if image_base64:
            msg = UserMessage(
                text="Analyze this outfit image in extreme detail. Respond ONLY with valid JSON.",
                file_contents=[ImageContent(image_base64)]
            )
        else:
            msg = UserMessage(text=f"Analyze this outfit: {image_url}. Respond ONLY with valid JSON.")
        
        response = await chat.send_message(msg)
        
        # Try to parse JSON response
        try:
            # Clean response - remove markdown code blocks if present
            clean_response = response.strip()
            if clean_response.startswith('```'):
                clean_response = clean_response.split('```')[1]
                if clean_response.startswith('json'):
                    clean_response = clean_response[4:]
            clean_response = clean_response.strip()
            
            outfit_data = json.loads(clean_response)
            return {
                "parts": outfit_data,
                "description": response,
                "status": "analyzed"
            }
        except json.JSONDecodeError:
            return {
                "parts": {},
                "description": response,
                "status": "analyzed_text_only"
            }
            
    except Exception as e:
        logger.error(f"Outfit analysis error: {e}")
        return {
            "parts": {},
            "description": "Modern casual outfit",
            "status": "fallback",
            "error": str(e)
        }

async def create_outfit_pack_image(outfit_image: str, outfit_analysis: Dict) -> str:
    """Create a Pinterest-style outfit pack showing parts separately"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import httpx
        
        # Download image
        image_base64 = None
        if outfit_image.startswith('http'):
            async with httpx.AsyncClient() as client:
                response = await client.get(outfit_image, timeout=30)
                if response.status_code == 200:
                    image_base64 = base64.b64encode(response.content).decode('utf-8')
        elif outfit_image.startswith('data:'):
            image_base64 = outfit_image.split(',')[1] if ',' in outfit_image else outfit_image
        else:
            image_base64 = outfit_image
        
        parts = outfit_analysis.get('parts', {})
        upper = parts.get('upper_wear', {})
        lower = parts.get('lower_wear', {})
        
        prompt = f"""Create a Pinterest-style outfit layout image showing these clothing items SEPARATELY on a clean white/light background:

UPPER WEAR: {upper.get('type', 'top')} - {upper.get('color', '')} {upper.get('pattern', '')} {upper.get('material', '')}
Details: {upper.get('details', '')}

LOWER WEAR: {lower.get('type', 'bottom')} - {lower.get('color', '')} {lower.get('pattern', '')} {lower.get('material', '')}
Details: {lower.get('details', '')}

Layout requirements:
- Clean, minimal white or light gray background
- Upper garment displayed at top, neatly laid flat
- Lower garment displayed below, neatly laid flat
- Professional product photography style
- Items should look like they're laid on a flat surface
- No mannequin or person, just the clothes
- High quality, Instagram/Pinterest worthy aesthetic"""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"outfit-pack-{uuid.uuid4()}",
            system_message="You create beautiful Pinterest-style outfit layout images showing clothing items separately on clean backgrounds."
        )
        chat.with_model("gemini", "gemini-3-pro-image-preview").with_params(modalities=["image", "text"])
        
        if image_base64:
            msg = UserMessage(
                text=prompt + "\n\nUse the exact clothing items from this reference image:",
                file_contents=[ImageContent(image_base64)]
            )
        else:
            msg = UserMessage(text=prompt)
        
        text_response, images = await chat.send_message_multimodal_response(msg)
        
        if images and len(images) > 0:
            img_data = images[0]
            mime_type = img_data.get('mime_type', 'image/png')
            img_base64 = img_data.get('data', '')
            return f"data:{mime_type};base64,{img_base64}"
        
        return outfit_image
        
    except Exception as e:
        logger.error(f"Outfit pack creation error: {e}")
        return outfit_image

# Legacy functions for compatibility
async def mock_segmentation(image_data: str) -> Dict[str, Any]:
    """Segmentation data"""
    return {
        "segments": {
            "face": {"mask": "detected", "confidence": 0.95},
            "hair": {"mask": "detected", "confidence": 0.92},
            "upper_body": {"mask": "detected", "confidence": 0.90},
            "lower_body": {"mask": "detected", "confidence": 0.88},
            "background": {"mask": "detected", "confidence": 0.99}
        },
        "status": "analyzed"
    }

async def mock_outfit_extraction(image_data: str) -> Dict[str, str]:
    """Outfit extraction"""
    return {
        "upper_wear": "extracted",
        "lower_wear": "extracted",
        "shoes": "extracted",
        "accessories": "extracted",
        "status": "extracted"
    }

# ===== API ROUTES =====

@api_router.get("/")
async def root():
    return {"message": "AI Virtual Dressing Room API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "llm_configured": bool(EMERGENT_LLM_KEY),
        "image_engine": "Gemini Nano Banana"
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
    """Create outfit - just save name and image"""
    outfit_obj = Outfit(
        name=outfit.name,
        source_image=outfit.source_image,
        analysis_status="saved"
    )
    
    doc = outfit_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.outfits.insert_one(doc)
    
    return outfit_obj

@api_router.post("/outfits/{outfit_id}/analyze")
async def analyze_outfit(outfit_id: str):
    """Analyze outfit with AI (optional - costs credits)"""
    outfit = await db.outfits.find_one({"id": outfit_id}, {"_id": 0})
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    
    # Analyze with GPT-5.2
    analysis = await analyze_outfit_with_llm(outfit.get("source_image"))
    
    update_data = {
        "parts": analysis.get("parts", {}),
        "parts_description": analysis.get("description", ""),
        "analysis_status": analysis.get("status", "analyzed")
    }
    
    await db.outfits.update_one({"id": outfit_id}, {"$set": update_data})
    
    return {"message": "Outfit analyzed", "id": outfit_id, "analysis": analysis}

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
    """Apply outfit to character using Gemini Nano Banana with detailed outfit analysis"""
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
    
    # Generate new image with Nano Banana
    settings = {
        "precision_mode": request.precision_mode,
        "face_lock": request.face_lock,
        "body_lock": request.body_lock,
        "pose_lock": request.pose_lock,
        "lighting_lock": request.lighting_lock
    }
    
    gen_result = await generate_outfit_image(
        character_image=character.get('base_image'),
        outfit_image=outfit.get('source_image'),
        outfit_name=outfit.get('name'),
        parts=request.selected_parts,
        settings=settings
    )
    
    result = DressingResult(
        character_id=request.character_id,
        outfit_id=request.outfit_id,
        result_image=gen_result.get("image", character.get('base_image')),
        parts_applied=request.selected_parts,
        status=gen_result.get("status", "unknown"),
        message=gen_result.get("message")
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
