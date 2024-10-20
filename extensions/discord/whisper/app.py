from flask import Flask, request, jsonify
from faster_whisper import WhisperModel

model = WhisperModel("medium")

app = Flask(__name__)
app.json.ensure_ascii = False

@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    file_path = f"/tmp/{file.filename}"
    file.save(file_path)

    segments, _ = model.transcribe(file_path)

    result = {"transcription": "\n".join([segment.text for segment in segments])}
    return jsonify(result)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
