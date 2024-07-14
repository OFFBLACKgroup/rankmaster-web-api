import FormData from 'form-data';
import fetch from 'node-fetch';
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

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

export async function fetchTopic(topicID) {
  const { data, error } = await supabase
  .from('tierlists')
  .select()
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

async function getUserIdAndRole() {
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    return { id: user.id, role: user.isPremium }
  } else {
    throw new Error('Could not get current user')
  }
}

export async function getUserData() {
  const { id, role } = await getUserIdAndRole()

  const { data, error } = await supabase
  .from('completed_tierlist_logs')
  .select()
  .eq('user_id', id)

  if (error) {
    throw new Error(`Something went wrong while fetching completed tier lists`, error) 
  } else {
    return { data, role }
  }
}

export async function upgradeUserToPremiumTest() {
  const { id, role } = await getUserIdAndRole()

  let { data, error } = await supabase
    .rpc('Upgrade user to Premium', {
      user_id: id
    })
  if (error) {
    throw new Error(error)
  } else {
    return
  }
} 