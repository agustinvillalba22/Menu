import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, condecimal, field_serializer

Price = condecimal(max_digits=10, decimal_places=2, ge=0)


class ItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)
    price: Price


class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    price: Price | None = None


class TagRead(BaseModel):
    id: uuid.UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class ItemRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    price: Decimal
    image_url: str | None = None
    subcategory_id: uuid.UUID
    tags: list[TagRead]

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("price")
    def _price_to_str(self, v: Decimal) -> str:
        return f"{v:.2f}"


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class ItemImageUploadRequest(BaseModel):
    content_type: str
    file_size: int = Field(gt=0)


class ItemImageUploadResponse(BaseModel):
    upload_url: str
    object_key: str
    expires_in: int


class ItemImageConfirmRequest(BaseModel):
    object_key: str = Field(min_length=1)


class ImportRowError(BaseModel):
    row: int
    reason: str
    detail: str | None = None


class ImportResult(BaseModel):
    imported: int
    errors: list[ImportRowError]
