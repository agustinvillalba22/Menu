import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.menu import CategoryType


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: CategoryType


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: CategoryType | None = None


class CategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    type: CategoryType

    model_config = ConfigDict(from_attributes=True)


class SubcategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class SubcategoryUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class SubcategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    category_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
