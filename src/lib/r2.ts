/**
 * PUTs the raw file straight to a presigned R2 URL. Deliberately does NOT go
 * through apiFetch: that prefixes VITE_API_URL and forces
 * `Content-Type: application/json`, both wrong here. It also omits
 * `credentials: 'include'` so the session cookie is never sent to the
 * external R2 origin. On a non-ok response it throws a plain Error (there is no
 * `{detail}` JSON body from R2 to wrap in an ApiError).
 */
export async function uploadImageToR2(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!res.ok) {
    throw new Error(`R2 upload failed with status ${res.status}`)
  }
}
