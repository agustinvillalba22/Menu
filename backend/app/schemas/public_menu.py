import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer

from app.models.menu import CategoryType
from app.models.style import FontFamily


class PublicTagRead(BaseModel):
    id: uuid.UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class PublicItemRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    price: Decimal
    tags: list[PublicTagRead]

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("price")
    def _price(self, v: Decimal) -> str:
        return f"{v:.2f}"


class PublicSubcategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    items: list[PublicItemRead]

    model_config = ConfigDict(from_attributes=True)


class PublicCategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    type: CategoryType
    subcategories: list[PublicSubcategoryRead]

    model_config = ConfigDict(from_attributes=True)


class PublicRestaurantRead(BaseModel):
    name: str
    slug: str

    model_config = ConfigDict(from_attributes=True)


class PublicStyleRead(BaseModel):
    font_family: FontFamily
    primary_color: str | None
    secondary_color: str | None

    model_config = ConfigDict(from_attributes=True)


class PublicMenuResponse(BaseModel):
    restaurant: PublicRestaurantRead
    style: PublicStyleRead | None
    categories: list[PublicCategoryRead]
