import os
import requests
import subprocess
from flask import Flask, request, send_file, jsonify
from werkzeug.utils import secure_filename
from datetime import datetime

app = Flask(__name__)

# Decryption key (hardcoded for simplicity, but in practice, you should consider storing it securely)
DECRYPTION_KEY = "your_secure_decryption_key"

# Rate limiting parameters
MAX_REQUESTS = 10
TIME_WINDOW = 60  # In seconds
requests_log = {}

# Endpoint to download video
@app.route('/download-video', methods=['POST'])
def download_video():
    # Rate limiting check
    ip = request.remote_addr
    if ip in requests_log:
        if requests_log[ip]['count'] >= MAX_REQUESTS and (datetime.now() - requests_log[ip]['last_request']).seconds < TIME_WINDOW:
            return jsonify({"error": "Rate limit exceeded, try again later."}), 429
    else:
        requests_log[ip] = {'count': 0, 'last_request': datetime.now()}

    # Increment request count
    requests_log[ip]['count'] += 1
    requests_log[ip]['last_request'] = datetime.now()

    # Get the video URL from the request
    data = request.json
    video_url = data.get('url')

    if not video_url or not is_valid_url(video_url):
        return jsonify({"error": "Invalid or inaccessible URL."}), 400

    try:
        # Download the video
        video_data = download_video_from_url(video_url)
    except Exception as e:
        return jsonify({"error": f"Failed to download video: {str(e)}"}), 500

    # Check if the video is encrypted and decrypt it
    try:
        if is_encrypted(video_data):
            decrypted_video = decrypt_video(video_data)
            return send_file(decrypted_video, as_attachment=True, download_name="video.mp4")
        else:
            return send_file(video_data, as_attachment=True, download_name="video.mp4")
    except Exception as e:
        return jsonify({"error": f"Error processing video: {str(e)}"}), 500


# Helper functions
def is_valid_url(url):
    try:
        response = requests.head(url)
        return response.status_code == 200
    except requests.RequestException:
        return False


def download_video_from_url(url):
    filename = secure_filename(url.split("/")[-1])
    video_path = os.path.join("/tmp", filename)
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        with open(video_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return video_path
    else:
        raise Exception("Failed to download video")


def is_encrypted(video_path):
    # Assuming encrypted videos have a .enc extension
    return video_path.endswith(".enc")


def decrypt_video(video_path):
    decrypted_path = video_path.replace(".enc", "_decrypted.mp4")
    try:
        # Use FFmpeg to decrypt the video
        subprocess.run(['ffmpeg', '-i', video_path, '-decryption_key', DECRYPTION_KEY, decrypted_path], check=True)
        return decrypted_path
    except subprocess.CalledProcessError:
        raise Exception("Error during video decryption")


# Clean up temporary files after usage
@app.teardown_appcontext
def cleanup_files(error=None):
    for filename in os.listdir("/tmp"):
        os.remove(os.path.join("/tmp", filename))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, ssl_context='adhoc')  # Enable HTTPS (self-signed cert)
