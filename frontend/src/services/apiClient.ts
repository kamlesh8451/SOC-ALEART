const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('gsoc_token');
  
  // Resolve the full URL if it's a relative path
  let url = input.toString();
  if (url.startsWith('/api')) {
    url = `${API_BASE_URL}${url}`;
  }

  const headers = new Headers(init?.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch {
    throw new Error(
      `Cannot reach the API at ${url}. Ensure the backend is running.`
    );
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      if (response.status === 500 && !text.trim()) {
        throw new Error(
          `API returned 500 with no body at ${url}. The backend might have crashed or be misconfigured.`
        );
      }
      throw new Error(`API error (${response.status}): ${text.slice(0, 200) || response.statusText}`);
    }
  }

  return response;
}

export async function apiJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await apiFetch(input, init);
  if (!response.ok) {
    if (response.status === 401 && !input.toString().includes('/api/auth/login')) {
      localStorage.removeItem('gsoc_token');
      localStorage.removeItem('gsoc_user');
      window.location.href = '/'; // Force back to login
    }
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((err as { error?: string }).error || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
