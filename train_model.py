import os, joblib, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

BASE_DIR = os.path.dirname(__file__)
df = pd.read_csv(os.path.join(BASE_DIR,"data.csv"))
features = ["AI_Dependency_Index","Prior_GWA","Study_Hours_Per_Week","Motivation_Score","Environment_Score"]
X = df[features].fillna(0).values
y = df["High_Risk_Flag"].values

scaler = StandardScaler()
Xs = scaler.fit_transform(X)
X_train, X_test, y_train, y_test = train_test_split(Xs,y,test_size=0.2,random_state=42,stratify=y)
model = LogisticRegression(max_iter=500)
model.fit(X_train,y_train)
joblib.dump({"scaler":scaler,"model":model}, os.path.join(BASE_DIR,"model.joblib"))
print("Model trained and saved to model.joblib")