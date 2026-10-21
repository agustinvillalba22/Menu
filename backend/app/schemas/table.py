import enum
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.schemas.order import OrderRead


class TableCreate(BaseModel):
    number: int = Field(ge=1, le=9999)
    capacity: int | None = Field(default=None, ge=1, le=99)


class TableUpdate(BaseModel):
    number: int | None = Field(default=None, ge=1, le=9999)
    capacity: int | None = Field(default=None, ge=1, le=99)


class TableRead(BaseModel):
    id: uuid.UUID
    number: int
    capacity: int | None
    bill_requested_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TableStatus(str, enum.Enum):
    free = "free"
    occupied = "occupied"
    bill = "bill"


class TableCheckoutRequest(BaseModel):
    staff_member_id: uuid.UUID | None = None


class TableOccupancyRead(BaseModel):
    id: uuid.UUID
    number: int
    capacity: int | None
    status: TableStatus
    total: Decimal
    first_order_at: datetime | None
    bill_requested_at: datetime | None
    orders: list[OrderRead]

    @field_serializer("total")
    def _total(self, v: Decimal) -> str:
        return f"{v:.2f}"
