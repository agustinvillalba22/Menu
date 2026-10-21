from pydantic import BaseModel, Field


class ImageUploadRequest(BaseModel):
    content_type: str
    file_size: int = Field(gt=0)


class ImageUploadResponse(BaseModel):
    upload_url: str
    object_key: str
    expires_in: int


class ImageConfirmRequest(BaseModel):
    object_key: str = Field(min_length=1)
