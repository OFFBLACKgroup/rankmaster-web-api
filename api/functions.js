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

export async function downloadTest() {
  const { data, error } = await supabase
  .from('tierlist_items')
  .select()
  .eq('tierlist_ID', 4)

  if (error) {
    throw new Error(error)
  } else {
    return data
  }
}