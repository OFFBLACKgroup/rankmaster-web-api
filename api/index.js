import express from 'express';
import cors from 'cors'
import { downloadTest, sendEmail, uploadEmail, fetchTopicTierlists } from './functions.js';


const app = express()

app.use(express.json())
app.use(cors({ origin: 'http://localhost:4200' }))

app.get('', (req, res) => {
  res.send('Welcome to the RankMaster API!')
})

app.post('/send', async (req, res) => {
  try {
    const data = await sendEmail(req.body.email)
    console.log(data)
    await uploadEmail(req.body.email)
    res.sendStatus(200)
  } catch (error) {
    console.log(error)
    res.sendStatus(404)
  }
});

app.get('/testDownload', async (req, res) => {
  try {
    const data = await downloadTest()
    res.status(200).json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.get('/fetchTopicTierlists/:id', async (req, res) => {
  try {
    const data = await fetchTopicTierlists(req.params.id)
    res.status(200).json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

const port = 3000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);  
});
