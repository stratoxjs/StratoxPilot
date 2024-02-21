const express = require('express');
const path = require('path');
const app = express();
const port = 8000; // You can choose any port

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Here, we assume that your 'example' directory is inside the 'public' directory
// For any route under '/example/guideX', serve the 'index.html' file located in the corresponding guide directory
app.get('/example/:guideName/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'example', req.params.guideName, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://10.0.1.220:${port}/`);
});
