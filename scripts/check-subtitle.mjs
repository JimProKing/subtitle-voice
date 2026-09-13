import { clean, parse, isDuplicate, remember, markGap } from '../public/js/subtitle.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(clean('안녕  ♪  하세요') === '안녕 하세요', 'strip music');
assert(clean('이제 출 발 해야 해') === '이제 출발 해야 해', 'merge split syllables');
assert(clean('철수: 같이 가 자') === '철수: 같이 가자', 'merge after name');
assert(clean('(한숨) 미안해') === '미안해', 'strip paren');
assert(parse('이것은 테스트입니다', 80).speakText === '이것은 테스트입니다', 'plain line');
assert(parse('철수: 같이 가자', 80).speaker === '철수', 'name mapping');
assert(parse('철수: 같이 가자', 80).speakText === '같이 가자', 'name not spoken');
assert(parse('hello world', 90) === null, 'reject english');
assert(parse('207 7 묵겨롤재눅 567 10101', 80) === null, 'reject digit soup');
assert(parse('0 객 12 킨 불시', 40) === null, 'reject mixed junk');
assert(parse('♪', 90) === null, 'reject music only');
assert(parse('(한숨)', 90) === null, 'reject sfx only');
remember('같이 가자');
assert(isDuplicate('같이 가자') === true, 'duplicate');
assert(isDuplicate('같이가자') === true, 'duplicate spaces');
assert(isDuplicate('전혀 다른 문장입니다') === false, 'new sentence');
markGap();
assert(isDuplicate('같이 가자') === false, 'gap allows reread');
console.log('subtitle checks ok');
