// TODO INFRA-02 intégration : pointer vers FastAPI backend sur :8000

export const createApiClient = (baseUrl: string) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  return {
    get: async <T>(path: string): Promise<T> => {
      const response = await fetch(`${baseUrl}${path}`, { headers });
      if (!response.ok) throw new Error(response.statusText);
      return response.json();
    },
    post: async <T, D>(path: string, data: D): Promise<T> => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(response.statusText);
      return response.json();
    },
    put: async <T, D>(path: string, data: D): Promise<T> => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(response.statusText);
      return response.json();
    },
    delete: async <T>(path: string): Promise<T> => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) throw new Error(response.statusText);
      return response.json();
    },
  };
};

export const apiClient = createApiClient('/api');
