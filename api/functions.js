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