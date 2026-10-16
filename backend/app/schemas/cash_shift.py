import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_serializer

MAX_AMOUNT = Decimal("99999999.99")


class CashShiftOpen(BaseModel):
    staff_member_id: uuid.UUID
    opening_amount: Decimal = Field(ge=0, le=MAX_AMOUNT, decimal_places=2)
    notes: str | None = Field(default=None, max_length=500)


class CashShiftClose(BaseModel):
    staff_member_id: uuid.UUID
    counted_amount: Decimal = Field(ge=0, le=MAX_AMOUNT, decimal_places=2)
    notes: str | None = Field(default=None, max_length=500)


class CashShiftRead(BaseModel):
    id: uuid.UUID
    opened_by_name: str
    opened_at: datetime
    opening_amount: Decimal
    closed_by_name: str | None
    closed_at: datetime | None
    counted_amount: Decimal | None
    expected_amount: Decimal | None
    notes: str | None
    # M28: completed orders linked to this shift (set by the service).
    orders_count: int = 0

    model_config = ConfigDict(from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def difference(self) -> Decimal | None:
        """counted - expected; only meaningful once the shift is closed."""
        if self.closed_at is None or self.counted_amount is None or self.expected_amount is None:
            return None
        return self.counted_amount - self.expected_amount

    @field_serializer("opening_amount", "counted_amount", "expected_amount", "difference")
    def _money(self, v: Decimal | None) -> str | None:
        return None if v is None else f"{v:.2f}"
