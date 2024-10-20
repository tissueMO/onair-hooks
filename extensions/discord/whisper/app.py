import os
from flask import Flask, request, jsonify
from faster_whisper import WhisperModel

# モデル選択
model = WhisperModel(os.environ["WHISPER_MODEL"])

# Webサーバー
app = Flask(__name__)
app.json.ensure_ascii = False


@app.route("/transcribe", methods=["POST"])
def transcribe():
    """音声データを文字起こしします。
    """
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
