from pydantic import BaseModel

from app.models.order import OrderStatus, PaymentStatus
from app.models.payment_account import PaymentAccountStatus


class MercadoPagoConnectRead(BaseModel):
    authorization_url: str


class MercadoPagoStatusRead(BaseModel):
    """Connection state only — tokens are never part of any response."""

    configured: bool
    connected: bool
    status: PaymentAccountStatus | None = None
    mp_user_id: str | None = None


class PublicPaymentStatusRead(BaseModel):
    payment_status: PaymentStatus
    status: OrderStatus
