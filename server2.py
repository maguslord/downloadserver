import socket
import threading
import logging
from typing import Dict, List

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')

class ChatServer:
    def __init__(self, host: str = '', port: int = 5000):
        """
        Initialize the chat server.
        
        :param host: IP to bind the server (default all interfaces)
        :param port: Port number to listen on
        """
        self.host = host
        self.port = port
        self.server_socket = None
        self.clients: Dict[socket.socket, str] = {}  # socket to alias mapping
        self.lock = threading.Lock()  # Thread-safe lock for client operations

    def start(self):
        """
        Start the chat server.
        """
        try:
            # Create server socket
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(100)  # Allow up to 100 pending connections
            
            logging.info(f"Server started on {self.host}:{self.port}")
            
            # Accept connections
            while True:
                client_socket, address = self.server_socket.accept()
                logging.info(f"New connection from {address}")
                
                # Handle each client in a separate thread
                client_thread = threading.Thread(
                    target=self.handle_client, 
                    args=(client_socket, address)
                )
                client_thread.daemon = True
                client_thread.start()
        
        except Exception as e:
            logging.error(f"Server error: {e}")
        finally:
            if self.server_socket:
                self.server_socket.close()

    def handle_client(self, client_socket: socket.socket, address: tuple):
        """
        Handle individual client communication.
        
        :param client_socket: Socket of the connected client
        :param address: Client's network address
        """
        try:
            # Request and validate alias
            client_socket.send("Enter your alias: ".encode('utf-8'))
            alias = client_socket.recv(1024).decode('utf-8').strip()
            
            if not alias or len(alias) > 20:
                client_socket.send("Invalid alias. Must be 1-20 characters.".encode('utf-8'))
                client_socket.close()
                return

            # Thread-safe client registration
            with self.lock:
                self.clients[client_socket] = alias
            
            # Broadcast join message
            self.broadcast(f"{alias} has joined the chat!", sender=client_socket)
            logging.info(f"{alias} ({address}) joined")

            # Receive and broadcast messages
            while True:
                message = client_socket.recv(1024)
                if not message:
                    break
                
                decoded_message = message.decode('utf-8')
                full_message = f"{alias}: {decoded_message}"
                logging.info(full_message)
                self.broadcast(full_message, sender=client_socket)

        except ConnectionResetError:
            logging.warning(f"Connection reset by {alias}")
        except Exception as e:
            logging.error(f"Client handling error: {e}")
        finally:
            # Cleanup
            with self.lock:
                if client_socket in self.clients:
                    alias = self.clients.pop(client_socket)
                    self.broadcast(f"{alias} has left the chat.", sender=client_socket)
                    logging.info(f"{alias} left the chat")
                client_socket.close()

    def broadcast(self, message: str, sender: socket.socket = None):
        """
        Send a message to all connected clients except the sender.
        
        :param message: Message to broadcast
        :param sender: Client socket to exclude from broadcast
        """
        with self.lock:
            for client in list(self.clients.keys()):
                if client != sender:
                    try:
                        client.send(message.encode('utf-8'))
                    except Exception as e:
                        logging.error(f"Broadcast error: {e}")
                        # Remove problematic client
                        if client in self.clients:
                            del self.clients[client]
                        client.close()

def main():
    """
    Main function to run the chat server.
    """
    server = ChatServer(host='0.0.0.0', port=5000)
    server.start()

if __name__ == "__main__":
    main()