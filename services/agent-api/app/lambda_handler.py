"""
AWS Lambda entry point.

Lambda speaks its own event/response format, not HTTP. Mangum is an adapter:
it translates a Lambda Function URL event into the ASGI call FastAPI expects,
then translates FastAPI's response back into what Lambda returns.

`app.main:app` stays completely unchanged — the same object Uvicorn serves
locally is the one Lambda serves in production.
"""

from mangum import Mangum

from .main import app

# The Dockerfile points Lambda at "app.lambda_handler.handler".
handler = Mangum(app)
