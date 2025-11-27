from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd, joblib, os, numpy as np
from pydantic import BaseModel

BASE_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(BASE_DIR, "data.csv")
MODEL_PATH = os.path.join(BASE_DIR, "model.joblib")

app = FastAPI(title="IntelliGrade API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],)
df = pd.read_csv(DATA_PATH)
model_bundle = None
if os.path.exists(MODEL_PATH):
    model_bundle = joblib.load(MODEL_PATH)

@app.get("/")
def read_root():
    return {"message": "Welcome to IntelliGrade API", "status": "running"}

@app.get("/students")
def get_students():
    return df.to_dict(orient="records")

@app.get("/student/{student_id}")
def get_student(student_id: str):
    rec = df[df["Student_ID"]==student_id]
    if rec.empty:
        raise HTTPException(status_code=404, detail="Student not found")
    return rec.iloc[0].to_dict()

@app.get("/stats")
def stats():
    return {
        "total_students": int(len(df)),
        "avg_ai_index": float(df["AI_Dependency_Index"].mean()),
        "avg_final_grade": float(df["Final_Grade"].mean())
    }

@app.get("/predict/{student_id}")
def predict(student_id: str):
    rec = df[df["Student_ID"]==student_id]
    if rec.empty:
        raise HTTPException(status_code=404, detail="Student not found")
    row = rec.iloc[0]
   
    if model_bundle is not None:
        scaler = model_bundle["scaler"]
        model = model_bundle["model"]
        features = ["AI_Dependency_Index","Prior_GWA","Study_Hours_Per_Week","Motivation_Score","Environment_Score"]
        X = np.array([row[f] for f in features]).reshape(1,-1)
        Xs = scaler.transform(X)
        prob = float(model.predict_proba(Xs)[0][1])
        pred = int(model.predict(Xs)[0])
        return {"Student_ID": student_id, "predicted_risk_prob": prob, "predicted_risk": bool(pred)}
    else:
        risk = True if row["AI_Dependency_Index"]>5.5 else False
        return {"Student_ID": student_id, "predicted_risk_prob": None, "predicted_risk": risk}

class TrainRequest(BaseModel):
    retrain: bool = False

@app.post("/train")
def train_model(req: TrainRequest):
    
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    import joblib, numpy as np
    
    data = df.copy()
    features = ["AI_Dependency_Index","Prior_GWA","Study_Hours_Per_Week","Motivation_Score","Environment_Score"]
    X = data[features].fillna(0).values
    y = data["High_Risk_Flag"].values
    
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    X_train, X_test, y_train, y_test = train_test_split(Xs,y,test_size=0.2,random_state=42,stratify=y)
    model = LogisticRegression(max_iter=500)
    model.fit(X_train,y_train)
    joblib.dump({"scaler":scaler,"model":model}, os.path.join(BASE_DIR,"model.joblib"))
    return {"message":"Model trained and saved.", "train_samples": int(len(X_train)), "test_samples": int(len(X_test))}