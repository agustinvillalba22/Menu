import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, condecimal, field_serializer

from app.models.stock_item import StockCategory, StockUnit

Quantity = condecimal(max_digits=10, decimal_places=2, ge=0)


class StockItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: StockCategory
    unit: StockUnit
    quantity: Quantity = Decimal("0")
    min_threshold: Quantity = Decimal("0")
    cost_per_unit: Quantity | None = None
    supplier_id: uuid.UUID | None = None
    last_restocked: date | None = None


class StockItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    category: StockCategory | None = None
    unit: StockUnit | None = None
    quantity: Quantity | None = None
    min_threshold: Quantity | None = None
    cost_per_unit: Quantity | None = None
    supplier_id: uuid.UUID | None = None
    last_restocked: date | None = None


class StockItemRead(BaseModel):
    id: uuid.UUID
    name: str
    category: StockCategory
    unit: StockUnit
    quantity: Decimal
    min_threshold: Decimal
    cost_per_unit: Decimal | None
    supplier_id: uuid.UUID | None
    last_restocked: date | None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("quantity", "min_threshold")
    def _qty(self, v: Decimal) -> str:
        return f"{v:.2f}"

    @field_serializer("cost_per_unit")
    def _cost(self, v: Decimal | None) -> str | None:
        return None if v is None else f"{v:.2f}"
