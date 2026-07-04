import axios from 'axios';

const API_SECRET = process.env.REACT_APP_API_SECRET || '';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Secret': API_SECRET
  }
});

// Add auth token to requests
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Basic ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('username');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const auth = {
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    if (response.data.token) {
      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('username', username);
    }
    return response.data;
  },

  verify: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
  }
};

// Whitelist endpoints
export const whitelists = {
  // Get all whitelists
  getAll: async () => {
    const response = await api.get('/whitelists');
    return response.data;
  },

  // Get whitelists by category
  getByCategory: async (category) => {
    const response = await api.get(`/whitelists/${category}`);
    return response.data;
  },

  // Get specific whitelist
  get: async (category, name) => {
    const response = await api.get(`/whitelists/${category}/${name}`);
    return response.data;
  },

  // Create new whitelist
  create: async (data) => {
    const response = await api.post('/whitelists', data);
    return response.data;
  },

  // Add addresses to whitelist
  addAddresses: async (category, name, addresses) => {
    const response = await api.post(`/whitelists/${category}/${name}/addresses`, {
      addresses
    });
    return response.data;
  },

  // Remove addresses from whitelist
  removeAddresses: async (category, name, addresses) => {
    const response = await api.delete(`/whitelists/${category}/${name}/addresses`, {
      data: { addresses }
    });
    return response.data;
  },

  // Replace all addresses in whitelist
  replaceAddresses: async (category, name, addresses) => {
    const response = await api.put(`/whitelists/${category}/${name}/addresses`, {
      addresses
    });
    return response.data;
  },

  // Delete whitelist
  delete: async (category, name) => {
    const response = await api.delete(`/whitelists/${category}/${name}`);
    return response.data;
  },

  // Export whitelist
  export: async (category, name, format = 'json') => {
    const response = await api.get(`/whitelists/${category}/${name}/export?format=${format}`, {
      responseType: format === 'json' ? 'json' : 'blob'
    });

    if (format !== 'json') {
      // Create download link for text/csv formats
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${name}-${category}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }

    return response.data;
  }
};

// Sync endpoints
export const sync = {
  // Sync with MongoDB
  syncMongoDB: async () => {
    const response = await api.post('/sync/mongodb');
    return response.data;
  }
};

export default api;