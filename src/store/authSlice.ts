import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../services/api';

export interface ModuleInfo { id: number; nom: string; icon: string; route: string; }

export interface User {
  id: number; nom: string; telephone: string; role: string;
  photo?: string; restaurantId: number; devise?: string;
  restaurantNom?: string; restaurantLogo?: string; restaurantTelephone?: string;
  typeAbonnement?: string; dateFinAbonnement?: string | null;
  modules?: ModuleInfo[];
}

interface AuthState {
  user: User | null; token: string | null;
  loading: boolean; error: string | null;
}

const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  loading: false, error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { telephone: string; mot_de_passe: string }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(credentials);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.utilisateur));
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erreur de connexion';
      return rejectWithValue(msg);
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null; state.token = null;
      localStorage.removeItem('token'); localStorage.removeItem('user');
    },
    updateUser: (state, action) => {
      state.user = { ...state.user!, ...action.payload };
      localStorage.setItem('user', JSON.stringify(state.user));
    },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(login.fulfilled, (s, a) => {
        s.loading = false; s.token = a.payload.token; s.user = a.payload.utilisateur;
      })
      .addCase(login.rejected, (s, a) => { s.loading = false; s.error = a.payload as string; });
  },
});

export const { logout, updateUser, clearError } = authSlice.actions;
export default authSlice.reducer;
