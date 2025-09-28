from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import time
import logging
import json


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model variables
logistic_model: LogisticRegression = None
random_forest_model: RandomForestClassifier = None
feature_names = []
model_training_time = None
model_accuracy = {"logistic": 0.0, "random_forest": 0.0}

# Lifespan handler for startup and shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting ML service...")
    train_models()
    yield
    # Shutdown
    logger.info("Shutting down ML service...")

app = FastAPI(title="Bot Detection ML Service", version="1.0.0", lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc}")
    logger.error(f"Request body: {await request.body()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body}
    )


class BotFeatures(BaseModel):
    ip: str
    userAgent: str
    platform: str
    amount: float
    currency: str = "INR" 
    ticketId: str = "" 
    userId: str = "" 
    geoData: Dict[str, Any] = {}
    deviceFingerprint: str = ""
    riskFactors: Dict[str, Any] = {}
    heuristics: Dict[str, Any] = {}
    
    headless: bool = False
    missingJs: bool = False
    geoMismatch: Optional[bool] = None  
    suspiciousUa: bool = False
    rapidPurchase: bool = False
    multipleDevices: bool = False
    unusualTiming: bool = False
    suspiciousPattern: bool = False
    deviceFingerprintMatch: bool = False
    paymentBehavior: bool = False
    
    class Config:
        extra = "allow"  
        
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if isinstance(v, dict):
           
            if 'userId' in v and hasattr(v['userId'], 'toString'):
                v['userId'] = str(v['userId'])
            
            if 'amount' in v:
                v['amount'] = float(v['amount'])
        return v


def generate_synthetic_data(num_samples=1000):
    global feature_names
   
    X = np.zeros((num_samples, 6))
    y = np.zeros(num_samples)

    
    X[:, 0] = np.random.uniform(10, 500, num_samples)  # amount
    X[:, 1] = np.random.randint(0, 5, num_samples)      # platform_encoded (0-4)
    X[:, 2] = np.random.randint(0, 3, num_samples)      # userAgent_encoded (0-2)
    X[:, 3] = np.random.randint(0, 2, num_samples)      # geoMismatch (0 or 1)
    X[:, 4] = np.random.randint(0, 2, num_samples)      # headlessBrowser (0 or 1)
    X[:, 5] = np.random.randint(0, 2, num_samples)      # highTransactionAmount (0 or 1)

    # Generate labels (y) based on some rules to simulate bot behavior
    # Bots are more likely with high amount, geoMismatch, headlessBrowser
    y = ((X[:, 0] > 300) * 0.4 + (X[:, 3] == 1) * 0.3 + (X[:, 4] == 1) * 0.3 + np.random.rand(num_samples) * 0.2) > 0.5
    y = y.astype(int)

    feature_names = ["amount", "platform_encoded", "userAgent_encoded", "geoMismatch", "headlessBrowser", "highTransactionAmount"]
    return X, y

# Function to train models
def train_models():
    global logistic_model, random_forest_model, model_training_time, model_accuracy
    start_time = time.time()
    
    logger.info("Generating synthetic data and training models...")
    X, y = generate_synthetic_data()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Train Logistic Regression
    logistic_model = LogisticRegression(random_state=42, max_iter=1000)
    logistic_model.fit(X_train, y_train)
    lr_accuracy = accuracy_score(y_test, logistic_model.predict(X_test))
    model_accuracy["logistic"] = lr_accuracy
    logger.info(f"Logistic Regression Accuracy: {lr_accuracy:.2f}")

    # Train Random Forest
    random_forest_model = RandomForestClassifier(random_state=42, n_estimators=100)
    random_forest_model.fit(X_train, y_train)
    rf_accuracy = accuracy_score(y_test, random_forest_model.predict(X_test))
    model_accuracy["random_forest"] = rf_accuracy
    logger.info(f"Random Forest Accuracy: {rf_accuracy:.2f}")
    
    model_training_time = time.time() - start_time
    logger.info(f"Models trained successfully in {model_training_time:.2f} seconds.")

# Helper function 
def preprocess_features(features: BotFeatures):
   
    platform_map = {"ticketmaster": 0, "eventbrite": 1, "stubhub": 2, "seatgeek": 3, "vividseats": 4}
    userAgent_map = {"chrome": 0, "firefox": 1, "safari": 2} 

    platform_encoded = platform_map.get(features.platform.lower(), -1)
    userAgent_encoded = userAgent_map.get(features.userAgent.lower(), -1) 

    
    geoMismatch = 1 if (features.geoMismatch is True or features.riskFactors.get("geoMismatch")) else 0
    headlessBrowser = 1 if (features.headless or features.riskFactors.get("headlessBrowser")) else 0
    highTransactionAmount = 1 if (features.amount > 1000 or features.riskFactors.get("highTransactionAmount")) else 0

    
    feature_vector = np.array([
        features.amount,
        platform_encoded,
        userAgent_encoded,
        geoMismatch,
        headlessBrowser,
        highTransactionAmount
    ]).reshape(1, -1) # Reshape for single prediction

    return feature_vector

@app.get("/health")
async def health_check():
    """
    Health check endpoint for the ML service.
    """
    try:
        if logistic_model is None or random_forest_model is None:
            raise HTTPException(status_code=503, detail="Models not trained")
        
        # Test prediction to ensure models are working
        test_features = BotFeatures(
            ip="127.0.0.1",
            userAgent="test",
            platform="test",
            amount=100.0,
            currency="INR",
            ticketId="test",
            userId="test"
        )
        processed_features = preprocess_features(test_features)
        _ = logistic_model.predict_proba(processed_features)
        _ = random_forest_model.predict_proba(processed_features)
        
        return {
            "status": "healthy",
            "models_trained": True,
            "training_time": model_training_time,
            "accuracy": model_accuracy,
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@app.post("/predict-raw")
async def predict_raw(request: Request):
    """Raw endpoint to see exactly what data is received"""
    try:
        body = await request.body()
        logger.info(f"Raw request body: {body}")
        data = json.loads(body)
        logger.info(f"Parsed JSON: {data}")
        return {"received": data}
    except Exception as e:
        logger.error(f"Error in raw endpoint: {e}")
        return {"error": str(e)}

@app.post("/predict")
async def predict(features: BotFeatures):
    """
    Predict bot score using trained Logistic Regression and Random Forest models.
    """
    try:
        logger.info(f"Received features: {features}")
        
        if logistic_model is None or random_forest_model is None:
            raise HTTPException(status_code=503, detail="Models not trained yet. Please wait for startup or retrain.")

        processed_features = preprocess_features(features)

        # Get probabilities from both models
        lr_proba = logistic_model.predict_proba(processed_features)[:, 1][0]
        rf_proba = random_forest_model.predict_proba(processed_features)[:, 1][0]

        # Combine probabilities (weighted average - Random Forest gets more weight)
        score = (lr_proba * 0.3 + rf_proba * 0.7)

        # Clamp score between 0 and 1
        score = max(0.0, min(1.0, score))

        logger.info(f"Prediction completed: score={score:.3f}, lr={lr_proba:.3f}, rf={rf_proba:.3f}")

        return {
            "score": score,
            "model_scores": {
                "logistic_regression": lr_proba,
                "random_forest": rf_proba
            },
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.get("/status")
async def get_status():
    """
    Get detailed service status and model information.
    """
    return {
        "service": "Bot Detection ML Service",
        "version": "1.0.0",
        "models_trained": logistic_model is not None and random_forest_model is not None,
        "training_time": model_training_time,
        "accuracy": model_accuracy,
        "feature_names": feature_names,
        "timestamp": time.time()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5005)
