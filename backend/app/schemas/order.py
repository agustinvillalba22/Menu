import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models.item_modifier import ModifierType
from app.models.order import OrderStatus, OrderType


class OrderItemCreate(BaseModel):
    item_id: uuid.UUID
    # Upper bounds prevent a single anonymous request from amplifying into an
    # unbounded DB write, or driving subtotal/total past Numeric(10,2)'s range
    # (which would otherwise surface as an unhandled 500 on Postgres — SQLite's
    # NUMERIC affinity does not enforce the same limit, so this must be caught
    # here, not relied upon at the DB layer). See M11 review CRIT-01.
    quantity: int = Field(ge=1, le=999)
    modifier_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)
    special_instructions: str | None = Field(default=None, max_length=300)


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    order_type: OrderType
    table_or_address: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=500)
    # max_length caps request size / DB writes for this public, unauthenticated
    # endpoint (M11 review CRIT-01).
    items: list[OrderItemCreate] = Field(min_length=1, max_length=100)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderItemModifierRead(BaseModel):
    id: uuid.UUID
    name_snapshot: str
    price_snapshot: Decimal
    type: ModifierType

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("price_snapshot")
    def _price_snapshot(self, v: Decimal) -> str:
        return f"{v:.2f}"


class OrderItemRead(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID | None
    name_snapshot: str
    unit_price_snapshot: Decimal
    quantity: int
    special_instructions: str | None
    subtotal: Decimal
    modifiers: list[OrderItemModifierRead]

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("unit_price_snapshot", "subtotal")
    def _prices(self, v: Decimal) -> str:
        return f"{v:.2f}"


class OrderRead(BaseModel):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    status: OrderStatus
    customer_name: str
    order_type: OrderType
    table_or_address: str | None
    notes: str | None
    total: Decimal
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemRead]

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("total")
    def _total(self, v: Decimal) -> str:
        return f"{v:.2f}"
