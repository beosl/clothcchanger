import requests
import json
import sys
from datetime import datetime

class AIDressingRoomTester:
    def __init__(self, base_url="https://cloth-changer-pro.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_character_id = None
        self.created_outfit_id = None

    def log_test(self, name, status, message=""):
        """Log test result"""
        self.tests_run += 1
        if status:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {message}")
        return status

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        try:
            response = requests.get(f"{self.api_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                # Check for Gemini Nano Banana image engine
                image_engine = data.get('image_engine', '')
                expected_engine = "Gemini Nano Banana"
                engine_match = image_engine == expected_engine
                
                return self.log_test(
                    "Health Check with Gemini Nano Banana", 
                    engine_match and data.get('status') == 'healthy',
                    f"Status: {data.get('status')}, LLM: {data.get('llm_configured')}, Image Engine: {image_engine} (Expected: {expected_engine})"
                )
            else:
                return self.log_test("Health Check", False, f"Status {response.status_code}")
        except Exception as e:
            return self.log_test("Health Check", False, f"Error: {str(e)}")

    def test_get_characters(self):
        """Test GET /api/characters"""
        try:
            response = requests.get(f"{self.api_url}/characters", timeout=10)
            if response.status_code == 200:
                data = response.json()
                return self.log_test("Get Characters", True, f"Found {len(data)} characters")
            else:
                return self.log_test("Get Characters", False, f"Status {response.status_code}")
        except Exception as e:
            return self.log_test("Get Characters", False, f"Error: {str(e)}")

    def test_get_outfits(self):
        """Test GET /api/outfits"""
        try:
            response = requests.get(f"{self.api_url}/outfits", timeout=10)
            if response.status_code == 200:
                data = response.json()
                return self.log_test("Get Outfits", True, f"Found {len(data)} outfits")
            else:
                return self.log_test("Get Outfits", False, f"Status {response.status_code}")
        except Exception as e:
            return self.log_test("Get Outfits", False, f"Error: {str(e)}")

    def test_seed_data(self):
        """Test POST /api/seed-data"""
        try:
            response = requests.post(f"{self.api_url}/seed-data", timeout=15)
            if response.status_code == 200:
                data = response.json()
                return self.log_test(
                    "Seed Sample Data", 
                    True, 
                    f"Seeded {data.get('characters', 0)} chars, {data.get('outfits', 0)} outfits"
                )
            else:
                return self.log_test("Seed Sample Data", False, f"Status {response.status_code}")
        except Exception as e:
            return self.log_test("Seed Sample Data", False, f"Error: {str(e)}")

    def test_create_character(self):
        """Test POST /api/characters"""
        test_character = {
            "name": f"Test Character {datetime.now().strftime('%H%M%S')}",
            "base_image": "https://images.unsplash.com/photo-1494790108755-2616b332e234?w=400&q=80"
        }
        try:
            response = requests.post(
                f"{self.api_url}/characters", 
                json=test_character,
                timeout=15
            )
            if response.status_code == 200:
                data = response.json()
                self.created_character_id = data.get('id')
                return self.log_test(
                    "Create Character", 
                    True, 
                    f"Created character: {data.get('name')} (ID: {self.created_character_id})"
                )
            else:
                return self.log_test("Create Character", False, f"Status {response.status_code}")
        except Exception as e:
            return self.log_test("Create Character", False, f"Error: {str(e)}")

    def test_create_outfit(self):
        """Test POST /api/outfits"""
        test_outfit = {
            "name": f"Test Outfit {datetime.now().strftime('%H%M%S')}",
            "source_image": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80"
        }
        try:
            response = requests.post(
                f"{self.api_url}/outfits", 
                json=test_outfit,
                timeout=15
            )
            if response.status_code == 200:
                data = response.json()
                self.created_outfit_id = data.get('id')
                return self.log_test(
                    "Create Outfit", 
                    True, 
                    f"Created outfit: {data.get('name')} (ID: {self.created_outfit_id})"
                )
            else:
                return self.log_test("Create Outfit", False, f"Status {response.status_code}")
        except Exception as e:
            return self.log_test("Create Outfit", False, f"Error: {str(e)}")

    def test_apply_dressing(self):
        """Test POST /api/dress endpoint with extended timeout for Gemini Nano Banana"""
        if not self.created_character_id or not self.created_outfit_id:
            return self.log_test("Apply Dressing", False, "No character or outfit created")
        
        dressing_request = {
            "character_id": self.created_character_id,
            "outfit_id": self.created_outfit_id,
            "selected_parts": ["upper_wear", "lower_wear"],
            "precision_mode": True,
            "face_lock": True,
            "body_lock": True,
            "pose_lock": True,
            "lighting_lock": True
        }
        try:
            print("⏳ Testing AI image generation (may take up to 60 seconds)...")
            # Extended timeout for Gemini Nano Banana processing
            response = requests.post(
                f"{self.api_url}/dress", 
                json=dressing_request,
                timeout=75
            )
            if response.status_code == 200:
                data = response.json()
                result_image = data.get('result_image', '')
                has_result = bool(result_image and len(result_image) > 100)
                return self.log_test(
                    "Apply Dressing with Gemini Nano Banana", 
                    has_result, 
                    f"Applied {len(data.get('parts_applied', []))} parts, Got image: {has_result}"
                )
            else:
                return self.log_test("Apply Dressing", False, f"Status {response.status_code}")
        except Exception as e:
            return self.log_test("Apply Dressing", False, f"Error: {str(e)}")

    def test_get_settings(self):
        """Test GET /api/settings"""
        try:
            response = requests.get(f"{self.api_url}/settings", timeout=10)
            if response.status_code == 200:
                data = response.json()
                return self.log_test("Get Settings", True, f"Precision mode: {data.get('precision_mode')}")
            else:
                return self.log_test("Get Settings", False, f"Status {response.status_code}")
        except Exception as e:
            return self.log_test("Get Settings", False, f"Error: {str(e)}")

    def test_update_settings(self):
        """Test POST /api/settings"""
        test_settings = {
            "precision_mode": True,
            "face_lock": True,
            "body_lock": True,
            "pose_lock": True,
            "lighting_lock": True,
            "background_lock": False
        }
        try:
            response = requests.post(
                f"{self.api_url}/settings", 
                json=test_settings,
                timeout=10
            )
            if response.status_code == 200:
                return self.log_test("Update Settings", True, "Settings updated successfully")
            else:
                return self.log_test("Update Settings", False, f"Status {response.status_code}")
        except Exception as e:
            return self.log_test("Update Settings", False, f"Error: {str(e)}")

    def test_delete_created_items(self):
        """Clean up created test items"""
        success_count = 0
        
        if self.created_character_id:
            try:
                response = requests.delete(f"{self.api_url}/characters/{self.created_character_id}", timeout=10)
                if response.status_code == 200:
                    success_count += 1
                    self.log_test("Delete Test Character", True)
                else:
                    self.log_test("Delete Test Character", False, f"Status {response.status_code}")
            except Exception as e:
                self.log_test("Delete Test Character", False, f"Error: {str(e)}")
        
        if self.created_outfit_id:
            try:
                response = requests.delete(f"{self.api_url}/outfits/{self.created_outfit_id}", timeout=10)
                if response.status_code == 200:
                    success_count += 1
                    self.log_test("Delete Test Outfit", True)
                else:
                    self.log_test("Delete Test Outfit", False, f"Status {response.status_code}")
            except Exception as e:
                self.log_test("Delete Test Outfit", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run comprehensive backend API tests"""
        print("🚀 Starting AI Dressing Room Backend Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("-" * 60)

        # Health and basic functionality
        self.test_health_endpoint()
        self.test_get_characters()
        self.test_get_outfits()
        
        # Seed sample data if empty
        self.test_seed_data()
        
        # CRUD operations
        self.test_create_character()
        self.test_create_outfit()
        
        # Core dressing functionality
        self.test_apply_dressing()
        
        # Settings
        self.test_get_settings()
        self.test_update_settings()
        
        # Cleanup
        self.test_delete_created_items()

        print("-" * 60)
        print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run} passed")
        
        return self.tests_passed == self.tests_run

def main():
    tester = AIDressingRoomTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())