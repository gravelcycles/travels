import { execFile } from 'node:child_process';import { promisify } from 'node:util';
const run=promisify(execFile);
// Capture credentials in process memory only; never print command results containing tokens.
async function wranglerJson(args){const {stdout}=await run(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args,'--json'],{maxBuffer:2*1024*1024});return JSON.parse(stdout);}
export async function cloudflareClient(){
  const user=await wranglerJson(['whoami']);
  if(!user.loggedIn||user.accounts?.length!==1)throw new Error('Select exactly one Cloudflare account before photo publishing.');
  const auth=await wranglerJson(['auth','token']);
  if(!auth.token)throw new Error('Use Wrangler browser authorization or a scoped API token.');
  const base=`https://api.cloudflare.com/client/v4/accounts/${user.accounts[0].id}`;
  return async(resource,options={})=>{
    if(!resource.startsWith('/')||resource.includes('..'))throw new Error('Invalid Cloudflare resource');
    const response=await fetch(base+resource,{...options,headers:{...options.headers,Authorization:`Bearer ${auth.token}`},signal:AbortSignal.timeout(60000)});
    return response;
  };
}
