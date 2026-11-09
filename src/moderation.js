const abusePattern=/(?:^|\s)(?:dm|dmm|dcm|dit me|du me|deo me|vai lon|con cho|do ngu|oc cho|ngu lon|fuck you|motherfucker)(?:\s|$)/u;
export function hasAbuse(value){
 const normalized=String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 return abusePattern.test(normalized);
}
