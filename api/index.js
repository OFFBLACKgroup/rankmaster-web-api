import express from 'express';
import cors from 'cors'
import { sendEmail, uploadEmail, fetchTopic, fetchTierlist, signUp, signIn, getUserData, upgradeToPremium, fetchMenu, getUserID, calculatePoints, fetchDailyTierlist, getRandomTierlist } from './functions.js';

const app = express()
app.use(cors({ origin: ['http://localhost:4200', 'https://www.rankmaster.click'] }))

app.post('/upgradeToPremium', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    await upgradeToPremium(req)
    console.log('Successfully upgraded user to premium!')
    res.send()
  } catch (error) {
    console.log(error)
    res.status(404).send(`Webhook Error: ${err.message}`)
  }
})

app.use(express.json())

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

app.get('/fetchMenu', async (req, res) => {
  try {
    const data = await fetchMenu()
    res.json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.get('/fetchTopic/:id', async (req, res) => {
  try {
    const data = await fetchTopic(req.params.id)
    res.json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.get('/fetchTierlist/:id', async (req, res) => {
  try {
    const data = await fetchTierlist(req.params.id)
    res.json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.post('/signUp', async (req, res) => {
  try {
    const data = await signUp(req.body.email, req.body.password)
    res.json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.post('/signIn', async (req, res) => {
  try {
    const data = await signIn(req.body.email, req.body.password)
    res.json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.get('/userData', async (req, res) => {
  try {
    const data = await getUserData()
    res.json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.get('/currentUserID', async (req, res) => {
  try {
    const data = await getUserID()
    res.json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.post('/points', async (req, res) => {
  try {
    const points = await calculatePoints(req.body)
    res.json(points)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.get('/dailyTierlist', async (req, res) => {
  try {
    const dailyTierlist = await fetchDailyTierlist()
    res.json(dailyTierlist)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

app.get('/randomTierlist', async (req, res) => {
  try {
    // const randomTierlist = await getRandomTierlist()
    const { data, error } = await supabase
    .from('tierlists')
    .select('id, topic_ID, name')
    .eq('is_premium', false)
    .not('id', 'in', supabase
      .from('completed_tierlist_logs')
      .select('tierlist_ID')
      .eq('user_id', userID)
    )
    if (error) throw error
    res.json(data)
  } catch (error) {
    console.log(error)
    res.status(404).send()
  }
})

const port = 3000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);  
});
