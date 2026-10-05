"""
FIPEX Explorer Server Entrypoint.
Delegates to modular, SOLID layered architecture in backend/ package.
"""
import uvicorn
from backend.core.config import settings
from backend.main import create_app

app = create_app()

if __name__ == "__main__":
    uvicorn.run("server:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
