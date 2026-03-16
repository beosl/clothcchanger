import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = {
  // Health
  health: () => axios.get(`${API}/health`),
  
  // Characters
  getCharacters: () => axios.get(`${API}/characters`),
  getCharacter: (id) => axios.get(`${API}/characters/${id}`),
  createCharacter: (data) => axios.post(`${API}/characters`, data),
  deleteCharacter: (id) => axios.delete(`${API}/characters/${id}`),
  updateCharacter: (id, name) => axios.patch(`${API}/characters/${id}`, null, { params: { name } }),
  
  // Direct Generation (no saving)
  generateWithPose: (data) => axios.post(`${API}/generate`, data, { timeout: 120000 }),
  
  // Settings
  getSettings: () => axios.get(`${API}/settings`),
  updateSettings: (data) => axios.post(`${API}/settings`, data),
  
  // Seed Data
  seedData: () => axios.post(`${API}/seed-data`),
};

export default api;
