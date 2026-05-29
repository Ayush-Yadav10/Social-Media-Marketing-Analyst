# =========================
# FIX MEMORY ERROR
# =========================
import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

# =========================
# IMPORTS
# =========================
import pandas as pd
from flask import Flask, render_template, request
from sklearn.linear_model import LinearRegression
import matplotlib.pyplot as plt
from PIL import Image
import numpy as np

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'

# =========================
# LOAD DATA
# =========================
data = pd.read_csv('social_ai_data.csv')
data.columns = data.columns.str.strip().str.lower()

x_col = 'posthour'
y_col = 'likes'

# =========================
# TRAIN MODEL
# =========================
X = data[[x_col]]
y = data[y_col]

model = LinearRegression()
model.fit(X, y)

# =========================
# FUNCTIONS
# =========================
def predict_engagement(hour):
    input_df = pd.DataFrame([[hour]], columns=[x_col])
    return round(float(model.predict(input_df)[0]), 2)

def get_best_hour():
    best_row = data.loc[data[y_col].idxmax()]
    return int(best_row[x_col])

# 🔥 AI PLATFORM DETECTION
def detect_platform(image_path):
    try:
        img = Image.open(image_path).convert("L")
        img = img.resize((100, 100))
        pixels = np.array(img)

        brightness = pixels.mean()

        if brightness > 150:
            return "Instagram"
        elif brightness > 100:
            return "YouTube"
        else:
            return "Twitter"
    except:
        return "Instagram"

def generate_graph(selected_hour=None):
    plt.figure()

    plt.scatter(data[x_col], data[y_col], label="Actual Data")

    hours = list(range(0, 24))
    hours_df = pd.DataFrame({x_col: hours})
    predictions = model.predict(hours_df)

    plt.plot(hours, predictions, label="Predicted Trend")

    if selected_hour is not None:
        pred = predict_engagement(selected_hour)
        plt.scatter(selected_hour, pred, s=120, label="Your Post")

    plt.title("Engagement vs Time")
    plt.xlabel("Hour (0-23)")
    plt.ylabel("Likes")
    plt.legend()
    plt.grid()

    path = "static/graph.png"
    plt.savefig(path)
    plt.close()

    return path

# =========================
# ROUTE
# =========================
@app.route('/', methods=['GET', 'POST'])
def index():
    prediction = None
    best_platform = None
    best_time = None

    hour = None

    if request.method == 'POST':
        hour = int(request.form['hour'])

        file = request.files['file']

        # Save file
        if file and file.filename != "":
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
            file.save(filepath)

            best_platform = detect_platform(filepath)
        else:
            best_platform = "Instagram"

        base = predict_engagement(hour)

        # Platform multiplier
        if best_platform == "Instagram":
            prediction = base * 1.2
        elif best_platform == "YouTube":
            prediction = base * 0.9
        else:
            prediction = base * 0.7

        prediction = round(prediction, 2)

        best_time = get_best_hour()

    graph = generate_graph(hour)

    return render_template(
        'index.html',
        prediction=prediction,
        best_platform=best_platform,
        best_time=best_time,
        graph=graph
    )

# =========================
# RUN
# =========================
if __name__ == '__main__':
    os.makedirs('uploads', exist_ok=True)
    os.makedirs('static', exist_ok=True)

    app.run(debug=True)