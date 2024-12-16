from flask import Flask, request, jsonify
from threading import Thread

app = Flask(__name__)

# Store connected clients and messages
clients = []
messages = []

@app.route('/register', methods=['POST'])
def register_client():
    """Register a new client by adding their alias."""
    alias = request.json.get("alias")
    if alias not in clients:
        clients.append(alias)
        messages.append(f"{alias} has joined the chat.")
        return jsonify({"message": "You have joined the chat.", "messages": messages}), 200
    return jsonify({"error": "Alias already exists."}), 400

@app.route('/send', methods=['POST'])
def send_message():
    """Receive a message from a client and broadcast it."""
    alias = request.json.get("alias")
    message = request.json.get("message")
    if alias in clients:
        messages.append(f"{alias}: {message}")
        return jsonify({"message": "Message broadcasted."}), 200
    return jsonify({"error": "Alias not registered."}), 400

@app.route('/messages', methods=['GET'])
def get_messages():
    """Return all chat messages."""
    return jsonify(messages), 200

def run_server():
    app.run(host='0.0.0.0', port=5000)

if __name__ == "__main__":
    server_thread = Thread(target=run_server)
    server_thread.start()
