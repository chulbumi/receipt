import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/api/auth/refresh`, null, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });
          const newToken = res.data.access_token;
          localStorage.setItem('access_token', newToken);
          original.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(original);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

export const authApi = {
  login: (user_id: string, password: string) =>
    apiClient.post('/api/auth/login', { user_id, password }),
  signup: (data: { user_id: string; password: string; name: string; department?: string }) =>
    apiClient.post('/api/auth/signup', data),
  refresh: () => apiClient.post('/api/auth/refresh'),
  me: () => apiClient.get('/api/auth/me'),
  changePassword: (current_password: string, new_password: string) =>
    apiClient.post('/api/auth/change-password', { current_password, new_password }),
};

export const usersApi = {
  list: () => apiClient.get('/api/users'),
  getMyPartners: () => apiClient.get('/api/users/me/partners'),
  updateMyPartners: (partner_ids: string[]) =>
    apiClient.put('/api/users/me/partners', { partner_ids }),
  toggleFavorite: (partner_id: string) =>
    apiClient.post('/api/users/me/partners/toggle', { partner_id }),
};

export const receiptsApi = {
  analyze: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post('/api/receipts/analyze', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getImageUrl: (imageKey: string) =>
    apiClient.get(`/api/receipts/image-url/${encodeURIComponent(imageKey)}`),
};

export const recordsApi = {
  create: (data: object) => apiClient.post('/api/records', data),
  getMyRecords: (params?: object) => apiClient.get('/api/records/me', { params }),
  getCalendar: (year_month: string) =>
    apiClient.get('/api/records/calendar', { params: { year_month } }),
  getOne: (id: string) => apiClient.get(`/api/records/${id}`),
  update: (id: string, data: object) => apiClient.put(`/api/records/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/records/${id}`),
};

export const cardsApi = {
  list: () => apiClient.get('/api/cards'),
  create: (data: object) => apiClient.post('/api/cards', data),
  update: (id: string, data: object) => apiClient.put(`/api/cards/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/cards/${id}`),
  getSummary: (id: string, year_month: string) =>
    apiClient.get(`/api/cards/${id}/summary`, { params: { year_month } }),
};

export const adminApi = {
  listUsers: (status?: string) =>
    apiClient.get('/api/admin/users', { params: status ? { status } : undefined }),
  createUser: (data: object) => apiClient.post('/api/admin/users', data),
  updateUser: (id: string, data: object) => apiClient.put(`/api/admin/users/${id}`, data),
  approveUser: (id: string) => apiClient.post(`/api/admin/users/${id}/approve`),
  rejectUser: (id: string) => apiClient.post(`/api/admin/users/${id}/reject`),
  listRecords: (params?: object) => apiClient.get('/api/admin/records', { params }),
  dailyReport: (year_month: string) =>
    apiClient.get('/api/admin/reports/daily', { params: { year_month } }),
  monthlyReport: (year: number) =>
    apiClient.get('/api/admin/reports/monthly', { params: { year } }),
  userReport: (user_id: string, year_month: string) =>
    apiClient.get(`/api/admin/reports/user/${user_id}`, { params: { year_month } }),
  usersSummary: (year_month: string) =>
    apiClient.get('/api/admin/reports/users-summary', { params: { year_month } }),
};
