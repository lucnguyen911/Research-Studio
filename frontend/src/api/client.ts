import type {
  ApiErrorEnvelope,
  CreateProjectPayload,
  DeleteProjectResultDto,
  ProjectDto,
  PurgeCacheResultDto,
  QuotaStatusDto,
  SystemSettingsDto,
  UpdateProjectPayload,
  UpdateSystemSettingsPayload,
} from './types';

export const CSRF_HEADER_NAME = 'X-Research-Studio-Client';
export const CSRF_HEADER_VALUE = 'local-web';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | null;

  constructor(
    code: string,
    message: string,
    status: number,
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function buildHeaders(method: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (MUTATING_METHODS.has(method.toUpperCase())) {
    headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
  }
  return headers;
}

async function parseErrorResponse(response: Response): Promise<ApiClientError> {
  if (response.status === 502 || response.status === 504) {
    return new ApiClientError(
      'NETWORK_UNREACHABLE',
      'Không kết nối được tới dịch vụ Backend cục bộ (127.0.0.1:8000).',
      response.status,
    );
  }
  try {
    const data = (await response.json()) as Partial<ApiErrorEnvelope>;
    if (data && data.error && typeof data.error.message === 'string') {
      return new ApiClientError(
        data.error.code || `HTTP_${response.status}`,
        data.error.message,
        response.status,
        data.error.details ?? null,
      );
    }
  } catch {
    // Non-JSON error body
  }
  return new ApiClientError(
    `HTTP_${response.status}`,
    `Yêu cầu máy chủ thất bại (HTTP ${response.status}).`,
    response.status,
  );
}

export async function apiRequest<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
  },
): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const headers = buildHeaders(method);
  let bodyInit: BodyInit | undefined;
  if (options?.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    bodyInit = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: bodyInit,
      signal: options?.signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw err;
    }
    throw new ApiClientError(
      'NETWORK_UNREACHABLE',
      'Không thể kết nối tới Backend cục bộ hoặc mất mạng.',
      0,
    );
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return (await response.json()) as T;
}

export async function apiDownloadFile(
  path: string,
  fallbackFilename: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'GET',
      headers: buildHeaders('GET'),
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiClientError('NETWORK_UNREACHABLE', 'Không thể tải tệp từ Backend cục bộ.', 0);
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] || fallbackFilename;
  const blob = await response.blob();
  return { blob, filename };
}

export async function fetchSystemSettings(signal?: AbortSignal): Promise<SystemSettingsDto> {
  return apiRequest<SystemSettingsDto>('/api/v1/system/settings', { signal });
}

export async function updateSystemSettingsApi(
  patch: UpdateSystemSettingsPayload,
  signal?: AbortSignal,
): Promise<SystemSettingsDto> {
  return apiRequest<SystemSettingsDto>('/api/v1/system/settings', {
    method: 'PUT',
    body: patch,
    signal,
  });
}

export async function setLegalConsentApi(
  accepted: boolean,
  signal?: AbortSignal,
): Promise<SystemSettingsDto> {
  return apiRequest<SystemSettingsDto>('/api/v1/system/legal-consent', {
    method: 'POST',
    body: { accepted },
    signal,
  });
}

export async function saveYoutubeApiKeyApi(
  apiKey: string,
  signal?: AbortSignal,
): Promise<SystemSettingsDto> {
  return apiRequest<SystemSettingsDto>('/api/v1/system/youtube-api-key', {
    method: 'PUT',
    body: { apiKey },
    signal,
  });
}

export async function deleteYoutubeApiKeyApi(signal?: AbortSignal): Promise<SystemSettingsDto> {
  return apiRequest<SystemSettingsDto>('/api/v1/system/youtube-api-key', {
    method: 'DELETE',
    signal,
  });
}

export async function fetchQuotaStatus(signal?: AbortSignal): Promise<QuotaStatusDto> {
  return apiRequest<QuotaStatusDto>('/api/v1/system/quota', { signal });
}

export async function purgeYoutubeCacheApi(signal?: AbortSignal): Promise<PurgeCacheResultDto> {
  return apiRequest<PurgeCacheResultDto>('/api/v1/system/purge-youtube-cache', {
    method: 'POST',
    signal,
  });
}

export async function fetchProjectsApi(signal?: AbortSignal): Promise<ProjectDto[]> {
  const res = await apiRequest<{ items: ProjectDto[] }>('/api/v1/projects', { signal });
  return res.items;
}

export async function createProjectApi(
  payload: CreateProjectPayload,
  signal?: AbortSignal,
): Promise<ProjectDto> {
  const res = await apiRequest<{ project: ProjectDto }>('/api/v1/projects', {
    method: 'POST',
    body: payload,
    signal,
  });
  return res.project;
}

export async function updateProjectApi(
  projectId: string,
  patch: UpdateProjectPayload,
  signal?: AbortSignal,
): Promise<ProjectDto> {
  const res = await apiRequest<{ project: ProjectDto }>(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
    method: 'PUT',
    body: patch,
    signal,
  });
  return res.project;
}

export async function exportProjectJsonApi(
  projectId: string,
  fallbackSlug: string,
  signal?: AbortSignal,
): Promise<string> {
  const { blob, filename } = await apiDownloadFile(
    `/api/v1/projects/${encodeURIComponent(projectId)}/export`,
    `research-studio-${fallbackSlug}.json`,
    signal,
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
}

export async function deleteProjectApi(
  projectId: string,
  confirmName: string,
  signal?: AbortSignal,
): Promise<DeleteProjectResultDto> {
  return apiRequest<DeleteProjectResultDto>(`/api/v1/projects/${encodeURIComponent(projectId)}/delete`, {
    method: 'POST',
    body: { confirmName },
    signal,
  });
}
