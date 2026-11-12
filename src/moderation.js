// Curated rules; see docs/MODERATION.md for scope, sources and false-positive policy.
// Keep ambiguous Vietnamese syllables accent-sensitive (e.g. lồn vs lớn/lon).
const accentedWords=new Set(['buồi','cặc','lồn','địt','đụ','đéo','đếch','đệt','đệch','đĩ','điếm','nứng','cứt']);
const terms=[
 'dm','vl','dmm','dcm','dcmm','dkm','dkmm','djt','disme','dizme','ditme','ditmemay',
 'duma','dume','douma','doma','dcmn','dmcs',
 'vcl','vkl','vcc','vailon','vailoz','vailol','vlon','vloz',
 'loz','lolz','lonz','clgt','clmm','clm','ccm','cmnl','tml','thangml',
 'concac','concak','concuk','caiconcac','daubuoi','dauboi','cailon','matlon','matloz',
 'occho','ngulon','ngulol','buscu','nunglon',
 'dit me','dit ma','dit cu','dit bo','dit cha','du me','du ma',
 'dis me','diz me','djt me','de me','deo me','vai lon','vai loz','vai lol',
 'oc cho','do ngu','ngu lon','ngu lol','thang cho','cho ma','lao cho',
 'tien su nha may','ma cha may','me cha may','con di cho',
 'fuck','fck','fuk','fuck you','motherfucker','asshole','bitch','bullshit','cunt',
];
const fold=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').replace(/đ/g,'d');
const boundary='[^\\p{L}\\p{N}]';
// Long terms also catch dotted/spaced spelling, but never match inside a word.
const patterns=terms.map(term=>{
 const letters=term.replace(/ /g,'');
 const separator=letters.length===2?'[^\\p{L}\\p{N}\\s]*':'[^\\p{L}\\p{N}]*';
 const pattern=[...letters].map(c=>c+'+').join(separator);
 return new RegExp(`(?:^|${boundary})${pattern}(?=$|${boundary})`,'u');
});
const shorthand=/(?:^|[^\p{L}\p{N}])(?:dm{1,6}|dcm{1,6}|dkm{1,6}|v[ck]?l)(?=$|[^\p{L}\p{N}])/u;
export function hasAbuse(value){
 const text=String(value??'').normalize('NFKC').toLowerCase().replace(/[\p{Cf}\u034f]/gu,'');
 const words=text.match(/[\p{L}\p{M}]+/gu)||[];
 if(words.some(word=>accentedWords.has(word.normalize('NFC'))))return true;
 const normalized=fold(text).replace(/(\p{L})\1{2,}/gu,'$1$1').replace(/(?:qua|hat|cay|sua)\s+oc\s+cho(?=$|[^\p{L}\p{N}])/gu,'walnut').replace(/[@01345789]/g,c=>({'@':'a','0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','9':'g'}[c]));
 return shorthand.test(normalized)||patterns.some(pattern=>pattern.test(normalized));
}
