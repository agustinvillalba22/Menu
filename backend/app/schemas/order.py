import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_serializer

from app.models.item_modifier import ModifierType
from app.models.order import OrderStatus, OrderType, PaymentMethod, PaymentStatus


class OrderItemCreate(BaseModel):
    item_id: uuid.UUID
    # Upper bounds prevent a single anonymous request from amplifying into an
    # unbounded DB write, or driving subtotal/total past Numeric(10,2)'s range
    # (which would otherwise surface as an unhandled 500 on Postgres — SQLite's
    # NUMERIC affinity does not enforce the same limit, so this must be caught
    # here, not relied upon at the DB layer).
    quantity: int = Field(ge=1, le=999)
    modifier_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)
    special_instructions: str | None = Field(default=None, max_length=300)


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    order_type: OrderType
    table_or_address: str | None = Field(default=None, max_length=200)
    # When order_type == 'mesa' and the restaurant has real tables
    # configured, the client sends the picked table's id instead of free
    # text — the server stamps table_or_address itself (see create_order).
    table_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=500)
    # Omitted/cash = pay at the venue (legacy behavior, untouched).
    payment_method: PaymentMethod = PaymentMethod.cash
    # max_length caps request size / DB writes for this public, unauthenticated
    # endpoint.
    items: list[OrderItemCreate] = Field(min_length=1, max_length=100)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    # Optional attribution; omitted = leave previous value untouched.
    staff_member_id: uuid.UUID | None = None


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
    # Promo discount applied to this line (NULL = none). The
    # registry shows "-20%" next to the list price so the owner can audit
    # why subtotal < unit_price_snapshot * quantity.
    discount_pct: int | None = None
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
    table_id: uuid.UUID | None = None
    notes: str | None
    total: Decimal
    created_at: datetime
    updated_at: datetime
    cash_shift_id: uuid.UUID | None = None
    handled_by_id: uuid.UUID | None = None
    handled_by_name: str | None = None
    # Online-payment state. ``payment_url`` (the Checkout Pro init_point)
    # is only set by the public POST for mercadopago orders.
    payment_method: PaymentMethod = PaymentMethod.cash
    payment_status: PaymentStatus = PaymentStatus.none
    payment_url: str | None = None
    items: list[OrderItemRead]
    # Pre-built ``https://wa.me/...`` URL the customer's checkout UI opens
    # after the order is persisted. Null when the restaurant has no
    # ``whatsapp_phone`` (button hidden) or when the read comes from the
    # dashboard side (list/patch), where the URL is irrelevant — it's only set
    # by the public POST endpoint, since only that router has the restaurant
    # at hand to build it. Default null keeps every other caller valid.
    whatsapp_url: str | None = None
    # Per-order guest credential. Returned only by the public POST (set
    # explicitly by the router). The validation alias points at an attribute
    # the model does not have, so ``from_attributes`` never leaks the stored
    # token through the dashboard list/patch/occupancy reads.
    public_token: str | None = Field(
        default=None, validation_alias=AliasChoices("public_token_issued")
    )

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("total")
    def _total(self, v: Decimal) -> str:
        return f"{v:.2f}"


# ---------------------------------------------------------------------------
# public "Tu consumo" (token-based, anonymous)
# ---------------------------------------------------------------------------

_TOKEN_MIN_LENGTH = 20
_TOKEN_MAX_LENGTH = 64
_MAX_STATUS_TOKENS = 20

PublicToken = Annotated[
    str, Field(min_length=_TOKEN_MIN_LENGTH, max_length=_TOKEN_MAX_LENGTH)
]


class PublicOrderStatusRequest(BaseModel):
    tokens: list[PublicToken] = Field(min_length=1, max_length=_MAX_STATUS_TOKENS)


class PublicBillRequest(BaseModel):
    token: PublicToken


class PublicOrderLineRead(BaseModel):
    name: str
    quantity: int
    subtotal: Decimal
    modifiers: list[str]

    @field_serializer("subtotal")
    def _subtotal(self, v: Decimal) -> str:
        return f"{v:.2f}"


class PublicOrderStatusRead(BaseModel):
    token: str
    status: OrderStatus
    created_at: datetime
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    total: Decimal
    table_number: int | None
    bill_requested: bool
    items: list[PublicOrderLineRead]

    @field_serializer("total")
    def _total(self, v: Decimal) -> str:
        return f"{v:.2f}"


class PublicBillRequestRead(BaseModel):
    bill_requested: bool
    bill_requested_at: datetime
