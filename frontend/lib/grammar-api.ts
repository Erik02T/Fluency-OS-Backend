import { tryRefreshAdminSession } from "@/lib/auth-api"
import {
  clearStoredAdminSession,
  emitAdminSessionExpired,
  loadStoredAccessToken,
  updateStoredAccessToken,
} from "@/lib/auth-storage"
import type { JLPTLevel } from "@/lib/kanji-api"

export type { JLPTLevel } from "@/lib/kanji-api"

export type GrammarReviewStatus =
  | "PENDING"
  | "GENERATED"
  | "VALIDATED"
  | "REVIEWED"
  | "PUBLISHED"

export interface GrammarUserProgressDto {
  isStudied: boolean
  isFavorited: boolean
  confidenceLevel: number
  reviewCount: number
}

export interface GrammarExamplePreviewDto {
  japanese: string
  reading: string | null
  translation: string
}

export interface GrammarListItemDto {
  id: string
  pattern: string
  title: string
  jlpt: JLPTLevel
  difficulty: number
  position: number
  formalityLevel: string
  tags: string[]
  shortExplanation: string
  reviewStatus: GrammarReviewStatus
  examplesPreview: GrammarExamplePreviewDto[]
  userProgress?: GrammarUserProgressDto
}

export interface PaginatedGrammarResponseDto {
  data: GrammarListItemDto[]
  pagination: {
    page: number
    perPage: number
    total: number
    pages: number
  }
}

export interface GrammarDetailExampleDto {
  japanese: string
  reading: string | null
  translation: string
  notes: string | null
  isNatural: boolean
}

export interface GrammarDetailResponseDto {
  id: string
  pattern: string
  title: string
  jlpt: JLPTLevel
  difficulty: number
  position: number
  formalityLevel: string
  tags: string[]
  shortExplanation: string
  detailedExplanation: string | null
  examples: GrammarDetailExampleDto[]
  reviewStatus: GrammarReviewStatus
  source?: string | null
  sourceId?: string | null
  contentVersion?: number
  reviewedAt?: string | Date | null
  updatedAt?: string | Date
  userProgress?: {
    isStudied: boolean
    studiedAt?: string | Date
    isFavorited: boolean
    confidenceLevel: number
    notes?: string | null
    reviewCount: number
  }
}

export interface GrammarProgressResponseDto {
  grammarPointId: string
  isStudied: boolean
  studiedAt?: string | Date
  isFavorited: boolean
  confidenceLevel: number
  notes?: string | null
  reviewCount: number
}

export interface GrammarListQueryParams {
  page?: number
  perPage?: number
  jlpt?: JLPTLevel
  status?: GrammarReviewStatus
  tag?: string
  difficulty?: number
  search?: string
  sort?: "difficulty" | "jlpt" | "pattern" | "createdAt" | "position"
  order?: "asc" | "desc"
}

export interface UpdateGrammarProgressDto {
  action: "study" | "review"
  understood?: boolean
  confidenceLevel?: number
}

export interface AdminGrammarExampleDto {
  japanese: string
  reading?: string | null
  translation: string
  notes?: string | null
  isNatural?: boolean
}

export interface CreateGrammarPointDto {
  pattern: string
  jlptLevel: JLPTLevel
  title: string
  shortExplanation: string
  detailedExplanation?: string | null
  formalityLevel?: string
  difficulty?: number
  position?: number
  tags?: string[]
  examples?: AdminGrammarExampleDto[]
}

export type UpdateGrammarPointDto = Partial<CreateGrammarPointDto>

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

function buildQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue
    }

    searchParams.set(key, String(value))
  }

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ""
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  includeAuthToken = false,
): Promise<T> {
  let shouldExpireSession = false

  const createHeaders = (token?: string | null): Headers => {
    const headers = new Headers(options.headers)
    headers.set("Accept", "application/json")

    if (options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json")
    }

    if (includeAuthToken && token) {
      headers.set("Authorization", `Bearer ${token}`)
    }

    return headers
  }

  const accessToken = includeAuthToken ? loadStoredAccessToken() : null
  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: createHeaders(accessToken),
    cache: "no-store",
  })

  if (response.status === 401 && includeAuthToken) {
    const refreshedToken = await tryRefreshAdminSession()

    if (refreshedToken) {
      updateStoredAccessToken(refreshedToken)
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: createHeaders(refreshedToken),
        cache: "no-store",
      })
    } else {
      shouldExpireSession = true
    }
  }

  if (response.status === 401 && includeAuthToken) {
    shouldExpireSession = true
  }

  if (shouldExpireSession) {
    clearStoredAdminSession()
    emitAdminSessionExpired()
  }

  if (!response.ok) {
    const details = await response.text()
    throw new Error(details || `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

async function requestNoContent(path: string, options: RequestInit = {}): Promise<void> {
  let shouldExpireSession = false

  const createHeaders = (token?: string | null): Headers => {
    const headers = new Headers(options.headers)
    headers.set("Accept", "application/json")
    headers.set("Content-Type", "application/json")

    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }

    return headers
  }

  const accessToken = loadStoredAccessToken()
  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: createHeaders(accessToken),
    cache: "no-store",
  })

  if (response.status === 401) {
    const refreshedToken = await tryRefreshAdminSession()

    if (refreshedToken) {
      updateStoredAccessToken(refreshedToken)
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: createHeaders(refreshedToken),
        cache: "no-store",
      })
    } else {
      shouldExpireSession = true
    }
  }

  if (response.status === 401) {
    shouldExpireSession = true
  }

  if (shouldExpireSession) {
    clearStoredAdminSession()
    emitAdminSessionExpired()
  }

  if (!response.ok) {
    const details = await response.text()
    throw new Error(details || `Request failed with status ${response.status}`)
  }
}

export function buildGrammarListQuery(params: GrammarListQueryParams): string {
  return buildQueryString({
    page: params.page,
    perPage: params.perPage,
    jlpt: params.jlpt,
    status: params.status,
    tag: params.tag,
    difficulty: params.difficulty,
    search: params.search,
    sort: params.sort,
    order: params.order,
  })
}

export function getGrammarList(
  params: GrammarListQueryParams = {},
  options: RequestInit = {},
): Promise<PaginatedGrammarResponseDto> {
  return requestJson<PaginatedGrammarResponseDto>(
    `/grammar${buildGrammarListQuery(params)}`,
    {
      ...options,
      method: "GET",
    },
    true,
  )
}

export function getGrammarDetail(
  id: string,
  options: RequestInit = {},
): Promise<GrammarDetailResponseDto> {
  return requestJson<GrammarDetailResponseDto>(
    `/grammar/${id}`,
    {
      ...options,
      method: "GET",
    },
    true,
  )
}

export function getAdminGrammarList(
  params: GrammarListQueryParams = {},
  options: RequestInit = {},
): Promise<PaginatedGrammarResponseDto> {
  return requestJson<PaginatedGrammarResponseDto>(
    `/admin/grammar-points${buildGrammarListQuery(params)}`,
    {
      ...options,
      method: "GET",
    },
    true,
  )
}

export function getAdminGrammarDetail(
  id: string,
  options: RequestInit = {},
): Promise<GrammarDetailResponseDto> {
  return requestJson<GrammarDetailResponseDto>(
    `/admin/grammar-points/${id}`,
    {
      ...options,
      method: "GET",
    },
    true,
  )
}

export function updateGrammarProgress(
  id: string,
  payload: UpdateGrammarProgressDto,
  options: RequestInit = {},
): Promise<GrammarProgressResponseDto> {
  return requestJson<GrammarProgressResponseDto>(
    `/grammar/${id}/progress`,
    {
      ...options,
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  )
}

export function createGrammarPoint(
  payload: CreateGrammarPointDto,
  options: RequestInit = {},
): Promise<GrammarDetailResponseDto> {
  return requestJson<GrammarDetailResponseDto>(
    `/admin/grammar-points`,
    {
      ...options,
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  )
}

export function updateGrammarPoint(
  id: string,
  payload: UpdateGrammarPointDto,
  options: RequestInit = {},
): Promise<GrammarDetailResponseDto> {
  return requestJson<GrammarDetailResponseDto>(
    `/admin/grammar-points/${id}`,
    {
      ...options,
      method: "PUT",
      body: JSON.stringify(payload),
    },
    true,
  )
}

export function deleteGrammarPoint(id: string, options: RequestInit = {}): Promise<void> {
  return requestNoContent(`/admin/grammar-points/${id}`, {
    ...options,
    method: "DELETE",
  })
}
