const $ = selector => document.querySelector(selector);
let state, initialized = false, hiddenPassword = false, toastTimer;
function toast(text, error = false) { clearTimeout(toastTimer); $('#toast').textContent = text; $('#toast').className = `toast${error ? ' error' : ''}`; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500); }
function config() { return { host: $('#host').value, port: Number($('#port').value), tcpPort:Number($('#tcp-port').value), autoStart: $('#auto-start').checked, secureCookie: $('#secure-cookie').checked }; }
function render(value) {
  state = value;
  const names = { starting: '正在启动', running: '世界运行中', stopping: '正在保存并停止', stopped: '已停止', error: '启动 / 运行异常' };
  $('#status span').textContent = names[state.status]; $('#status').className = `badge ${state.status === 'running' ? '' : state.status === 'error' ? 'error-state' : 'stopped'}`;
  const busy = ['starting', 'running', 'stopping'].includes(state.status);
  $('#core-version').textContent = state.coreVersion;
  $('#install-update').disabled = busy; $('#rollback-update').disabled = busy || !state.canRollback;
  $('#start').disabled = busy; $('#stop').disabled = !['running', 'starting'].includes(state.status);
  $('#save-config').disabled = busy; $('#backup').disabled = busy; $('#open-world').disabled = state.status !== 'running';
  for (const id of ['host', 'port', 'tcp-port', 'auto-start', 'secure-cookie']) $(`#${id}`).disabled = busy;
  if (!initialized || busy) {
    $('#host').value = state.config.host; $('#port').value = state.config.port; $('#tcp-port').value = state.config.tcpPort;
    $('#auto-start').checked = state.config.autoStart; $('#secure-cookie').checked = state.config.secureCookie; initialized = true;
  }
  $('#data-path').textContent = state.dataDir;
  $('#root-secret').hidden = !state.initialPassword || hiddenPassword;
  $('#root-password').textContent = hiddenPassword ? '' : state.initialPassword || '';
  const addresses = $('#addresses'); addresses.replaceChildren();
  for (const address of state.addresses) {
    const row = document.createElement('div'); row.className = 'address-row';
    const code = document.createElement('code'); code.textContent = address;
    const copy = document.createElement('button'); copy.textContent = '复制'; copy.onclick = () => run(() => window.serverApp.copyAddress(address), '连接地址已复制');
    row.append(code, copy); addresses.append(row);
  }
  if (!state.addresses.length) { const p = document.createElement('p'); p.textContent = '启动服务端后显示连接地址。'; addresses.append(p); }
  const log = $('#logs'), atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  log.textContent = state.logs.join('\n') || '等待启动…'; if (atEnd) log.scrollTop = log.scrollHeight;
}
async function run(fn, message) {
  try { const result = await fn(); if (!result.ok) throw new Error(result.error); if (result.value?.status) render(result.value); if (message) toast(message); return result.value; }
  catch (error) { toast(error.message, true); }
}
$('#config-form').onsubmit = event => { event.preventDefault(); run(() => window.serverApp.saveConfig(config()), '配置已保存'); };
$('#start').onclick = () => run(() => window.serverApp.start(config()), '世界已启动');
$('#stop').onclick = () => run(() => window.serverApp.stop(), '世界已停止，存档已保存');
$('#open-world').onclick = () => run(() => window.serverApp.openWorld());
$('#open-data').onclick = () => run(() => window.serverApp.openData());
$('#backup').onclick = async () => { const destination = await run(() => window.serverApp.backup()); if (destination) toast('存档备份完成'); };
$('#hide-password').onclick = () => { hiddenPassword = true; render(state); };
window.serverApp.onChange(render);
run(() => window.serverApp.state());

$('#install-update').onclick = () => run(() => window.serverApp.installUpdate());
$('#rollback-update').onclick = () => run(() => window.serverApp.rollbackUpdate());
