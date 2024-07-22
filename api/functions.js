import FormData from 'form-data';
import fetch from 'node-fetch';
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe';

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

export async function fetchTierlist(tierlistID) {
  const { data, error } = await supabase
  .from('tierlist_items')
  .select()
  .eq('tierlist_ID', tierlistID)

  if (error) {
    throw new Error(error)
  } else {
    return data
  }
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
  })

  if (error) {
    throw new Error(error)
  } else {
    return data
  }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  })

  if (error) {
    throw new Error(error)
  } else {
    return data
  }
}

export async function getUserData() {
  const id = (await supabase.auth.getUser()).data.user.id

  const { data, error1 } = await supabase
  .from('completed_tierlist_logs')
  .select()
  .eq('user_id', id)

  const { data: isPremium, error2 } = await supabase
  .from('profiles')
  .select('is_premium')
  .eq('id', id)
  .single()

  if ( error1 || error2 ) {
    throw new Error(`Something went wrong while fetching completed tier lists: ${error1 || error2}`) 
  } else {
    return { data, isPremium }
  }
}

export async function upgradeUserToPremiumTest() {
  const { id: user_id, role } = await getUserIdAndRole()

  let { data, error } = await supabase
    .rpc('upgrade_user_to_premium', {
      user_id
    })

  if (error) {
    throw new Error(JSON.stringify(error))
  } else {
    return
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
  return (await supabase.auth.getUser()).data.user.id
}

async function createUserLog(topicID, tierlistID, collectedPoints) {
  const userID = await getUserID()
  if (!userID) {
    throw new Error('No user id')
  }

  const { data, error } = await supabase
  .from('completed_tierlist_logs')
  .insert([
    { user_id: userID, tierlist_ID: tierlistID, collected_points: collectedPoints, topic_ID: topicID },
  ])
  .select()

  if (error) {
    throw error
  }     
}

async function updateResult(predictions, tierlistItems) {
  const options = []
  for (const [index, prediction] of predictions.entries()) {
    options.push({
      id: prediction.id,
      num_of_votes: tierlistItems[index].num_of_votes + 1,
      average_rank: (tierlistItems[index].average_rank * tierlistItems[index].num_of_votes + prediction.predicted_tier) / (tierlistItems[index].num_of_votes + 1)
    })
  }

  const { data, error } = await supabase
  .from('tierlist_items')
  .upsert(options)

  if (error) {
    throw error
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

  const points = 0
  const maxPoint = request.predicitons.length <= 5 ? 2 : request.predicitons.length <= 8 ? 3 : 4 


  request.predictions.forEach((item, index) => {
    points += Math.min( 0, Math.abs( maxPoint - (item.prediction - data[index].average_rank) ) )
  })
    
  await createUserLog(request.topicID, request.tierlistID, points)
  await updateResult(request.predicitons, data)

  return points
}