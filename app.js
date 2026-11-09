const field = id => document.getElementById(id);
const value = id => field(id).value.trim();
const storageKey = 'jp.daily-report.settings.v1';
const workKey = 'jp.daily-report.work.v1';
const savedFields = ['project', 'client', 'site', 'hours', 'start', 'end', 'mode'];

function restoreSettings() {
  try {
    const work = localStorage.getItem(workKey);
    if (work !== null) {
      field('work').value = work;
      field('rememberWork').checked = true;
    }
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

function clearWhenUnchecked(checkbox, key) {
  if (checkbox.checked) return;
  try {
    localStorage.removeItem(key);
  } catch {
    alert('保存設定を消去できませんでした。');
  }
}
field('remember').addEventListener('change', event => clearWhenUnchecked(event.target, storageKey));
field('rememberWork').addEventListener('change', event => clearWhenUnchecked(event.target, workKey));

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
  if (field('rememberWork').checked) {
    try {
      localStorage.setItem(workKey, field('work').value);
    } catch {
      warning += ' 作業内容を保存できませんでした。';
    }
  }
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

const importLabels = {
  day: '日付', start: '出勤', end: '退勤', project: 'PJ名',
  client: '常駐先企業名', site: '拠点', mode: '勤務形態',
  work: '作業内容', note: '所感', hours: '稼働見込み時間（h）',
};
let pendingImport = null;

function resetImportReview() {
  pendingImport = null;
  field('import-review').hidden = true;
  field('import-values').replaceChildren();
  field('import-message').textContent = '';
}

field('import-source').addEventListener('input', resetImportReview);
field('import-date').addEventListener('change', resetImportReview);
// 確認後に既存の入力を編集した場合は、反映前にもう一度確認する。
report.addEventListener('input', resetImportReview);

field('import-read').addEventListener('click', () => {
  resetImportReview();
  try {
    const parsed = parsePreviousReport(field('import-source').value, new Date().getFullYear());
    if (!field('import-date').checked) delete parsed.day;
    pendingImport = parsed;
    for (const [id, content] of Object.entries(parsed)) {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = importLabels[id];
      description.textContent = content;
      field('import-values').append(term, description);
    }
    field('import-date-notice').textContent = field('import-date').checked
      ? '日付も取り込みます。年のない日付は今年として表示しています。'
      : '日付は現在の日付欄（' + value('day') + '）を維持します。勤務形態の記載がなければ出社になります。';
    field('import-review').hidden = false;
    field('import-message').textContent = '読み取りました。日付・勤務形態と、③④が今日の内容か確認してください。';
  } catch (error) {
    field('import-message').textContent = error.message;
  }
});

field('import-apply').addEventListener('click', () => {
  if (!pendingImport) return;
  for (const [id, content] of Object.entries(pendingImport)) {
    field(id).value = content;
  }
  refresh();
  resetImportReview();
  field('import-source').value = '';
  field('settings').open = true;
  field('import-message').textContent = '各欄に反映しました。今日の内容に直してからコピーしてください。端末への保存はコピー時の保存設定に従います。';
});


