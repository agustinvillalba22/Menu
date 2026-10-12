import uuid

from pydantic import BaseModel, ConfigDict, Field


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

    model_config = ConfigDict(from_attributes=True)
