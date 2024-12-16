import socket
import threading
import tkinter as tk
from tkinter import simpledialog, messagebox, scrolledtext

class ChatClient:
    def _init_(self):
        # Create main window
        self.window = tk.Tk()
        self.window.title("Chat Application")
        self.window.geometry("500x600")
        
        # Create chat display area
        self.chat_display = scrolledtext.ScrolledText(
            self.window, 
            wrap=tk.WORD, 
            width=60, 
            height=20
        )
        self.chat_display.pack(padx=10, pady=10, expand=True, fill=tk.BOTH)
        self.chat_display.config(state=tk.DISABLED)
        
        # Message input area
        self.msg_entry = tk.Entry(self.window, width=50)
        self.msg_entry.pack(padx=10, pady=5, expand=True, fill=tk.X)
        
        # Send button
        self.send_button = tk.Button(
            self.window, 
            text="Send", 
            command=self.send_message
        )
        self.send_button.pack(padx=10, pady=5)
        
        # Socket and connection variables
        self.client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.nickname = None
        
        # Setup connection
        self.setup_connection()

    def setup_connection(self):
        """
        Setup connection details and connect to server
        """
        try:
            # Get server host
            host = simpledialog.askstring(
                "Host", 
                "Enter Server IP:", 
                initialvalue="127.0.0.1"
            ) or "127.0.0.1"
            
            # Get server port
            port_str = simpledialog.askstring(
                "Port", 
                "Enter Server Port:", 
                initialvalue="55555"
            ) or "55555"
            port = int(port_str)
            
            # Get nickname
            self.nickname = simpledialog.askstring(
                "Nickname", 
                "Choose your nickname:", 
                initialvalue="User"
            ) or "Anonymous"
            
            # Connect to server
            self.client.connect((host, port))
            
            # Wait for server to request nickname
            nick_request = self.client.recv(1024).decode('ascii')
            if nick_request == 'NICK':
                self.client.send(self.nickname.encode('ascii'))
            
            # Confirm connection
            welcome_msg = self.client.recv(1024).decode('ascii')
            self.update_chat(welcome_msg)
            
            # Start receiving messages
            receive_thread = threading.Thread(target=self.receive_messages)
            receive_thread.daemon = True
            receive_thread.start()
            
            # Bind Enter key to send message
            self.msg_entry.bind('<Return>', lambda event: self.send_message())
        
        except Exception as e:
            messagebox.showerror("Connection Error", str(e))
            self.window.quit()

    def send_message(self):
        """
        Send message to server
        """
        try:
            message = self.msg_entry.get()
            if message:
                # Send full message with nickname
                full_message = f"{self.nickname}: {message}"
                self.client.send(full_message.encode('ascii'))
                
                # Clear message entry
                self.msg_entry.delete(0, tk.END)
        
        except Exception as e:
            messagebox.showerror("Send Error", str(e))
            self.close_connection()

    def receive_messages(self):
        """
        Continuously receive messages from server
        """
        while True:
            try:
                # Receive message
                message = self.client.recv(1024).decode('ascii')
                
                if message:
                    # Update chat display
                    self.window.after(0, self.update_chat, message)
            
            except Exception as e:
                messagebox.showerror("Receive Error", str(e))
                break

    def update_chat(self, message):
        """
        Update chat display
        """
        # Enable text widget to modify
        self.chat_display.config(state=tk.NORMAL)
        # Insert new message
        self.chat_display.insert(tk.END, message + "\n")
        # Scroll to the end
        self.chat_display.see(tk.END)
        # Disable text widget
        self.chat_display.config(state=tk.DISABLED)

    def close_connection(self):
        """
        Close client connection
        """
        try:
            self.client.close()
        except:
            pass
        self.window.quit()

    def run(self):
        """
        Run the chat client
        """
        # Handle window close
        self.window.protocol("WM_DELETE_WINDOW", self.close_connection)
        
        # Start GUI event loop
        self.window.mainloop()

def main():
    # Create and run chat client
    chat_client = ChatClient()
    chat_client.run()

if __name__ == "__main__":
    main()