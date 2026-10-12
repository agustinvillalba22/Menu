import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.staff_member import StaffPosition


class StaffMemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    position: StaffPosition
    pin: str = Field(pattern=r"^\d{4}$")


class StaffMemberUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    position: StaffPosition | None = None
    pin: str | None = Field(default=None, pattern=r"^\d{4}$")
    active: bool | None = None


class StaffMemberRead(BaseModel):
    id: uuid.UUID
    name: str
    position: StaffPosition
    pin: str
    active: bool

    model_config = ConfigDict(from_attributes=True)
