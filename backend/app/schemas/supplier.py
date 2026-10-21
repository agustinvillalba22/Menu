import uuid

from pydantic import BaseModel, ConfigDict, Field


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str | None = Field(default=None, max_length=80)
    contact_person: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=60)
    email: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=300)
    delivery_days: str | None = Field(default=None, max_length=120)
    payment_terms: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=500)


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    category: str | None = Field(default=None, max_length=80)
    contact_person: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=60)
    email: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=300)
    delivery_days: str | None = Field(default=None, max_length=120)
    payment_terms: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=500)
    active: bool | None = None


class SupplierRead(BaseModel):
    id: uuid.UUID
    name: str
    category: str | None
    contact_person: str | None
    phone: str | None
    email: str | None
    address: str | None
    delivery_days: str | None
    payment_terms: str | None
    notes: str | None
    active: bool

    model_config = ConfigDict(from_attributes=True)
