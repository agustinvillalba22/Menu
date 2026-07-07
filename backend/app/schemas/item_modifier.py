import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, condecimal, field_serializer

from app.models.item_modifier import ModifierType

# No ge=0 (unlike Item.price): a modifier delta can be negative (removal).
PriceDelta = condecimal(max_digits=10, decimal_places=2)


class ItemModifierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    price_delta: PriceDelta
    type: ModifierType


class ItemModifierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    price_delta: PriceDelta | None = None
    type: ModifierType | None = None


class ItemModifierRead(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    name: str
    price_delta: Decimal
    type: ModifierType

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("price_delta")
    def _price_delta_to_str(self, v: Decimal) -> str:
        return f"{v:.2f}"
