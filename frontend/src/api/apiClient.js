const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const API_BASE_URL = RAW_API_BASE_URL.endsWith('/') ? RAW_API_BASE_URL.slice(0, -1) : RAW_API_BASE_URL;


async function apiRequest(path, options = {}, retries = 3, timeoutMs = 30000) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });
      
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') ?? '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const message =
          typeof payload === 'object'
            ? payload?.error?.message ?? payload?.detail ?? 'API request failed.'
            : payload || 'API request failed.';

        // Don't retry client errors
        const err = new Error(message);
        err.status = response.status;
        throw err;
      }

      return payload;
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') {
        lastError = new Error(`Request to ${path} timed out after ${timeoutMs}ms`);
      }
      
      // If it's a client error, don't retry (except 429)
      if (err.status >= 400 && err.status < 500 && err.status !== 429) {
          throw err;
      }
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function createPresignedUpload(file) {
  return apiRequest('/api/storage/presign-upload', {
    method: 'POST',
    body: JSON.stringify({
      file_name: file.name,
      content_type: file.type || 'application/pdf',
      document_kind: 'unknown',
    }),
  });
}

export async function uploadFileToPresignedUrl(uploadUrl, file, headers = {}, uploadFields = {}) {
  const finalUrl = uploadUrl.startsWith('/') 
    ? `${API_BASE_URL}${uploadUrl}` 
    : uploadUrl;

  const isPost = Object.keys(uploadFields).length > 0;
  
  let fetchOptions = {};
  if (isPost) {
    const formData = new FormData();
    Object.entries(uploadFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append('file', file);
    
    fetchOptions = {
      method: 'POST',
      body: formData,
    };
  } else {
    fetchOptions = {
      method: 'PUT',
      headers,
      body: file,
    };
  }

  const response = await fetch(finalUrl, fetchOptions);

  if (!response.ok) {
    throw new Error('The browser could not upload the PDF to cloud storage.');
  }
}

export async function runAIExtraction(payload) {
  return apiRequest('/api/extraction/run', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function checkExtractionStatus(jobId) {
  return apiRequest(`/api/extraction/status/${jobId}`);
}

export async function pollExtractionJob(jobId, onProgress = null, intervalMs = 2000, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const poll = async () => {
      try {
        attempts++;
        if (attempts > maxAttempts) {
          throw new Error('Extraction polling timed out.');
        }
        const job = await checkExtractionStatus(jobId);
        
        if (onProgress && job.message) {
          onProgress(job.message);
        }
        
        if (job.status === 'completed') {
          resolve(job.result);
        } else if (job.status === 'failed') {
          reject(new Error(job.error || 'Extraction failed in the background.'));
        } else {
          // Still processing, check again
          setTimeout(poll, intervalMs);
        }
      } catch (err) {
        reject(err);
      }
    };
    poll();
  });
}

export async function listenExtractionJobSSE(jobId, onProgress = null) {
  return new Promise((resolve, reject) => {
    const apiKey = localStorage.getItem('api_key') || '';
    const sseUrl = `${API_BASE_URL}/api/extraction/stream/${jobId}${apiKey ? `?api_key_query=${encodeURIComponent(apiKey)}` : ''}`;
    const eventSource = new EventSource(sseUrl);
    let resolved = false;
    
    eventSource.onmessage = (event) => {
      try {
        const job = JSON.parse(event.data);
        if (onProgress && job.message) {
          onProgress(job.message);
        }
        if (job.status === 'completed') {
          resolved = true;
          eventSource.close();
          resolve(job.result);
        } else if (job.status === 'failed') {
          resolved = true;
          eventSource.close();
          reject(new Error(job.error || 'Extraction failed in the background.'));
        }
      } catch (err) {
        // ignore JSON parse errors
      }
    };
    
    eventSource.onerror = () => {
      resolved = true;
      eventSource.close();
      reject(new Error('SSE connection failed or was closed.'));
    };
  });
}

export async function runAIExtractionFlow(file, onProgress = null, options = { summarize: false }) {
  if (onProgress) onProgress("Uploading PDF to secure cloud storage...");
  const presignedUpload = await createPresignedUpload(file);
  await uploadFileToPresignedUrl(
    presignedUpload.upload_url,
    file,
    presignedUpload.headers,
    presignedUpload.upload_fields,
  );

  if (onProgress) onProgress("Starting AI extraction background task...");
  const jobInit = await runAIExtraction({
    object_key: presignedUpload.object_key,
    file_name: file.name,
    use_layout_model: true,
    summarize: options.summarize,
  });

  // Prefer SSE, fallback to polling if SSE fails
  return listenExtractionJobSSE(jobInit.job_id, onProgress).catch(() => {
    return pollExtractionJob(jobInit.job_id, onProgress);
  });
}

export async function decryptPdf(file, password) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', password);

  const apiKey = localStorage.getItem('api_key');
  const headers = {};
  if (apiKey) headers['X-API-Key'] = apiKey;

  const response = await fetch(`${API_BASE_URL}/api/tools/decrypt`, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to decrypt PDF');
  }

  return await response.blob();
}

export async function encryptPdf(blob, settings) {
  const formData = new FormData();
  formData.append('file', new File([blob], 'export.pdf', { type: 'application/pdf' }));
  if (settings.userPassword) formData.append('user_password', settings.userPassword);
  if (settings.ownerPassword) formData.append('owner_password', settings.ownerPassword);
  formData.append('can_print', settings.canPrint !== false);
  formData.append('can_modify', settings.canModify !== false);
  formData.append('can_copy', settings.canCopy !== false);

  const apiKey = localStorage.getItem('api_key');
  const headers = {};
  if (apiKey) headers['X-API-Key'] = apiKey;

  const response = await fetch(`${API_BASE_URL}/api/tools/encrypt`, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to encrypt PDF');
  }

  return await response.blob();
}

export async function optimizePdf(blob) {
  const formData = new FormData();
  formData.append('file', new File([blob], 'export.pdf', { type: 'application/pdf' }));

  const apiKey = localStorage.getItem('api_key');
  const headers = {};
  if (apiKey) headers['X-API-Key'] = apiKey;

  const response = await fetch(`${API_BASE_URL}/api/tools/optimize`, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to optimize PDF');
  }

  return await response.blob();
}

export async function signPdf(blob) {
  const formData = new FormData();
  formData.append('file', new File([blob], 'export.pdf', { type: 'application/pdf' }));

  const apiKey = localStorage.getItem('api_key');
  const headers = {};
  if (apiKey) headers['X-API-Key'] = apiKey;

  const response = await fetch(`${API_BASE_URL}/api/tools/sign`, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to digitally sign PDF');
  }

  return await response.blob();
}

export async function redactPdf(blob, redactions) {
  const formData = new FormData();
  formData.append('file', new File([blob], 'export.pdf', { type: 'application/pdf' }));
  formData.append('redactions', JSON.stringify(redactions));

  const apiKey = localStorage.getItem('api_key');
  const headers = {};
  if (apiKey) headers['X-API-Key'] = apiKey;

  const response = await fetch(`${API_BASE_URL}/api/tools/redact`, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to redact PDF');
  }

  return await response.blob();
}
