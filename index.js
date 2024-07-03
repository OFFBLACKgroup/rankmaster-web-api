import express from 'express';
import cors from 'cors'
import { sendEmail, uploadEmail } from './functions.js';


const app = express()

app.use(express.json())
app.use(cors({ origin: 'http://localhost:4200' }))

app.post('/send', (req, res) => {
  try {
    // sendEmail(req.body.email)
    uploadEmail(req.body.email)
    res.sendStatus(200)
  } catch (error) {
    console.log(error)
    res.sendStatus(404)
  }
});

app.get('/test', (req, res) => {
  res.send('Hello')
})

const port = 3000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);  
});

module.exports = app;
