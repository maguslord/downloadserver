import os
import logging
from flask import Flask, request, jsonify, send_file
import yt_dlp
import tempfile
import uuid
from werkzeug.utils import secure_filename
from flask_cors import CORS

logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Ensure temporary directory exists
TEMP_DIR = os.path.join(tempfile.gettempdir(), 'video_downloads')
os.makedirs(TEMP_DIR, exist_ok=True)

@app.route('/process-video', methods=['POST'])
def process_video():
    try:
        video_url = request.json.get('videoUrl')
        
        if not video_url:
            logger.error('No video URL provided')
            return jsonify({'error': 'No video URL provided'}), 400

        logger.info(f'Processing video URL: {video_url}')

        # Enhanced youtube-dl options
        ydl_opts = {
            'format': 'bestvideo+bestaudio/best',
            'nooverwrites': True,
            'no_warnings': True,
            'ignoreerrors': False,
            'noplaylist': True,
            'skip_download': True,
            'verbose': True
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info_dict = ydl.extract_info(video_url, download=False)
            except Exception as e:
                logger.error(f'Video extraction error: {e}')
                return jsonify({'error': str(e)}), 400

        # Filter and prepare formats
        formats = []
        for fmt in info_dict.get('formats', []):
            if fmt.get('url'):
                formats.append({
                    'format_id': fmt.get('format_id', 'N/A'),
                    'ext': fmt.get('ext', 'N/A'),
                    'resolution': fmt.get('resolution', 'N/A'),
                    'filesize': fmt.get('filesize', 0),
                    'url': fmt.get('url')
                })

        logger.info(f'Found {len(formats)} video formats')

        return jsonify({
            'videoInfo': {
                'title': info_dict.get('title', 'Unknown Title'),
                'duration': info_dict.get('duration', 0),
                'formats': formats
            }
        })

    except Exception as e:
        logger.error(f'Unexpected error in video processing: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/confirm-download', methods=['POST'])
def confirm_download():
    try:
        downloaded_url = request.json.get('downloadedUrl')
        
        if not downloaded_url:
            logger.warning('No download URL provided for confirmation')
            return jsonify({'status': 'error', 'message': 'No URL provided'}), 400

        logger.info(f'Download confirmed for URL: {downloaded_url}')
        return jsonify({'status': 'success', 'message': 'Download confirmed'})

    except Exception as e:
        logger.error(f'Error in download confirmation: {e}')
        return jsonify({'error': str(e)}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f'Unhandled exception: {e}', exc_info=True)
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)