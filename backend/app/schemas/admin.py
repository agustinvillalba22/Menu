import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AdminUserRead(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    is_superadmin: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserUpdate(BaseModel):
    # None (unset) = leave unchanged; the service only applies fields present
    # in the request body (exclude_unset), so a PATCH with only one field
    # never touches the other.
    is_active: bool | None = None
    is_superadmin: bool | None = None


class AdminRestaurantRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    qr_token: str
    is_active: bool
    orders_enabled: bool
    # Email of the user with role `owner` on this restaurant; None if no
    # owner is assigned. Not a column on Restaurant — injected by the router.
    owner_email: str | None

    model_config = ConfigDict(from_attributes=True)


class AdminRestaurantUpdate(BaseModel):
    is_active: bool
