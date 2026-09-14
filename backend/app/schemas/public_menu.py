import uuid
from datetime import time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer

from app.models.item_modifier import ModifierType
from app.models.menu import CategoryIcon, CategoryType
from app.models.style import FontFamily


class PublicTagRead(BaseModel):
    id: uuid.UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class PublicItemModifierRead(BaseModel):
    id: uuid.UUID
    name: str
    price_delta: Decimal
    type: ModifierType

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("price_delta")
    def _price_delta(self, v: Decimal) -> str:
        return f"{v:.2f}"


class PublicItemRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    price: Decimal
    image_url: str | None = None
    tags: list[PublicTagRead]
    modifiers: list[PublicItemModifierRead]

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
    # P8: same nullable curated icon key used by the dashboard. The public menu
    # reads it to render the Lucide component next to the chip name; null
    # means "text-only chip".
    icon: CategoryIcon | None = None
    subcategories: list[PublicSubcategoryRead]

    model_config = ConfigDict(from_attributes=True)


class PublicBusinessHoursRead(BaseModel):
    """One row per weekday, as the owner set them.

    Returned as bare ints + times (no "Mon" string): the public menu's
    client-side formatters render them per-locale, and the weekday int
    matches ``datetime.weekday()`` so the open/closed pill and any "today"
    highlight share one definition.
    """

    weekday: int
    open_time: time
    close_time: time

    model_config = ConfigDict(from_attributes=True)


class PublicRestaurantRead(BaseModel):
    name: str
    slug: str
    # Exposed so the public menu can gate the ordering UI (cart/checkout)
    # client-side. The server still enforces it on POST /menu/{qr_token}/orders
    # (404 orders_disabled); this field only drives what the SPA renders.
    orders_enabled: bool
    # P6 — local info shown in the public header (logo, address, phone,
    # schedule summary + Abierto/Cerrado pill). All nullable OR empty-string
    # tolerant so a brand-new restaurant with no info yet renders clean.
    address: str
    phone: str
    logo_url: str | None = None
    timezone: str
    business_hours: list[PublicBusinessHoursRead]
    is_open_now: bool
    # P7 — lets the public checkout decide whether to render the
    # "Confirmar por WhatsApp" button without a second round trip. The phone
    # itself is never sent: only a boolean so we don't leak the raw number to
    # page-source scrapers; the deep link URL is minted server-side in the
    # POST /orders response and that's the only place the real wa.me URL lives.
    whatsapp_enabled: bool

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
