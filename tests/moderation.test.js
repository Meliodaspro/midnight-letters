import test from 'node:test';
import assert from 'node:assert/strict';
import {hasAbuse} from '../src/moderation.js';
test('blocks profanity, abbreviations, teencode and common evasion',()=>{
 for(const value of ['địt mẹ','ĐỤ MÁ!','đcm','dmmmm','dkmm','vkl','vcl','loz','óc chó','ditmemay','cặc','lồn','đĩ','đéo','mặt lồn','fuck you','motherfucker','asshole','bitch','f.u.c.k','f u c k','d.i.t.m.e','d.m','v.c.l','v@i l0n','l0z','fuuuck','đ\u200bịt mẹ','địt mẹ','ＦＵＣＫ'])assert.equal(hasAbuse(value),true,value);
});
test('does not confuse neutral Vietnamese words or substrings with insults',()=>{
 for(const value of ['Tôi đi bộ cùng mẹ dưới đồi.','Đủ mát để đi dạo.','Mẹ cha yêu thương con.','Con chó đang ngủ.','Cac ban dung de chai lon o day.','Các bạn cùng đón buổi sáng.','Cất lời, cút ra chỗ khác.','Định mệnh, hạnh phúc và lòng biết ơn.','Quả óc chó rất ngon.','Gặp nhau ở Buôn Ma Thuột.','Scunthorpe, classical music, assignment','lol, cảm ơn bạn','Nguồn nước trong veo'])assert.equal(hasAbuse(value),false,value);
 assert.equal(hasAbuse(null),false);
});
