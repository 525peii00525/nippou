'use strict';

// 本文は変換せず、日付・時刻・区切りなどの構造部分だけ表記をそろえる。
function normalizeReportStructure(text) {
  return text.replace(/[０-９：／（）．ｈＨ]/g, character =>
    String.fromCharCode(character.charCodeAt(0) - 0xfee0));
}

function parsePreviousReport(source, year) {
  const fail = message => { throw new Error(message); };
  if (!source.trim()) fail('①〜⑤の日報を貼り付けてください。');
  if (source.length > 20000) fail('日報は20,000文字以内にしてください。');

  const sections = [];
  let current = -1;
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    const marker = line.match(/^\s*([①②③④⑤])(.*)$/u);
    if (marker) {
      const index = '①②③④⑤'.indexOf(marker[1]);
      if (index !== sections.length) {
        fail('①〜⑤を各1回、順番に付けてください。番号の欠落・重複・順序を確認してください。');
      }
      sections.push(marker[2]);
      current = index;
    } else if (current >= 0) {
      sections[current] += '\n' + line;
    } else if (line.trim()) {
      fail('①より前の文章を取り除いてください。');
    }
  }
  if (sections.length !== 5) fail('①〜⑤の項目をすべて入れてください。');

  const heading = normalizeReportStructure(sections[0]).trim();
  const schedule = heading.match(/^(?:(\d{4})\s*\/\s*)?(\d{1,2})\s*\/\s*(\d{1,2})\s*(?:\(\s*[日月火水木金土]\s*\))?\s*(\d{1,2})\s*:\s*(\d{2})\s*[〜～~]\s*(\d{1,2})\s*:\s*(\d{2})$/u);
  if (!schedule) fail('①を「11/09(月) 09:30〜18:15」の形にしてください。');

  const [, explicitYear, month, day, startHour, startMinute, endHour, endMinute] = schedule;
  const reportYear = explicitYear ? Number(explicitYear) : year;
  const date = new Date(reportYear, Number(month) - 1, Number(day), 12);
  if (reportYear < 1900 || reportYear > 9999 ||
      date.getFullYear() !== reportYear || date.getMonth() + 1 !== Number(month) ||
      date.getDate() !== Number(day)) {
    fail('①の日付が正しくありません。月日を確認してください。');
  }
  if (Number(startHour) > 23 || Number(endHour) > 23 ||
      Number(startMinute) > 59 || Number(endMinute) > 59) {
    fail('①の時刻が正しくありません。時は0〜23、分は00〜59で指定してください。');
  }
  const pad = number => String(number).padStart(2, '0');

  // 案件名・企業名・拠点の文字は保ち、勤務形態の括弧の中だけ別に扱う。
  let workplace = sections[1].trim();
  let mode = '出社';
  const modeMatch = workplace.match(/[（(]([^()（）]*)[)）]\s*$/u);
  if (modeMatch) {
    mode = normalizeReportStructure(modeMatch[1]).replace(/\s/g, '');
    if (mode === '出社/在宅併用') mode = '出社/在宅';
    if (!['出社', '在宅', '出社/在宅'].includes(mode)) {
      fail('②の勤務形態は「出社」「在宅」「出社/在宅」で指定してください。');
    }
    workplace = workplace.slice(0, modeMatch.index).trim();
  }
  const parts = workplace.split(/[/／]/u).map(part => part.trim());
  if (parts.length !== 3 || parts.some(part => !part || /\n/.test(part))) {
    fail('②は「PJ名/企業名/拠点」の3項目にしてください。名前に含まれる / も確認してください。');
  }
  const hoursText = normalizeReportStructure(sections[4]).trim();
  const hoursMatch = hoursText.match(/^(\d+(?:\.\d+)?)\s*h$/i);
  if (!hoursMatch || !Number.isFinite(Number(hoursMatch[1]))) {
    fail('⑤は「180h」のように、0以上の数値とhを入れてください。');
  }
  if (!sections[2].trim() || !sections[3].trim()) {
    fail('③の作業内容と④の所感を入れてください。');
  }

  return {
    day: reportYear + '-' + pad(month) + '-' + pad(day),
    start: pad(startHour) + ':' + startMinute,
    end: pad(endHour) + ':' + endMinute,
    project: parts[0],
    client: parts[1],
    site: parts[2],
    mode,
    work: sections[2].trim(),
    note: sections[3].trim(),
    hours: hoursMatch[1],
  };
}

