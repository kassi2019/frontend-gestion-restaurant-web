import axios from 'axios';
import { API_URL } from '../config';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export const authApi = {
  login: (data: { telephone: string; mot_de_passe: string }) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
  forgotPassword: (data: { telephone: string; newPassword: string }) => api.post('/auth/forgot-password', data),
  changePassword: (data: { oldPassword: string; newPassword: string }) => api.patch('/auth/password', data),
  updateProfile: (data: { nom?: string; photo?: string }) => api.patch('/auth/profile', data),
  uploadPhoto: (formData: FormData) => api.post('/auth/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getAbonnement: () => api.get('/auth/abonnement'),
  activerCode: (data: { telephone: string; code: string }) => api.post('/auth/activer', data),
  genererCodes: (data: { dureeJours: number; nombre: number }) => api.post('/auth/generer-codes', data),
  listeCodes: () => api.get('/auth/codes'),
  supprimerCode: (id: number) => api.delete(`/auth/codes/${id}`),
  getDashboard: () => api.get('/auth/super-dashboard'),
  getHistorique: (restaurantId: number) => api.get(`/auth/historique/${restaurantId}`),
};

export const menuApi = {
  getPublic: (restaurantId: number) => api.get(`/menu/public/${restaurantId}`),
  getCategories: () => api.get('/menu/categories'),
  createCategorie: (data: any) => api.post('/menu/categories', data),
  getMenus: () => api.get('/menu'),
  createMenu: (data: any) => api.post('/menu', data),
  updateMenu: (id: number, data: any) => api.patch(`/menu/${id}`, data),
  deleteMenu: (id: number) => api.delete(`/menu/${id}`),
  importCsv: (formData: FormData) => api.post('/menu/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  toggleDisponibleDemain: (id: number) => api.patch(`/menu/${id}/toggle-demain`),
  uploadImage: (formData: FormData) => api.post('/menu/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getVariants: (menuId: number) => api.get(`/menu/${menuId}/variants`),
  addVariant: (menuId: number, data: { nom: string; prix: number }) => api.post(`/menu/${menuId}/variants`, data),
  updateVariant: (variantId: number, data: { nom?: string; prix?: number }) => api.patch(`/menu/variants/${variantId}`, data),
  deleteVariant: (variantId: number) => api.delete(`/menu/variants/${variantId}`),
};

export const tablesApi = {
  getAll: () => api.get('/tables'),
  create: (data: any) => api.post('/tables', data),
  update: (id: number, data: any) => api.patch(`/tables/${id}`, data),
  delete: (id: number) => api.delete(`/tables/${id}`),
  updateStatut: (id: number, statut: string) => api.patch(`/tables/${id}/statut`, { statut }),
};

export const commandesApi = {
  getAll: () => api.get('/commandes'),
  create: (data: any) => api.post('/commandes', data),
  getByTable: (tableId: number) => api.get(`/commandes/table/${tableId}`),
  getByServeur: () => api.get('/commandes/serveur'),
  getByCuisine: () => api.get('/commandes/cuisine'),
  getByBar: () => api.get('/commandes/bar'),
  updateStatut: (id: number, statut: string) => api.patch(`/commandes/${id}/statut`, { statut }),
  updateDetailStatut: (id: number, detailId: number, statut: string) => api.patch(`/commandes/${id}/detail/${detailId}`, { statut }),
  toutPret: (id: number) => api.patch(`/commandes/${id}/tout-pret`),
};

export const paiementApi = {
  getAPayer: () => api.get('/paiements/a-payer'),
  payer: (commandeId: number, mode: string) => api.post(`/paiements/payer/${commandeId}`, { mode }),
  getFactures: () => api.get('/paiements/factures'),
  imprimerFacture: (id: number) => api.get(`/paiements/factures/${id}/imprimer`),
  getCaisseJour: () => api.get('/paiements/caisse/jour'),
  cloturerCaisse: () => api.post('/paiements/caisse/cloture'),
  cloturerCaisseGlobale: (dateReouverture: string) => api.post('/paiements/caisse/cloture-globale', { dateReouverture }),
  getHistoriqueClotures: () => api.get('/paiements/caisse/clotures'),
};

export const serveurTablesApi = {
  getAll: () => api.get('/serveur-tables'),
  findByServeur: () => api.get('/serveur-tables/serveur'),
  findByTable: (tableId: number) => api.get(`/serveur-tables/table/${tableId}`),
  assign: (data: { utilisateurId: number; tableId: number }) => api.post('/serveur-tables', data),
  assignBulk: (data: { utilisateurId: number; tableIds: number[] }) => api.post('/serveur-tables/bulk', data),
  unassign: (tableId: number) => api.delete(`/serveur-tables/${tableId}`),
  reassign: (data: { fromServeurId: number; toServeurId: number; tableId?: number }) => api.patch('/serveur-tables/reassign', data),
  runDailyCheck: () => api.post('/serveur-tables/run-check'),
};

export const planningApi = {
  getAll: () => api.get('/planning'),
  getMine: () => api.get('/planning/mine'),
  create: (data: any) => api.post('/planning', data),
  update: (id: number, data: any) => api.patch(`/planning/${id}`, data),
  delete: (id: number) => api.delete(`/planning/${id}`),
};

export const usersApi = {
  getAll: () => api.get('/users'),
  update: (id: number, data: any) => api.patch(`/users/${id}`, data),
  updateStatut: (id: number, statut: string) => api.patch(`/users/${id}/statut?statut=${statut}`),
  delete: (id: number) => api.delete(`/users/${id}`),
};

export const restaurantApi = {
  getInfo: (id: number) => api.get(`/restaurants/${id}`),
  update: (id: number, data: any) => api.patch(`/restaurants/${id}`, data),
};

export const notificationsApi = {
  getAll: (date?: string) => api.get('/notifications', { params: date ? { date } : {} }),
  markAsRead: (id: number) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
};

export const statistiquesApi = {
  getDashboard: () => api.get('/statistiques/dashboard'),
  getVentes: (params?: any) => api.get('/statistiques/ventes', { params }),
};

export default api;
