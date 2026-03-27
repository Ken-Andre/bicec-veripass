// TODO INFRA-02 intégration : pointer vers FastAPI backend sur :8000

export const createApiClient = (baseUrl: string) => {
  const getHeaders = (extraHeaders?: Record<string, string>) => {
    const token = localStorage.getItem('vp_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...extraHeaders,
    };
  };

  return {
    get: async <T>(path: string, options?: { headers?: Record<string, string> }): Promise<T> => {
      const response = await fetch(`${baseUrl}${path}`, { 
        headers: getHeaders(options?.headers) 
      });
      if (!response.ok) throw new Error(response.statusText);
      return response.json();
    },
    post: async <T, D>(path: string, data: D, options?: { headers?: Record<string, string> }): Promise<T> => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: getHeaders(options?.headers),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.detail || response.statusText);
        (error as any).response = { data: errorData };
        throw error;
      }
      return response.json();
    },
    put: async <T, D>(path: string, data: D, options?: { headers?: Record<string, string> }): Promise<T> => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'PUT',
        headers: getHeaders(options?.headers),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.detail || response.statusText);
        (error as any).response = { data: errorData };
        throw error;
      }
      return response.json();
    },
    delete: async <T>(path: string, options?: { headers?: Record<string, string> }): Promise<T> => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'DELETE',
        headers: getHeaders(options?.headers),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.detail || response.statusText);
        (error as any).response = { data: errorData };
        throw error;
      }
      return response.json();
    },
  };
};

export const apiClient = createApiClient('/api/v1');
