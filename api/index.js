import express from 'express';
import cors from 'cors'
import { sendEmail, uploadEmail, fetchTopic, fetchTierlist, signUp, signIn, getUserData, upgradeUserToPremiumTest } from './functions.js';


const app = express()

app.use(express.json())
app.use(cors({ origin: ['http://localhost:4200', 'https://www.rankmaster.click'] }))

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

app.get('/fetchTopic/:id', async (req, res) => {
  try {
    const data = await fetchTopic(req.params.id)
    res.status(200).json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.get('/fetchTierlist/:id', async (req, res) => {
  try {
    const data = await fetchTierlist(req.params.id)
    res.status(200).json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.post('/signUp', async (req, res) => {
  try {
    const data = await signUp(req.body.email, req.body.password)
    res.status(200).json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.post('/signIn', async (req, res) => {
  try {
    const data = await signIn(req.body.email, req.body.password)
    res.status(200).json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.get('/userData', async (req, res) => {
  try {
    const data = await getUserData()
    res.status(200).json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.get('/updateToPremiumTest', async (req, res) => {
  try {
    await upgradeUserToPremiumTest()
    res.status(200).send()
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

const port = 3000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);  
});
