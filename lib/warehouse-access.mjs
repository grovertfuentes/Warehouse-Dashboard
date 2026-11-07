// Vercel Authentication protects this project's *.vercel.app entry points.
// Never interpret client-supplied ChatGPT identity headers as authentication.
export function warehouseAccessAllowed({vercel,nodeEnv,protectionEnabled,host}) {
  const hostname=String(host||'').toLowerCase().split(':')[0];
  if(nodeEnv==='development'&&vercel!=='1')return ['localhost','127.0.0.1'].includes(hostname);
  return vercel==='1'&&protectionEnabled==='enabled'&&hostname.endsWith('.vercel.app');
}
export function warehouseOriginAllowed({origin,host,nodeEnv}) {
  try {
    const source=new URL(origin);
    return source.host===host&&source.origin===origin&&(source.protocol==='https:'||(nodeEnv==='development'&&source.protocol==='http:'));
  } catch {return false;}
}
