import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from './api'
import type {
  Category,
  CategoryCreate,
  CategoryUpdate,
  Subcategory,
  SubcategoryCreate,
  SubcategoryUpdate,
  Item,
  ItemCreate,
  ItemUpdate,
  Tag,
  TagCreate,
  Modifier,
  ModifierCreate,
  ModifierUpdate,
  ImportResult,
  ItemImageUploadRequest,
  ItemImageUploadResponse,
} from './types'

// --- Categories ------------------------------------------------------------

export function listCategories(restaurantId: string): Promise<Category[]> {
  return apiGet<Category[]>(`/restaurants/${restaurantId}/categories`)
}

export function createCategory(restaurantId: string, data: CategoryCreate): Promise<Category> {
  return apiPost<Category>(`/restaurants/${restaurantId}/categories`, data)
}

export function updateCategory(
  restaurantId: string,
  categoryId: string,
  data: CategoryUpdate,
): Promise<Category> {
  return apiPatch<Category>(`/restaurants/${restaurantId}/categories/${categoryId}`, data)
}

export function deleteCategory(restaurantId: string, categoryId: string): Promise<void> {
  return apiDelete<void>(`/restaurants/${restaurantId}/categories/${categoryId}`)
}

// --- Subcategories ---------------------------------------------------------

export function listSubcategories(restaurantId: string, categoryId: string): Promise<Subcategory[]> {
  return apiGet<Subcategory[]>(`/restaurants/${restaurantId}/categories/${categoryId}/subcategories`)
}

export function createSubcategory(
  restaurantId: string,
  categoryId: string,
  data: SubcategoryCreate,
): Promise<Subcategory> {
  return apiPost<Subcategory>(
    `/restaurants/${restaurantId}/categories/${categoryId}/subcategories`,
    data,
  )
}

export function updateSubcategory(
  restaurantId: string,
  categoryId: string,
  subcategoryId: string,
  data: SubcategoryUpdate,
): Promise<Subcategory> {
  return apiPatch<Subcategory>(
    `/restaurants/${restaurantId}/categories/${categoryId}/subcategories/${subcategoryId}`,
    data,
  )
}

export function deleteSubcategory(
  restaurantId: string,
  categoryId: string,
  subcategoryId: string,
): Promise<void> {
  return apiDelete<void>(
    `/restaurants/${restaurantId}/categories/${categoryId}/subcategories/${subcategoryId}`,
  )
}

// --- Items -----------------------------------------------------------------
// Items hang off subcategoryId, NOT categoryId, in the URL.

export function listItems(restaurantId: string, subcategoryId: string): Promise<Item[]> {
  return apiGet<Item[]>(`/restaurants/${restaurantId}/subcategories/${subcategoryId}/items`)
}

export function createItem(
  restaurantId: string,
  subcategoryId: string,
  data: ItemCreate,
): Promise<Item> {
  return apiPost<Item>(`/restaurants/${restaurantId}/subcategories/${subcategoryId}/items`, data)
}

export function updateItem(
  restaurantId: string,
  subcategoryId: string,
  itemId: string,
  data: ItemUpdate,
): Promise<Item> {
  return apiPatch<Item>(
    `/restaurants/${restaurantId}/subcategories/${subcategoryId}/items/${itemId}`,
    data,
  )
}

export function deleteItem(
  restaurantId: string,
  subcategoryId: string,
  itemId: string,
): Promise<void> {
  return apiDelete<void>(
    `/restaurants/${restaurantId}/subcategories/${subcategoryId}/items/${itemId}`,
  )
}

// --- Tags ------------------------------------------------------------------

export function addTag(
  restaurantId: string,
  subcategoryId: string,
  itemId: string,
  data: TagCreate,
): Promise<Tag> {
  return apiPost<Tag>(
    `/restaurants/${restaurantId}/subcategories/${subcategoryId}/items/${itemId}/tags`,
    data,
  )
}

export function removeTag(
  restaurantId: string,
  subcategoryId: string,
  itemId: string,
  tagId: string,
): Promise<void> {
  return apiDelete<void>(
    `/restaurants/${restaurantId}/subcategories/${subcategoryId}/items/${itemId}/tags/${tagId}`,
  )
}

// --- Modifiers (M11) -------------------------------------------------------
// Nested under an item, same URL shape as tags.

export function listModifiers(
  restaurantId: string,
  subcategoryId: string,
  itemId: string,
): Promise<Modifier[]> {
  return apiGet<Modifier[]>(
    `/restaurants/${restaurantId}/subcategories/${subcategoryId}/items/${itemId}/modifiers`,
  )
}

export function addModifier(
  restaurantId: string,
  subcategoryId: string,
  itemId: string,
  data: ModifierCreate,
): Promise<Modifier> {
  return apiPost<Modifier>(
    `/restaurants/${restaurantId}/subcategories/${subcategoryId}/items/${itemId}/modifiers`,
    data,
  )
}

export function updateModifier(
  restaurantId: string,
  subcategoryId: string,
  itemId: string,
  modifierId: string,
  data: ModifierUpdate,
): Promise<Modifier> {
  return apiPatch<Modifier>(
    `/restaurants/${restaurantId}/subcategories/${subcategoryId}/items/${itemId}/modifiers/${modifierId}`,
    data,
  )
}

export function removeModifier(
  restaurantId: string,
  subcategoryId: string,
  itemId: string,
  modifierId: string,
): Promise<void> {
  return apiDelete<void>(
    `/restaurants/${restaurantId}/subcategories/${subcategoryId}/items/${itemId}/modifiers/${modifierId}`,
  )
}

// --- Item image upload (M10) -----------------------------------------------
// Presigned PUT + confirm flow (mirrors the M4 backend contract). The binary
// never touches our API: we ask for a presigned URL, PUT the file straight to
// R2, then confirm against the backend.

export function getItemImageUploadUrl(
  restaurantId: string,
  subcategoryId: string,
  itemId: string,
  data: ItemImageUploadRequest,
): Promise<ItemImageUploadResponse> {
  return apiPost<ItemImageUploadResponse>(
    `/restaurants/${restaurantId}/subcategories/${subcategoryId}/items/${itemId}/image/upload-url`,
    data,
  )
}

export function confirmItemImageUpload(
  restaurantId: string,
  subcategoryId: string,
  itemId: string,
  objectKey: string,
): Promise<Item> {
  return apiPost<Item>(
    `/restaurants/${restaurantId}/subcategories/${subcategoryId}/items/${itemId}/image/confirm`,
    { object_key: objectKey },
  )
}

export function deleteItemImage(
  restaurantId: string,
  subcategoryId: string,
  itemId: string,
): Promise<void> {
  return apiDelete<void>(
    `/restaurants/${restaurantId}/subcategories/${subcategoryId}/items/${itemId}/image`,
  )
}

/**
 * PUTs the raw file straight to the presigned R2 URL. Deliberately does NOT go
 * through apiFetch: that prefixes VITE_API_URL and forces
 * `Content-Type: application/json`, both wrong here. It also omits
 * `credentials: 'include'` (RNF-02) so the session cookie is never sent to the
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

// --- CSV import ------------------------------------------------------------

export function importItemsCsv(
  restaurantId: string,
  file: File,
  createMissing?: boolean,
): Promise<ImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  // Only append when true: keeps the request byte-identical to before this
  // flag existed when the caller doesn't opt in (RNF-01/CA-07).
  if (createMissing) {
    formData.append('create_missing', 'true')
  }
  return apiUpload<ImportResult>(`/restaurants/${restaurantId}/items/import`, formData)
}
