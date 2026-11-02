const field = id => document.getElementById(id);
const value = id => field(id).value.trim();
const storageKey = 'jp.daily-report.settings.v1';
const savedFields = ['project', 'client', 'site', 'hours', 'start', 'end', 'mode'];

function restoreSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey)) || {};

    // 以前の表記で保存された勤務形態も復元する。
    if (saved.mode === '出社/在宅併用') {
      saved.mode = '出社/在宅';
    }

    for (const id of savedFields) {
      if (typeof saved[id] === 'string') {
        field(id).value = saved[id];
      }
    }
    if (saved.project) {
      field('remember').checked = true;
      field('settings').open = false;
    }
  } catch {
    // 保存領域が使えない場合も、初期値で日報を作成できる。
  }
}

function formatReportDate(date) {
  if (!date) return '';
  const weekday = new Date(date + 'T12:00:00').getDay();
  const monthDay = date.slice(5).replace('-', '/');
  return monthDay + '(' + '日月火水木金土'[weekday] + ')';
}

function refresh() {
  const mode = value('mode');
  const suffix = mode && mode !== '出社' ? '(' + mode + ')' : '';
  const workplace = [value('project'), value('client'), value('site') + suffix];

  field('preview').value = [
    '①' + formatReportDate(value('day')) + ' ' + value('start') + '〜' + value('end'),
    '②' + workplace.join('/'),
    '③' + value('work'),
    '④' + value('note'),
    '⑤' + value('hours') + 'h',
  ].join('\n');
  field('status').textContent = '';
}

field('remember').addEventListener('change', () => {
  if (field('remember').checked) return;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    alert('保存設定を消去できませんでした。');
  }
});

const report = field('report');
report.addEventListener('invalid', event => {
  if (field('settings').contains(event.target)) {
    field('settings').open = true;
  }
}, true);
report.addEventListener('input', refresh);
report.addEventListener('submit', async event => {
  event.preventDefault();
  refresh();

  let warning = '';
  if (field('remember').checked) {
    try {
      const settings = Object.fromEntries(savedFields.map(id => [id, value(id)]));
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      warning = ' 基本情報を保存できませんでした。';
    }
  }

  const preview = field('preview');
  try {
    await navigator.clipboard.writeText(preview.value);
    field('status').textContent = 'コピーしました。' + warning;
  } catch {
    preview.focus();
    preview.select();
    field('status').textContent = '選択した本文を手動でコピーしてください。' + warning;
  }
});

restoreSettings();
const today = new Date();
const pad = number => String(number).padStart(2, '0');
field('day').value = [
  today.getFullYear(),
  pad(today.getMonth() + 1),
  pad(today.getDate()),
].join('-');
refresh();
