import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.restaurant import RestaurantRole


class RestaurantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class RestaurantUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    # None = leave unchanged (the service applies it via exclude_unset).
    orders_enabled: bool | None = None


class RestaurantRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    qr_token: str
    orders_enabled: bool
    # The current user's role for this restaurant, injected by the service layer —
    # not a column on Restaurant.
    role: RestaurantRole

    model_config = ConfigDict(from_attributes=True)
