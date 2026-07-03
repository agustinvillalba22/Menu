import { apiGet, apiPost } from './api'
import type { LoginCredentials, RegisterData, TokenResponse, User } from './types'

export function login(credentials: LoginCredentials): Promise<TokenResponse> {
  return apiPost<TokenResponse>('/auth/login', credentials)
}

export function register(data: RegisterData): Promise<TokenResponse> {
  return apiPost<TokenResponse>('/auth/register', data)
}

export async function logout(): Promise<void> {
  // Backend returns 204 with no body; the resolved value is ignored.
  await apiPost<void>('/auth/logout')
}

export function getMe(): Promise<User> {
  return apiGet<User>('/auth/me')
}
