import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.menu import CategoryIcon, CategoryType


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: CategoryType
    # P8: nullable curated icon key. Defaults to None (text-only chip on the
    # public menu). Validated against the `CategoryIcon` enum by pydantic so a
    # typo in the dashboard can't reach the DB as a free string.
    icon: CategoryIcon | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: CategoryType | None = None
    # `None` here is meaningful (clears the icon), so the field is not flagged
    # `Optional[CategoryIcon | None]` — that would conflate "unset" with "null".
    # `exclude_unset=True` in `update_category` keeps a PATCH that omits the
    # field from touching the column, while an explicit `{"icon": null}` clears.
    icon: CategoryIcon | None = None


class CategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    type: CategoryType
    icon: CategoryIcon | None = None

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
