const form = document.querySelector('#connect-form'), address = document.querySelector('#address'), error = document.querySelector('#error'), button = document.querySelector('#connect');
async function loadSettings() {
  try {
    const settings = await window.squarelands.settings(); address.value = settings.address;
    const recent = document.querySelector('#recent'); recent.replaceChildren();
    for (const value of settings.recent || []) {
      const item = document.createElement('button'); item.type = 'button'; item.textContent = value;
      item.onclick = () => { address.value = value; address.focus(); }; recent.append(item);
    }
    if (!recent.childElementCount) recent.textContent = '连接成功后会保存在这里';
  } catch (e) { error.textContent = e.message; }
}
form.onsubmit = async event => {
  event.preventDefault(); error.textContent = ''; button.disabled = true; button.textContent = '正在连接…';
  try { const result = await window.squarelands.connect(address.value); if (!result.ok) error.textContent = result.error; else await loadSettings(); }
  catch (e) { error.textContent = e.message; }
  finally { button.disabled = false; button.innerHTML = '连接世界 <span>→</span>'; }
};
loadSettings();
