"""Enterprise E-Invoicing Platform — API entrypoint."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from deps import init_db, close_db, get_db
from seed import seed
from routes.auth import router as auth_router
from routes.companies import router as companies_router
from routes.masters import router as masters_router
from routes.invoices import router as invoices_router
from routes.dashboard import router as dashboard_router
from routes.mytax import router as mytax_router
from routes.admin import router as admin_router
from routes.audit_route import router as audit_router
from routes.signing import router as signing_router
from routes.gov_config import router as gov_config_router

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("einvoice")

app = FastAPI(title="Enterprise E-Invoicing Platform", version="1.0.0")

# CORS
origins = [os.environ.get("FRONTEND_URL", "http://localhost:3000")]
if os.environ.get("CORS_ORIGINS", "*") == "*":
    # Reflect any allowed origin (dev-friendly, still credentialed)
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                        allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def _startup():
    init_db()
    db = get_db()
    await seed(db)
    logger.info("Seed complete. Admin ready.")


@app.on_event("shutdown")
async def _shutdown():
    close_db()


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "einvoice-platform"}


for r in [auth_router, companies_router, masters_router, invoices_router,
          dashboard_router, mytax_router, admin_router, audit_router,
          signing_router, gov_config_router]:
    app.include_router(r)
