from flask import Flask, request, jsonify
import yt_dlp
import os
import uuid

app = Flask(__name__)

@app.route('/process-video', methods=['POST'])
def process_video():
    try:
        # Get video URL and desired format from request
        video_url = request.json.get('videoUrl')
        desired_format = request.json.get('format')

        if not video_url:
            return jsonify({'error': 'No video URL provided'}), 400

        # Configure youtube-dl options
        ydl_opts = {
            'format': f'bestvideo[ext={desired_format}]+bestaudio/best[ext={desired_format}]',
            'outtmpl': f'/downloads/{uuid.uuid4()}%(ext)s',
            'nooverwrites': True,
            'no_warnings': True,
            'ignoreerrors': False,
            'noplaylist': True,
            'progress_hooks': [progress_hook],
        }

        # Extract video information
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(video_url, download=True)
            
            # Get the actual downloaded file
            downloaded_file = ydl.prepare_filename(info_dict)
            
            # Generate a unique download URL 
            download_url = f'/download/{os.path.basename(downloaded_file)}'
            
            return jsonify({
                'fileName': os.path.basename(downloaded_file),
                'downloadUrl': download_url,
                'videoInfo': {
                    'title': info_dict.get('title', 'Unknown Title'),
                    'duration': info_dict.get('duration', 0),
                }
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def progress_hook(d):
    if d['status'] == 'finished':
        print('Video download complete.')

@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    try:
        file_path = os.path.join('/downloads', filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        # In a real-world scenario, you'd use a more secure method to serve files
        return send_file(file_path, as_attachment=True)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Ensure download directory exists
    os.makedirs('/downloads', exist_ok=True)
    app.run(host='0.0.0.0', port=5000, ssl_context='adhoc')