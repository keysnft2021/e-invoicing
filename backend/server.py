"""Enterprise E-Invoicing Platform — API entrypoint."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from deps import init_db, close_db, get_db, ensure_indexes
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
from routes.ics import router as ics_router
from routes.bulk import router as bulk_router
from routes.pdf_route import router as pdf_router
from routes.api_clients import router as api_clients_router
from routes.frequent_contacts import router as frequent_contacts_router

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger("einvoice")

app = FastAPI(
    title="Enterprise E-Invoicing Platform",
    version="1.0.0",
    docs_url=os.environ.get("DOCS_URL", "/api/docs"),
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

# Compress JSON responses > 500 bytes — huge win on list endpoints.
app.add_middleware(GZipMiddleware, minimum_size=500)

# CORS
if os.environ.get("CORS_ORIGINS", "*") == "*":
    app.add_middleware(
        CORSMiddleware, allow_origin_regex=".*",
        allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
    )
else:
    origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware, allow_origins=origins,
        allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
    )


@app.on_event("startup")
async def _startup():
    init_db()
    db = get_db()
    await ensure_indexes(db)
    await seed(db)
    logger.info("Startup complete — indexes ensured, demo seed applied.")


@app.on_event("shutdown")
async def _shutdown():
    close_db()


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "einvoice-platform", "version": "1.0.0"}


for r in [auth_router, companies_router, masters_router, invoices_router,
          dashboard_router, mytax_router, admin_router, audit_router,
          signing_router, gov_config_router, ics_router, bulk_router, pdf_router,
          api_clients_router, frequent_contacts_router]:
    app.include_router(r)
