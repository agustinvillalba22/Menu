import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class PaymentAccountStatus(str, enum.Enum):
    connected = "connected"
    disconnected = "disconnected"


class PaymentAccount(Base, TimestampMixin):
    """A restaurant's connected payment-provider account (M36).

    One per restaurant. Tokens are Fernet-encrypted at rest (``*_enc``) and
    must never be returned by the API nor logged.
    """

    __tablename__ = "payment_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String, nullable=False)
    mp_user_id: Mapped[str] = mapped_column(String, nullable=False)
    access_token_enc: Mapped[str] = mapped_column(String, nullable=False)
    refresh_token_enc: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    status: Mapped[PaymentAccountStatus] = mapped_column(
        Enum(PaymentAccountStatus, native_enum=False),
        nullable=False,
        default=PaymentAccountStatus.connected,
    )

    # relationships
    restaurant: Mapped["app.models.restaurant.Restaurant"] = relationship(  # type: ignore[name-defined]
        "Restaurant",
        back_populates="payment_account",
    )
