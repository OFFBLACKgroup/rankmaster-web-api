import FormData from 'form-data'
import fetch from 'node-fetch'
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import Ably from 'ably'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

export async function sendEmail(email) {
  const form = new FormData();
  form.append('from','RankMaster Support<support@rankmaster.click>');
  form.append('to',`${email}`);
  form.append('subject','RankMaster Waiting List');
  form.append('template', 'rankmaster');

  const domainName = 'mg.rankmaster.click';

  const resp = await fetch(
    `https://api.mailgun.net/v3/${domainName}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from("api:" + process.env.MAILGUN_KEY).toString('base64')
      },
      body: form
    }
  );
  const data = await resp.text()
  return data
}

export async function uploadEmail(email) {
  const { error } = await supabase
  .from('emails')
  .insert({ email: email })
  
  if (error) {
    throw new Error(error)
  }
}

export async function fetchMenu() {
  const { data, error } = await supabase
  .from('topics')
  .select(`
    *,
    tierlists:tierlists(count)
  `)
  .order('id');

  if (error) {
    throw error
  } else {
    return data
  }
}

export async function fetchTopic(topicID) {
  const { data, error } = await supabase
  .from('tierlists')
  .select(`
    *,
    tierlist_items:tierlist_items(count)
  `)
  .eq('topic_ID', topicID)

  if (error) {
    throw new Error(error)
  } else {
    return data
  }
}

//OPTIMIZABLE turn all single return queries into using .single() so no need for res[0]
export async function fetchTierlist(tierlistID) {
  const { data, error } = await supabase
  .from('tierlist_items')
  .select()
  .eq('tierlist_ID', tierlistID)

  if (error) {
    throw error
  } else {
    return data
  }
}

export async function signUp(email, password, anon) {
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
  })

  if (error) { throw error }

  const { data: _profileData, error: profileError } = await supabase
  .from('profiles')
  .insert([{}])
  .select()

  if (profileError) { throw profileError }

  if (anon.fromAnon && anon.data.length != 0) {
    await createUserLog(anon.data)
  }

  return data
}

export async function signIn(email, password, anon) {
  //OPTIMIZABLE probably signup returns user object too, same for signUP
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  })

  if (error) { throw error }
  if (anon.fromAnon && anon.data.length != 0) {
    const user = await supabase.auth.getUser()
    const { data: logs, error } = await supabase
    .from('completed_tierlist_logs')
    .select('tierlist_ID')
    .eq('user_id', user.data.user.id)

    if (error) { throw new Error(`This is where we are failing: ${error}`) }
    const nonDuplicateTierlists = anon.data.filter((newlyCompleted) => !logs.some((log) => log.tierlist_ID == newlyCompleted.tierlist_ID))
    await createUserLog(nonDuplicateTierlists)
  }
  return data
}

export async function getUserData() {
  const id = await getUserID()

  const { data, error: error1 } = await supabase
  .from('completed_tierlist_logs')
  .select()
  .eq('user_id', id)

  const { data: userData, error: error2 } = await supabase
  .from('profiles')
  .select('is_premium, username, user_icon_ID')
  .eq('id', id)
  .single()

  if ( error1 || error2 ) {
    throw new Error(`Something went wrong while fetching completed tier lists: ${error1 || error2}`) 
  } else {
    return { completedTierlists: data, userData: userData }
  }
}

export async function upgradeToPremium(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ADMIN_KEY
  )

  const sig = req.headers['stripe-signature'];

  const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_ENDPOINT_SECRET);

  if (event.type == 'checkout.session.completed') {
    const userID = event.data.object.client_reference_id

    const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_premium: true })
    .eq('id', userID)
    .select()

    if (error) throw error;
  }
}

export async function getUserID() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  console.log(data)
  return data.user.id
}

async function createUserLog(completedTierlists) {
  const userID = await getUserID()
  if (!userID) {
    throw new Error('No user id')
  }

  const { data, error } = await supabase
  .from('completed_tierlist_logs')
  .insert(completedTierlists)
  .select()

  if (error) {
    throw new Error('Went wrong here. Completed_tierlist_logs: ' + JSON.stringify(completedTierlists) + 'Error: ' + JSON.stringify(error))
  } else return 
}

//BUG kind of a feature, but if anon user does a playlist that he already completed, it counts again into global results
async function updateResult(predictions, tierlistItems) {
  const options = []
  for (const [index, prediction] of predictions.entries()) {
    options.push({
      id: prediction.tierlist_item_id,
      num_of_votes: tierlistItems[index].num_of_votes + 1,
      average_rank: (tierlistItems[index].average_rank * tierlistItems[index].num_of_votes + prediction.predicted_tier) / (tierlistItems[index].num_of_votes + 1)
    })
  }
  console.log(options)

  const { data, error } = await supabase
  .from('tierlist_items')
  .upsert(options)
  .select()

  if (error) {
    throw error
  }
}

async function calculatePercentile(completedToday, points) {
  let topPercentile = 0
  if (completedToday.length > 0) {
    for (const item of completedToday) {
      if (item.collected_points > points) {
        topPercentile++
      }
    }
    return topPercentile = Math.round((1 - topPercentile / completedToday.length) * 100)
  } else {
    return 99
  }
}

export async function calculatePoints(request) {
  const { data, error } = await supabase
  .from('tierlist_items')
  .select()
  .eq('tierlist_ID', request.tierlistID)
  .order('id')

  if (error) {
    throw error
  }

  let points = 0
  const maxPointPerItem = request.predictions.length <= 5 ? 2 : request.predictions.length <= 8 ? 3 : 4 

  request.predictions.forEach((item, index) => {
    //calculate absolute distance
    const distance = Math.abs( item.predicted_tier - Math.round(data[index].average_rank) )
    //substitute from maxPoint BUT minimum 0
    const pointsForItem = Math.max( 0, maxPointPerItem - distance)
    points += pointsForItem
    request.predictions[index].points_for_item = pointsForItem
    request.predictions[index].correct_tier = Math.round(data[index].average_rank)
  })
    
  const user = await supabase.auth.getUser()
  const todaysDate = new Date().toISOString().slice(0, 10) // Formats: YYYY-MM-DD

  let topPercentile = 0
  if (request.isDailyTierlist) {
    const { data: completedToday, error: completedTodayError } = await supabase
      .from('completed_tierlist_logs')
      .select('collected_points')
      .eq('created_at', todaysDate)
      .eq('tierlist_ID', request.tierlistID)
    if (completedTodayError) { throw completedTodayError }
    topPercentile = await calculatePercentile(completedToday, points)
  } else {
    const { data: completedToday, error: completedTodayError } = await supabase
      .from('completed_tierlist_logs')
      .select('collected_points')
      .eq('tierlist_ID', request.tierlistID)
    if (completedTodayError) { throw completedTodayError }
    topPercentile = await calculatePercentile(completedToday, points)
  }

  if (!user.data.user.is_anonymous) {
    // await createUserLog([{topic_ID: request.topicID, tierlist_ID: request.tierlistID, collected_points: points}])
  }
  // await updateResult(request.predictions, data)

  return { points, predictions: request.predictions, topPercentile }
}

export async function fetchDailyTierlist() {
  const todaysDate = new Date().toISOString().slice(0,10) // Formats: YYYY-MM-DD

  const { data, error } = await supabase
    .from('tierlists')
    .select('*')
    .eq('daily_added_date', todaysDate)

  if (error) {
    throw error
  }
  return data
}

//TODO exclude completed tier lists from returning as random
export async function getRandomTierlist() {
  const response = await supabase.auth.getUser()
  const userID = response.data.user.id

  const completedIds = '()'
  const user_data = { isPremium: false }

  if (!response.data.user.is_anonymous) {
    const { data, error } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', userID)
    .single()
  
    if (error) throw error
    user_data = data
  
    //Generate list of completed tier lists
    const { data: completedTierlists, error: completedError } = await supabase
    .from('completed_tierlist_logs')
    .select('tierlist_ID')
    .eq('user_id', userID)
  
    if (completedError) throw completedError
  
    const completedIdsArray = completedTierlists.map(item => item.tierlist_ID)
    completedIds = `(${completedIdsArray.join(',')})`
  }

  const todaysDate = new Date().toISOString().slice(0,10)

  //OPTIMIZABLE reusing code as it does mainly the same
  //Return random list based on if premium user
  if (user_data.isPremium == true) {
    const { data, error } = await supabase
    .from('tierlists')
    .select('id, topic_ID, name')
    .not('id', 'in', completedIds)
    .or('daily_added_date.neq.' + todaysDate + ',daily_added_date.is.null')


    if (error) throw error

    const index = Math.round(Math.random() * (Math.abs(data.length - 1)) )
    return {  id: data[index].id, topic_ID: data[index].topic_ID, name: data[index].name }

  } else {
    const { data, error } = await supabase
      .from('tierlists')
      .select('id, topic_ID, name')
      .eq('is_premium', false)
      .not('id', 'in', completedIds)
      .or('daily_added_date.neq.' + todaysDate + ',daily_added_date.is.null')

    if (error) throw error

    const index = Math.round(Math.random() * (Math.abs(data.length - 1)) )
    return {  id: data[index].id, topic_ID: data[index].topic_ID, name: data[index].name }
  }
}

export async function signInAnonymous() {
  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) { throw error }
  else return data
}

export async function updateUser(userData) {
  const userID = await getUserID()
  const updatedData = { username: userData.username }
  
  if (userData.user_icon_ID) {
    updatedData.user_icon_ID = userData.user_icon_ID
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updatedData)
    .eq('id', userID)

  if (error) throw error

  const { data: data2, error: error2 } = await supabase
  .from('leaderboard')
  .upsert([updatedData])
  .eq('id', userID)
  .select()

  if (error2) throw error2
  return { message: "OK" }
}

export async function updateUserIcon(userData) {
  const userID = await getUserID()
  const { data, error } = await supabase
  .from('profiles')
  .update({ user_icon_ID: userData.user_icon_ID })
  .eq('id', userID)
  .select()

  if (error) throw error

  const { data: data2, error: error2 } = await supabase
  .from('leaderboard')
  .upsert([{ id: userID, user_icon_ID: userData.user_icon_ID }])
  .eq('id', userID)
  .select()

  if (error2) throw error2
  return { message: "OK" }
}

export async function updateLeaderboard(points) {
  const userID = await getUserID()

  const { data, error } = await supabase
  .from('leaderboard')
  .select('total_points')
  .eq('id', userID)

  if (error) throw error

  const totalPoints = data[0].total_points + points

  const { data: data2, error: error2 } = await supabase
  .from('leaderboard')
  .upsert([{ id: userID, total_points: totalPoints }], { onConflict: 'id' })
  .eq('id', userID)
  .select()

  if (error2) throw error2
  return { message: "OK" }
}