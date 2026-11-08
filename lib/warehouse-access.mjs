export function warehouseOriginAllowed({origin,host,nodeEnv}) {
  try {
    const source=new URL(origin);
    return source.host===host&&source.origin===origin&&(source.protocol==='https:'||(nodeEnv==='development'&&source.protocol==='http:'));
  } catch {return false;}
}
