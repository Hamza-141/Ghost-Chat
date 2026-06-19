# 👻 Ghost Chat

A privacy-focused, steganography-powered messaging web application. Ghost Chat enables users to hide secret messages within images, ensuring secure and covert communication.

## Features

- **Steganography Encoding/Decoding** – Hide and extract messages within images
- **Secure Identity System** – Unique identity management for users
- **Chat History** – Persistent conversation tracking
- **Progressive Web App (PWA)** – Installable on mobile and desktop
- **Modern UI** – Sleek, responsive dark-themed interface

## Tech Stack

- HTML5, CSS3, JavaScript (Vanilla)
- Web Workers for steganography processing
- Service Worker for PWA support

## Getting Started

1. Clone the repo:
   ```bash
   git clone https://github.com/irtza0/Ghost-Chat.git
   ```
2. Open `index.html` in your browser, or serve with any static file server.

## Project Structure

```
Ghost Chat/
├── index.html          # Main HTML file
├── style.css           # Styling
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker
└── js/
    ├── app.js           # Main application logic
    ├── identity.js      # Identity management
    ├── history.js       # Chat history
    ├── stego.js         # Steganography interface
    └── stego-worker.js  # Steganography web worker
```

## License

This project is open source and available under the [MIT License](LICENSE).
