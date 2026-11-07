import {decodeHTML} from 'entities';
export function decodeIcsText(value) {
  return String(value).replace(/\\([nN,;\\])/g,(_,char)=>/[nN]/.test(char)?'\n':char);
}
export function encodeIcsText(value) {
  return String(value).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}
// Goodshuffle includes structured client/venue labels ahead of notes and links.
// Extract concise card labels separately from the full event description.
export function calendarDetails(description) {
  const text=decodeHTML(String(description||'').slice(0,16000)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
    .replace(/<[^>]*>/g,' ')).replace(/\*\*/g,'').replace(/\s+/g,' ').trim();
  const header=text.split(/(?:Contract Notes|Rental Items|Item Category Pullsheet|Line Item Group Pullsheet)\s*:/i)[0];
  const client=header.match(/(?:^|\s)Client\s*:\s*(.+?)(?=\s+(?:Client\s*(?:#|Phone|Email|Number)|Sales\s+Lead|Project\s+Details)\s*:|$)/i)?.[1]?.trim()||'';
  const venue=header.match(/(?:^|\s)Venue\s*:\s*(.+?)(?=\s+(?:Event\s+Date(?:\/Time)?|Client|Sales\s+Lead)\s*:|$)/i)?.[1]?.trim()||'';
  return {client:client.length<=160&&/\p{L}/u.test(client)?client:'',venue:venue.length<=240?venue:''};
}

// Render calendar HTML as readable text; never execute or embed event markup.
export function calendarDescription(description) {
  return decodeHTML(String(description||'')
    .replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'')
    .replace(/<a\b[^>]*\bhref\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi,(_,quote,href,label)=>{
      const text=label.replace(/<[^>]*>/g,'').trim(),url=decodeHTML(href).trim();
      return /^https?:\/\//i.test(url)&&decodeHTML(text)!==url?`${text} (${url})`:text;
    })
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<li\b[^>]*>/gi,'\n• ')
    .replace(/<\/?(?:p|div|ul|ol|h[1-6]|tr|blockquote)\b[^>]*>/gi,'\n')
    .replace(/<\/li\s*>/gi,'')
    .replace(/<[^>]*>/g,''))
    .replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ')
    .replace(/[\t ]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
