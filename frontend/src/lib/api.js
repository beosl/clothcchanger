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
  
  // Outfits
  getOutfits: () => axios.get(`${API}/outfits`),
  getOutfit: (id) => axios.get(`${API}/outfits/${id}`),
  createOutfit: (data) => axios.post(`${API}/outfits`, data),
  deleteOutfit: (id) => axios.delete(`${API}/outfits/${id}`),
  updateOutfit: (id, name) => axios.patch(`${API}/outfits/${id}`, null, { params: { name } }),
  
  // Dressing
  applyDressing: (data) => axios.post(`${API}/dress`, data),
  getDressingHistory: () => axios.get(`${API}/dressing-history`),
  
  // Settings
  getSettings: () => axios.get(`${API}/settings`),
  updateSettings: (data) => axios.post(`${API}/settings`, data),
  
  // Seed Data
  seedData: () => axios.post(`${API}/seed-data`),
};

export default api;
