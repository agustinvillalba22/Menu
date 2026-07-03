from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.auth import router as auth_router
from app.routers.category import router as category_router
from app.routers.health import router as health_router
from app.routers.item import router as item_router
from app.routers.public_menu import router as public_menu_router
from app.routers.restaurant import router as restaurant_router
from app.routers.subcategory import router as subcategory_router

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(restaurant_router, prefix="/restaurants", tags=["restaurants"])
app.include_router(category_router, prefix="/restaurants", tags=["categories"])
app.include_router(subcategory_router, prefix="/restaurants", tags=["subcategories"])
app.include_router(item_router, prefix="/restaurants", tags=["items"])
app.include_router(public_menu_router, tags=["public"])
