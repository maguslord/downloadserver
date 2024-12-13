from flask import Flask, request, jsonify
import yt_dlp
import os
import uuid
import tempfile

app = Flask(__name__)

@app.route('/process-video', methods=['POST'])
def process_video():
    try:
        # Get video URL and desired format from request
        video_url = request.json.get('videoUrl')
        desired_format = request.json.get('format')

        if not video_url:
            return jsonify({'error': 'No video URL provided'}), 400

        # Temporary directory for video processing
        temp_download_dir = tempfile.mkdtemp(prefix='video_process_')

        # Configure youtube-dl options for minimal processing
        ydl_opts = {
            'format': f'bestvideo[ext={desired_format}]+bestaudio/best[ext={desired_format}]',
            'nooverwrites': True,
            'no_warnings': True,
            'ignoreerrors': False,
            'noplaylist': True,
            'skip_download': True,  # Only extract information
        }

        # Extract video information
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(video_url, download=False)
            
            # Prepare video metadata for client-side download
            return jsonify({
                'videoInfo': {
                    'title': info_dict.get('title', 'Unknown Title'),
                    'duration': info_dict.get('duration', 0),
                    'formats': [
                        {
                            'format_id': fmt.get('format_id'),
                            'ext': fmt.get('ext'),
                            'resolution': fmt.get('resolution', 'N/A'),
                            'filesize': fmt.get('filesize', 0),
                            'url': fmt.get('url')
                        } 
                        for fmt in info_dict.get('formats', [])
                        if fmt.get('url')
                    ]
                }
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/confirm-download', methods=['POST'])
def confirm_download():
    try:
        # Receive confirmation from client after successful download
        downloaded_url = request.json.get('downloadedUrl')
        
        if not downloaded_url:
            return jsonify({'status': 'error', 'message': 'No URL provided'}), 400
        
        # Log download confirmation (optional)
        print(f"Video downloaded: {downloaded_url}")
        
        return jsonify({'status': 'success', 'message': 'Download confirmed'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)