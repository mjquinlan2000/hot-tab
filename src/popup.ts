import webex from 'webextension-polyfill'

var list = document.getElementById('shortcut-list');

window.onload = async () => {
  list ? list.innerHTML = "" : null;
  const commands = await webex.commands.getAll()
  commands.filter(command => {
    return command.description != "";
  }).map(function (command) {
    let shortcut;
    if (command.shortcut == "") {
      let tag = document.createElement("i")
      let text = document.createTextNode("None")
      tag.appendChild(text)
      shortcut = tag;
    } else {
      shortcut = document.createTextNode(command.shortcut ?? "")
    }
    let trow = document.createElement("tr")
    let ltd = document.createElement("td")
    let rtd = document.createElement("td")
    let descnode = document.createTextNode(command.description || "")
    ltd.appendChild(descnode)
    rtd.appendChild(shortcut)
    trow.appendChild(ltd)
    trow.appendChild(rtd)
    list ? list.appendChild(trow) : null
  })
}
