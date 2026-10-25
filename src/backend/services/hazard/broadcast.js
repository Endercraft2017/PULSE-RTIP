/** Transactional alert outbox. Acceptance is never a handset delivery receipt.
 * Idempotent enqueue per source event; per-address outcomes survive partial sends.
 * Ambiguous provider acceptance is held for review, never blindly resent.
 */
const db=require('../../config/database');
const config=require('../../config');
const textbee=require('../sms/textbee');
const fcm=require('../push/fcm');
async function enqueue({hazard_id=null,advisory_id=null,title,message,audience_type='all',audience_barangays=[],critical=false,event_key}) {
  return db.transaction(async()=>{
    const key=event_key || `${hazard_id!=null?'hazard:'+hazard_id:'advisory:'+advisory_id}:${critical?'critical':'initial'}`;
    if(hazard_id==null&&advisory_id==null&&!event_key) throw new Error('Broadcasts require a source event.');
    const now=new Date().toISOString();
    const claim=await db.query(config.appMode==='production'?'INSERT IGNORE INTO broadcast_events (event_key,created_at) VALUES (?,?)':'INSERT OR IGNORE INTO broadcast_events (event_key,created_at) VALUES (?,?)',[key,now]);
    if(!claim.affectedRows) return {duplicate:true};
    const scoped=!critical&&audience_type==='barangay';
    if(scoped&&!audience_barangays.length) throw Object.assign(new Error('Select at least one barangay.'),{statusCode:400});
    const users=await db.query(`SELECT id,phone FROM users WHERE deleted_at IS NULL AND account_status='active'${scoped?` AND barangay IN (${audience_barangays.map(()=>'?').join(',')})`:''}`,scoped?audience_barangays:[]);
    const tokens=await db.query("SELECT pt.token,pt.user_id FROM push_tokens pt JOIN users u ON u.id=pt.user_id WHERE u.deleted_at IS NULL AND u.account_status='active'");
    for(const user of users) await db.query('INSERT INTO notifications (user_id,title,text,type) VALUES (?,?,?,?)',[user.id,title,message,'emergency_alert']);
    for(const [channel,size] of [['sms',50],['push',500]]) {
      const addresses=new Map();
      for(const user of users) {
        let recipients=channel==='sms'?[String(user.phone||'').replace(/[^+\d]/g,'')]:tokens.filter(t=>t.user_id===user.id).map(t=>t.token);
        recipients=[...new Set(recipients.filter(Boolean))];
        if(!recipients.length) recipients=[''];
        for(const recipient of recipients) {
          const mapKey=recipient||'missing:'+user.id;
          if(!addresses.has(mapKey)) addresses.set(mapKey,{recipient,users:[]});
          addresses.get(mapKey).users.push(user.id);
        }
      }
      const entries=[...addresses.values()];
      for(let i=0;i<entries.length;i+=size) {
        const batch=entries.slice(i,i+size), recipients=batch.map(e=>e.recipient).filter(Boolean);
        const job=await db.query('INSERT INTO broadcast_jobs (hazard_id,advisory_id,channel,payload,status,last_error,event_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
          [hazard_id,advisory_id,channel,JSON.stringify({recipients,title,message}),recipients.length?'pending':'failed',recipients.length?null:'No contact endpoints available.',`${key}:${i/size}`,now,now]);
        for(const entry of batch) for(const id of entry.users) await db.query('INSERT INTO broadcast_recipients (job_id,user_id,recipient,status,updated_at) VALUES (?,?,?,?,?)',[job.insertId,id,entry.recipient,entry.recipient?'queued':'no_contact',now]);
      }
    }
    return {duplicate:false};
  });
}
let running=false;
async function dispatch() {
  if(running) return; running=true;
  try {
    const jobs=await db.query("SELECT * FROM broadcast_jobs WHERE status IN ('pending','blocked','retry') AND attempts<5 ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,updated_at,id LIMIT 20");
    for(let i=0;i<jobs.length;i+=4) await Promise.all(jobs.slice(i,i+4).map(async job=>{
      const payload=JSON.parse(job.payload);
      const configured=job.channel==='sms'?await textbee.getEffectiveConfig().then(c=>!!(c.apiKey&&c.deviceId)):fcm.isConfigured();
      if(!configured) {await db.query("UPDATE broadcast_jobs SET status='blocked',last_error=?,updated_at=? WHERE id=? AND status IN ('pending','blocked','retry')",['Provider credentials are not configured.',new Date().toISOString(),job.id]);return;}
      const claim=await db.query("UPDATE broadcast_jobs SET status='sending',attempts=attempts+1,updated_at=? WHERE id=? AND status IN ('pending','blocked','retry')",[new Date().toISOString(),job.id]);
      if(!claim.affectedRows) return;
      let outcomes;
      try {
        if(job.channel==='sms') {
          const result=await textbee.sendSMS(payload.recipients,payload.message);
          outcomes=payload.recipients.map(recipient=>({recipient,status:'accepted',provider_id:result?.data?._id||result?.id||null}));
        } else {
          const result=await fcm.send(payload.recipients,{title:payload.title,body:payload.message,sound:true,data:{hazardId:job.hazard_id,advisoryId:job.advisory_id,kind:'emergency_alert'}});
          if(result.devOnly) throw Object.assign(new Error('Provider is not configured.'),{safeRetry:true});
          outcomes=result.outcomes || payload.recipients.map(recipient=>({recipient,status:result.retryTokens?.includes(recipient)?'retry':result.failed?'uncertain':'accepted'}));
        }
      } catch(error) {
        const status=error.isRateLimit||error.safeRetry?'retry':error.upstreamStatus>=400&&error.upstreamStatus<500?'failed':'uncertain';
        outcomes=payload.recipients.map(recipient=>({recipient,status,error:String(error.message).slice(0,500)}));
      }
      outcomes=payload.recipients.map(recipient=>outcomes.find(o=>o.recipient===recipient)||{recipient,status:'uncertain',error:'Provider omitted a recipient outcome.'});
      // A DB failure here must leave the claim in sending: recovery marks it
      // uncertain instead of automatically resending already accepted messages.
      await db.transaction(async()=>{
        for(const outcome of outcomes) await db.query('UPDATE broadcast_recipients SET status=?,provider_id=?,last_error=?,updated_at=? WHERE job_id=? AND recipient=? AND status NOT IN (\'accepted\',\'delivered\')',
          [outcome.status==='retry'&&job.attempts>=4?'failed':outcome.status,outcome.provider_id||null,outcome.error||null,new Date().toISOString(),job.id,outcome.recipient]);
        const retry=outcomes.filter(o=>o.status==='retry').map(o=>o.recipient);
        const saved=await db.query('SELECT status FROM broadcast_recipients WHERE job_id=?',[job.id]);
        const states=saved.length?saved.map(r=>r.status):outcomes.map(o=>o.status==='retry'&&job.attempts>=4?'failed':o.status);
        const status=retry.length&&job.attempts<4?'retry':states.includes('uncertain')?'uncertain':states.some(s=>['failed','no_contact'].includes(s))?(states.includes('accepted')?'partial':'failed'):'accepted';
        if(retry.length) payload.recipients=retry;
        await db.query('UPDATE broadcast_jobs SET status=?,payload=?,last_error=?,updated_at=? WHERE id=?',[status,JSON.stringify(payload),status==='accepted'?null:outcomes.find(o=>o.error)?.error||'Some recipients were not accepted; inspect recipient outcomes.',new Date().toISOString(),job.id]);
      });
    }));
  } finally {running=false;}
}
function start() {
  db.transaction(async()=>{
    await db.query("UPDATE broadcast_recipients SET status='uncertain',last_error='Worker restarted during dispatch; inspect provider records.' WHERE job_id IN (SELECT id FROM broadcast_jobs WHERE status='sending') AND status IN ('queued','retry')");
    await db.query("UPDATE broadcast_jobs SET status='uncertain',last_error='Worker restarted during dispatch; inspect provider records.' WHERE status='sending'");
  }).then(()=>dispatch()).catch(e=>console.error('[broadcast]',e.message));
  const timer=setInterval(()=>dispatch().catch(e=>console.error('[broadcast]',e.message)),30000);timer.unref();
}
module.exports={enqueue,dispatch,start};
