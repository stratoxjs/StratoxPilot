import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Express is used to run examples
 */
const app = express();
const port = 8000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static('examples'));

app.get('/example/:guideName/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'examples', 'example', req.params.guideName, 'index.html'));
});

app.listen(port, () => {
  console.log('Server running at host: localhost, 127.0.0.1 or your local IP number');
  console.log(`Server running at port: ${port}`);
});
